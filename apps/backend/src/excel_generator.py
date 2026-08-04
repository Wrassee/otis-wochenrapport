"""
Excel Generator: Fills in the OTIS Wochenrapport template
using RAW XML manipulation to preserve rich-text formatting
(Wingdings legend cells A24/A25) that openpyxl would corrupt.
"""

import os
import re
import zipfile
import copy
from io import BytesIO
from datetime import datetime, timedelta
from typing import Optional
from xml.sax.saxutils import escape as xml_escape

TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "templates",
    "template.xlsx",
)

SPESEN_DAY_COLUMNS = {
    0: "D", 1: "E", 2: "F", 3: "G", 4: "H",
    5: "I", 6: "J",
}

ZONE_ROWS = {1: 10, 2: 12, 3: 15, 4: 18, 5: 21}

EXPENSE_ROWS = {
    "entschaedigung_10h": 26,
    "hotel": 27,
    "transport": 28,
    "pikettdienst": 29,
    "entschaedigung_pikett": 30,
    "material": 31,
    "privatfahrzeug": 33,
}

ACTIVITY_COLUMNS = {
    "NK": "J", "S": "J", "T": "J",
    "T Clot": "K", "O": "L", "QI": "M",
    "I04": "N", "I5S": "N", "I5Q": "N", "I5T": "N", "I5A": "N",
    "A01": "N", "A02": "N", "A03": "N", "A04": "N", "A05": "N", "A07": "N",
    "VM": "O", "VP": "P",
    "NM": "Q", "NTC": "Q", "NF": "Q", "VC": "Q",
    "QI SCOTT": "R",
}    # Activity code -> column letter mapping (used in _fill_stundenrapport))

# Codes that are written as TEXT into the Phase/Improductif column (N) instead
# of a checkmark — e.g. 'I04' = Administration, absence codes A01-A07.
TEXT_ACTIVITY_CODES = {
    "I04", "I5S", "I5Q", "I5T", "I5A",
    "A01", "A02", "A03", "A04", "A05", "A07",
}


def _get_monday_of_week(year: int, week_number: int) -> datetime:
    jan4 = datetime(year, 1, 4)
    monday = jan4 - timedelta(days=jan4.weekday()) + timedelta(weeks=week_number - 1)
    return monday


def _num_str(value: float) -> str:
    """Format a numeric value for XML."""
    if value == int(value):
        return str(int(value))
    # Format with up to 15 decimal places, strip trailing zeros
    s = f"{value:.15f}".rstrip("0")
    return s[:-1] if s.endswith(".") else s


def _standard_to_otis(decimal_hours: float) -> float:
    """
    Convert standard decimal hours to OTIS format.
    Standard: 4.5 (4h30m)  →  OTIS: 4.30
    Standard: 7.25 (7h15m)  →  OTIS: 7.15
    """
    hours = int(decimal_hours)
    minutes = int(round((decimal_hours - hours) * 60))
    return hours + minutes / 100


def _get_cell_style(xml: str, ref: str) -> str:
    """Extract the style attribute from an existing cell element."""
    m = re.search(rf'<c\s+r="{ref}"\s+s="(\d+)"', xml)
    return m.group(1) if m else "0"


def _replace_cell(xml: str, ref: str, new_xml: str) -> str:
    """
    Replace an existing cell <c r="REF"...>...</c> with new XML.
    Handles both empty cells (<c ... />) and cells with values (<c ...>...</c>).
    """
    # Try self-closing tag first
    pattern = rf'<c\s+r="{ref}"[^>]*/>'
    m = re.search(pattern, xml)
    if m:
        return xml.replace(m.group(0), new_xml)
    # Try full tag
    pattern2 = rf'<c\s+r="{ref}"[^>]*>.*?</c>'
    m2 = re.search(pattern2, xml, re.DOTALL)
    if m2:
        return xml.replace(m2.group(0), new_xml)
    return xml  # Cell not found


def _set_cell_num(xml: str, ref: str, value: float) -> str:
    """Set a cell to a numeric value, preserving its style."""
    style = _get_cell_style(xml, ref)
    new = f'<c r="{ref}" s="{style}"><v>{_num_str(value)}</v></c>'
    return _replace_cell(xml, ref, new)


