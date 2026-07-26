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

ZONE_ROWS = {1: 10, 2: 12, 3: 15, 4: 18}

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
}

# Activity code -> column letter mapping (used in _fill_stundenrapport))


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


def _set_cell_marker(xml: str, ref: str) -> str:
    """Set a cell to the activity marker 'ü' (inline string)."""
    style = _get_cell_style(xml, ref)
    new = f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>ü</t></is></c>'
    return _replace_cell(xml, ref, new)


def _fill_stundenrapport(
    sheet_xml: str,
    year: int,
    week_number: int,
    personnel_number: str,
    full_name: str,
    entries: list[dict],
) -> str:
    """Fill Stundenrapport sheet XML with data."""
    xml = sheet_xml

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

    # --- Data entries (rows 8-22, max 15) ---
    work_entries = [e for e in entries if not e.get("is_lunch", False)]
    work_entries.sort(key=lambda e: (e.get("date", ""), e.get("start_time", 0)))

    for i, entry in enumerate(work_entries):
        if i >= 15:
            break
        row = 8 + i

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

        # Start time (H)
        start_time = entry.get("start_time", 0)
        if start_time is not None:
            xml = _set_cell_num(xml, f"H{row}", float(start_time))

        # Duration (I)
        duration = entry.get("duration", 0)
        if duration is not None:
            xml = _set_cell_num(xml, f"I{row}", float(duration))

        # Activity code marker (J-R)
        activity_code = entry.get("activity_code", "")
        if activity_code and activity_code in ACTIVITY_COLUMNS:
            col_letter = ACTIVITY_COLUMNS[activity_code]
            xml = _set_cell_marker(xml, f"{col_letter}{row}")

    return xml


def _fill_spesenrapport(
    sheet_xml: str,
    year: int,
    week_number: int,
    personnel_number: str,
    full_name: str,
    entries: list[dict],
    expenses: Optional[list[dict]] = None,
) -> str:
    """Fill Spesenrapport sheet XML with data."""
    xml = sheet_xml

    # --- Header row 7 ---
    xml = _set_cell_str(xml, "B7", str(personnel_number))
    xml = _set_cell_str(xml, "G7", full_name)

    # --- Date range row 5 ---
    monday = _get_monday_of_week(year, week_number)
    friday = monday + timedelta(days=4)
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
        zone = entry.get("zone", 0) or entry.get("location_zone", 0)
        if zone and zone > day_zones.get(wk, 0):
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

        # Fill sheets with data
        sheet1_filled = _fill_stundenrapport(
            sheet1_xml, year, week_number, personnel_number, full_name, entries
        )
        sheet2_filled = _fill_spesenrapport(
            sheet2_xml, year, week_number, personnel_number, full_name,
            entries, expenses
        )

        # Rebuild the zip with modified sheets
        with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as z_out:
            for item in z_in.infolist():
                data = z_in.read(item.filename)

                if item.filename == "xl/worksheets/sheet1.xml":
                    data = sheet1_filled.encode("utf-8")
                elif item.filename == "xl/worksheets/sheet2.xml":
                    data = sheet2_filled.encode("utf-8")

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
