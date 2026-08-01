"""
Cross-check: Excel export filename — JS (frontend) vs Python (backend).

The export filename (e.g. Wochenrapport_KW31_2026_27_07-31_07.xlsx) is built
in two independent implementations:
  - frontend:  ExportPage.buildFilename() → getWeekDates()  (apps/web/src/lib/utils.ts)
  - backend:   _build_excel_filename()                     (apps/backend/src/main.py)

Both derive the ISO-week Monday from "Jan 4 is always in week 1". This script
runs the JS algorithm via `node -e` and compares its output with the real
Python helper for a set of year/week cases (including year-boundary weeks and
53-week years). Stdlib only — no pytest needed.

Usage:
    python tests/test_filename_crosscheck.py
"""

import json
import subprocess
import sys
from pathlib import Path

# Make `src.main` importable when run from apps/backend (cwd) or anywhere else.
ROOT = Path(__file__).resolve().parents[1]  # apps/backend
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.main import _build_excel_filename  # noqa: E402

# Representative cases: the user's example, year-boundary weeks (where the ISO
# Monday can fall in the previous year), and 53-week years.
CASES = [
    (2026, 31),  # the documented example → 27_07-31_07
    (2026, 1),   # Monday = 2025-12-29 (previous year)
    (2026, 52),
    (2026, 53),  # 2026 has 53 ISO weeks (Jan 1 is a Thursday); Friday = 2027-01-01
    (2027, 1),   # Monday = 2027-01-04
    (2020, 53),  # 53-week year
    (2021, 1),
    (2024, 1),
    (2024, 9),   # leap-year week containing Feb 29
    (2025, 1),
    (2028, 1),
]

# Mirror of the frontend algorithm (apps/web/src/lib/utils.ts getWeekDates +
# ExportPage buildFilename). Kept as plain JS so it runs with `node -e` and no
# dependencies. Reads the cases from stdin as JSON, writes results to stdout.
JS_SCRIPT = r"""
const cases = JSON.parse(require('fs').readFileSync(0, 'utf8'));
function filename(year, week) {
  // January 4th is always in week 1; Monday = 0 … Sunday = 6.
  const jan4 = new Date(year, 0, 4);
  const dayOffset = jan4.getDay() === 0 ? 6 : jan4.getDay() - 1;
  const monday = new Date(year, 0, 4 + (week - 1) * 7 - dayOffset);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${pad(d.getDate())}_${pad(d.getMonth() + 1)}`;
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return `Wochenrapport_KW${week}_${year}_${fmt(monday)}-${fmt(friday)}.xlsx`;
}
process.stdout.write(JSON.stringify(cases.map(([y, w]) => filename(y, w))));
"""


def js_filenames(cases):
    """Run the mirrored JS algorithm via node and return the filename list."""
    proc = subprocess.run(
        ["node", "-e", JS_SCRIPT],
        input=json.dumps(cases),
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"node failed: {proc.stderr.strip() or proc.returncode}")
    return json.loads(proc.stdout)


def main():
    js = js_filenames(CASES)
    failures = []
    for (year, week), js_name in zip(CASES, js):
        py_name = _build_excel_filename(year, week)
        match = "OK" if js_name == py_name else "MISMATCH"
        print(f"{match:>8}  KW{week:>2}/{year}  JS: {js_name}  PY: {py_name}")
        if js_name != py_name:
            failures.append((year, week, js_name, py_name))

    if failures:
        print(f"\nFAIL: {len(failures)} mismatch(es) between JS and Python")
        for year, week, js_name, py_name in failures:
            print(f"  KW{week}/{year}: JS={js_name}  PY={py_name}")
        sys.exit(1)

    print(f"\nAll {len(CASES)} cases match between JS and Python.")


if __name__ == "__main__":
    main()