def _set_cell_str(xml: str, ref: str, value: str) -> str:
    """Set a cell to an inline string value, preserving its style."""
    style = _get_cell_style(xml, ref)
    escaped = xml_escape(value)
    new = f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{escaped}</t></is></c>'
    return _replace_cell(xml, ref, new)


def _set_cell_marker(xml: str, ref: str, style: str) -> str:
    """Set a cell to the activity marker '✓' (U+2713, inline string).

    The CELL STYLE carries a plain black font (created by
    _build_marker_styles), so '✓' renders visibly in every viewer — no
    Wingdings needed (Wingdings maps '✓' to a wrong glyph, and the template's
    marker fonts are white, i.e. invisible on white fill).
    """
    new = f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>ü</t></is></c>'
    return _replace_cell(xml, ref, new)


def _set_cell_text_marker(xml: str, ref: str, style: str, code: str) -> str:
    """Write an activity CODE as text (e.g. 'I04' = Administration) into the
    Improduktif/Phase column - the template expects the literal code here, not
    a checkmark. The style is fixed up to a plain black Arial font by
    _build_marker_styles (Wingdings would garble the code)."""
    new = f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{xml_escape(code)}</t></is></c>'
    return _replace_cell(xml, ref, new)


WINGDINGS_MARKER_FONT_ID = 6  # Wingdings 26 bold BLACK - the template's own checkmark font
TEXT_MARKER_FONT_ID = 2  # Arial 14 black - for activity codes written as text (I04, A01, ...)
# Fonts that render the marker/code invisible (white - indexed=9) and must be
# swapped to a black Wingdings font for markers, or to black Arial for codes:
WHITE_FONTS = {20, 21, 22, 23, 25}
# Black Wingdings fonts are PERFECT for the 'ü' marker (6, 7, 8) but must be
# swapped to Arial when writing a text code ('I04' in Wingdings = garbage).
WINGDINGS_FONTS = {6, 7, 8}
# Dark solid fill (indexed=8 = black) that would hide a black marker/text.
DARK_FILL_IDS = {4}
NONE_FILL_ID = 0


def _build_marker_styles(
    styles_xml: str,
    marker_styles: set[int],
    text_styles: set[int],
) -> tuple[str, dict[int, int]]:
    """Ensure marker cells render a visible black 'ü' (Wingdings) and
    text-code cells a visible black Arial code.

    The template's marker columns use white (indexed=9) and Wingdings fonts.
    For each style we append a variant that swaps the font to a black Wingdings
    (for the 'ü' marker) or to plain black Arial (for codes written as text),
    and clears dark fills. Styles that are already safe (black font on a light
    fill) are mapped to themselves.

    Returns (updated styles.xml, {old_style: new_style}).
    """
    if not marker_styles and not text_styles:
        return styles_xml, {}
    # Only the <cellXfs> section carries the cell styles (cellStyleXfs is a
    # separate, much smaller section that precedes it — including it would
    # shift the indices and patch the wrong style).
    cell_xfs_section = re.search(r"<cellXfs.*?</cellXfs>", styles_xml, re.S)
    if not cell_xfs_section:
        return styles_xml, {}
    xfs = re.findall(r"<xf\b[^>]*?(?:/>|>.*?</xf>)", cell_xfs_section.group(0), re.S)
    count_m = re.search(r'<cellXfs count="(\d+)"', styles_xml)
    if not count_m:
        return styles_xml, {}
    base = int(count_m.group(1))
    mapping: dict[int, int] = {}
    extra: list[str] = []
    for s in sorted(marker_styles | text_styles):
        if s >= len(xfs):
            continue
        xf = xfs[s]
        fid_m = re.search(r'fontId="(\d+)"', xf)
        fill_m = re.search(r'fillId="(\d+)"', xf)
        fid = int(fid_m.group(1)) if fid_m else 0
        fill = int(fill_m.group(1)) if fill_m else 0
        is_text = s in text_styles
        if is_text:
            # Text codes need a normal font: white fonts are invisible, and
            # black Wingdings fonts would garble the code characters.
            need_font = fid in WHITE_FONTS or fid in WINGDINGS_FONTS
        else:
            # Markers must ALWAYS use a black Wingdings font (6/7/8) so 'ü'
            # renders as a checkmark — a normal font would show a 'ü' letter.
            need_font = fid not in WINGDINGS_FONTS
        need_fill = fill in DARK_FILL_IDS
        if not need_font and not need_fill:
            mapping[s] = s  # already safe — keep the original style
            continue
        target = TEXT_MARKER_FONT_ID if is_text else WINGDINGS_MARKER_FONT_ID
        new_xf = xf
        if need_font:
            new_xf = re.sub(r'fontId="\d+"', f'fontId="{target}"', new_xf, count=1)
        if need_fill:
            new_xf = re.sub(r'fillId="\d+"', f'fillId="{NONE_FILL_ID}"', new_xf, count=1)
        mapping[s] = base + len(extra)
        extra.append(new_xf)
    if not extra:
        return styles_xml, mapping
    styles_xml = styles_xml.replace(
        f'<cellXfs count="{count_m.group(1)}">',
        f'<cellXfs count="{base + len(extra)}">',
    )
    styles_xml = styles_xml.replace("</cellXfs>", "".join(extra) + "</cellXfs>", 1)
    return styles_xml, mapping


def _fill_stundenrapport(
    sheet_xml: str,
    year: int,
    week_number: int,
    personnel_number: str,
    full_name: str,
    entries: list[dict],
) -> tuple[str, list[str]]:
    """Fill Stundenrapport sheet XML with data.

    Returns (filled_xml, marker_refs, text_refs) — the activity markers are
    applied afterwards (in generate_excel) once the styles exist.
    """
    xml = sheet_xml
    marker_refs: list[str] = []
    text_refs: list[tuple[str, int, str]] = []

    # --- Header row 2 ---
    xml = _set_cell_str(xml, "C2", str(personnel_number))
    name_parts = full_name.strip().split(" ", 1)
    if len(name_parts) == 2:
        xml = _set_cell_str(xml, "E2", name_parts[0])  # Last name
        xml = _set_cell_str(xml, "H2", name_parts[1])  # First name
    else:
        xml = _set_cell_str(xml, "E2", full_name)

    week_monday = _get_monday_of_week(year, week_number)
    xml = _set_cell_num(xml, "L2", week_monday.month)
    xml = _set_cell_num(xml, "N2", year)
    xml = _set_cell_num(xml, "L3", week_number)

    # --- Second block row 28-29 ---
    xml = _set_cell_str(xml, "C28", str(personnel_number))
    if len(name_parts) == 2:
        xml = _set_cell_str(xml, "E28", name_parts[0])
        xml = _set_cell_str(xml, "H28", name_parts[1])
    else:
        xml = _set_cell_str(xml, "E28", full_name)
    xml = _set_cell_num(xml, "L28", week_monday.month)
    xml = _set_cell_num(xml, "N28", year)
    xml = _set_cell_num(xml, "L29", week_number)

    # --- Data entries. Two identical 15-row blocks in the template:
    #   block 1 = rows 8-22, block 2 = rows 34-48 (offset +26).
    # The template physically has a second page/block — entries beyond the
    # first 15 MUST continue there, otherwise they silently vanish.
    work_entries = [e for e in entries if not e.get("is_lunch", False)]
    work_entries.sort(key=lambda e: (e.get("date", ""), e.get("start_time", 0)))

    BLOCK_START = 8
    BLOCK2_OFFSET = 26  # 34 - 8
    MAX_ENTRIES = 30  # 15 rows per block × 2 blocks

    if len(work_entries) > MAX_ENTRIES:
        print(
            f"[excel_generator] WARNING: {len(work_entries)} work entries exceed the "
            f"template capacity of {MAX_ENTRIES} — {(len(work_entries) - MAX_ENTRIES)} "
            "entries will NOT appear in the Excel."
        )

    for i, entry in enumerate(work_entries):
        if i >= MAX_ENTRIES:
            break
        block_idx = i // 15
        row_in_block = i % 15
        row = BLOCK_START + row_in_block + (BLOCK2_OFFSET if block_idx == 1 else 0)

        # Day of month (A)
        date_str = entry.get("date", "")
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            xml = _set_cell_num(xml, f"A{row}", dt.day)
        except (ValueError, TypeError):
            pass

        # Anlagenummer (B)
        anr = entry.get("anlagenummer", "")
        if anr:
            xml = _set_cell_str(xml, f"B{row}", anr)

        # Project ID (D)
        pid = entry.get("project_id", "")
        if pid:
            xml = _set_cell_str(xml, f"D{row}", pid)

        # Address (F)
        addr = entry.get("address", "")
        if addr:
            xml = _set_cell_str(xml, f"F{row}", addr)

        # Start time (H) — OTIS format (7.30 = 7h30m)
        start_time = entry.get("start_time", 0)
        if start_time is not None:
            xml = _set_cell_num(xml, f"H{row}", _standard_to_otis(float(start_time)))

        # Duration (I) — OTIS format (4.30 = 4h30m)
        duration = entry.get("duration", 0)
        if duration is not None:
            xml = _set_cell_num(xml, f"I{row}", _standard_to_otis(float(duration)))

        # Activity marker / text code (J-R) — applied later once the styles
        # exist. Work entries without an explicit activity default to NK so
        # every line of the protocol gets a checkmark (the template requires
        # one per row). Codes like I04/A01 are written as TEXT ('I04') into
        # the Phase/Improductif column, not as a checkmark.
        activity_code = entry.get("activity_code", "") or "NK"
        if activity_code and activity_code in ACTIVITY_COLUMNS:
            col_letter = ACTIVITY_COLUMNS[activity_code]
            if activity_code in TEXT_ACTIVITY_CODES:
                text_refs.append((col_letter, row, activity_code))
            else:
                marker_refs.append(f"{col_letter}{row}")

    return xml, marker_refs, text_refs


def _fill_spesenrapport(
    sheet_xml: str,
    year: int,
    week_number: int,
    personnel_number: str,
    full_name: str,
    entries: list[dict],
    expenses: Optional[list[dict]] = None,
    photo_notes: Optional[list[str]] = None,
) -> str:
    """Fill Spesenrapport sheet XML with data."""
    xml = sheet_xml

    # --- Header: values go into the empty value cells next to the template
    # labels (D5/H5/A7/F7 are the labels; E5/I5/B7/G7 are the value cells).
    monday = _get_monday_of_week(year, week_number)
    friday = monday + timedelta(days=4)
    xml = _set_cell_str(xml, "B7", str(personnel_number))
    xml = _set_cell_str(xml, "G7", full_name)
    xml = _set_cell_str(xml, "E5", monday.strftime("%d.%m.%Y"))
    xml = _set_cell_str(xml, "I5", friday.strftime("%d.%m.%Y"))

    # --- Calculate highest zone per day ---
    day_zones: dict[int, int] = {}
    for entry in entries:
        date_str = entry.get("date", "")
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            wk = dt.weekday()
        except (ValueError, TypeError):
            continue
        zone_raw = entry.get("zone") or entry.get("location_zone") or 0
        zone = int(zone_raw)
        if zone > 0 and zone > day_zones.get(wk, 0):
            day_zones[wk] = zone

    # --- Fill zone marks ---
    for weekday, zone in day_zones.items():
        if zone in ZONE_ROWS:
            row = ZONE_ROWS[zone]
            col_letter = SPESEN_DAY_COLUMNS.get(weekday)
            if col_letter:
                xml = _set_cell_num(xml, f"{col_letter}{row}", 1)

    # --- Fill expenses ---
    if expenses:
        expense_by_day: dict[int, dict[str, float]] = {}
        for exp in expenses:
            date_str = exp.get("date", "")
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                wk = dt.weekday()
            except (ValueError, TypeError):
                continue
            expense_by_day.setdefault(wk, {})
            exp_type = exp.get("expense_type", "")
            exp_value = exp.get("value", 1)
            expense_by_day[wk][exp_type] = float(exp_value)

        for weekday, day_expenses in expense_by_day.items():
            col_letter = SPESEN_DAY_COLUMNS.get(weekday)
            if not col_letter:
                continue
            for exp_type, value in day_expenses.items():
                if exp_type in EXPENSE_ROWS:
                    row = EXPENSE_ROWS[exp_type]
                    xml = _set_cell_num(xml, f"{col_letter}{row}", value)

    # --- Photo notes (Bemerkungen, row 34 - empty in the template) ---
    notes = [n.strip() for n in (photo_notes or []) if n.strip()]
    if notes:
        xml = _set_cell_str(xml, "C34", "Bemerkungen / Notes :")
        xml = _set_cell_str(xml, "E34", "  |  ".join(notes))

    # --- Footer date (E36) ---
    today = datetime.now()
    xml = _set_cell_str(xml, "E36", today.strftime("%d.%m.%Y"))

    return xml


def generate_excel(
    year: int,
    week_number: int,
    personnel_number: str,
    full_name: str,
    entries: list[dict],
    expenses: Optional[list[dict]] = None,
    photo_notes: Optional[list[str]] = None,
    output_path: Optional[str] = None,
) -> bytes:
    """
    Generate a filled Excel file from the template using raw XML manipulation.
    All rich-text formatting (Wingdings legend) is preserved because we never
    touch shared strings or styles — only the data cell values are modified.
    """
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")

    # Read template as raw bytes
    with open(TEMPLATE_PATH, "rb") as f:
        template_bytes = f.read()

    # Open as zip and extract sheet XMLs
    result = BytesIO()
    with zipfile.ZipFile(BytesIO(template_bytes), "r") as z_in:
        sheet1_xml = z_in.read("xl/worksheets/sheet1.xml").decode("utf-8")
        sheet2_xml = z_in.read("xl/worksheets/sheet2.xml").decode("utf-8")
        styles_xml = z_in.read("xl/styles.xml").decode("utf-8")

        # Fill sheets with data
        sheet1_filled, marker_refs, text_refs = _fill_stundenrapport(
            sheet1_xml, year, week_number, personnel_number, full_name, entries
        )
        # The marker is the template's own 'ü' rendered with a black Wingdings
        # font (see _set_cell_marker); text codes (I04, A01, ...) are written
        # with a plain black Arial font. _build_marker_styles fixes up any
        # style whose original font is white/Wingdings or whose fill is dark.
        marker_styles = {int(_get_cell_style(sheet1_filled, ref)) for ref in marker_refs}
        text_styles = {
            int(_get_cell_style(sheet1_filled, f"{col}{row}"))
            for col, row, _ in text_refs
        }
        styles_xml, style_map = _build_marker_styles(styles_xml, marker_styles, text_styles)
        for ref in marker_refs:
            style = _get_cell_style(sheet1_filled, ref)
            sheet1_filled = _set_cell_marker(
                sheet1_filled, ref, style_map.get(int(style), style)
            )
        for col, row, code in text_refs:
            ref = f"{col}{row}"
            style = _get_cell_style(sheet1_filled, ref)
            sheet1_filled = _set_cell_text_marker(
                sheet1_filled, ref, style_map.get(int(style), style), code
            )

        sheet2_filled = _fill_spesenrapport(
            sheet2_xml, year, week_number, personnel_number, full_name,
            entries, expenses, photo_notes
        )

        # Rebuild the zip with modified sheets
        with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as z_out:
            for item in z_in.infolist():
                data = z_in.read(item.filename)

                if item.filename == "xl/worksheets/sheet1.xml":
                    data = sheet1_filled.encode("utf-8")
                elif item.filename == "xl/worksheets/sheet2.xml":
                    data = sheet2_filled.encode("utf-8")
                elif item.filename == "xl/styles.xml":
                    data = styles_xml.encode("utf-8")

                # Preserve the ZipInfo but force DEFLATED compression
                info = copy.copy(item)
                info.compress_type = zipfile.ZIP_DEFLATED
                z_out.writestr(info, data)

    content = result.getvalue()

    # Optionally save to file
    if output_path:
        with open(output_path, "wb") as f:
            f.write(content)

    return content
