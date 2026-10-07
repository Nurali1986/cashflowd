"""Dump structure of the source workbook: per sheet, first rows with values and formulas."""
import sys
import openpyxl

path = sys.argv[1] if len(sys.argv) > 1 else "/app/data_source.xlsx"
max_rows = int(sys.argv[2]) if len(sys.argv) > 2 else 12

wb_f = openpyxl.load_workbook(path, read_only=True, data_only=False)

for ws in wb_f.worksheets:
    rows = 0
    max_col = 0
    sample = []
    formula_examples = {}
    for r_idx, row in enumerate(ws.iter_rows(), start=1):
        has = False
        for c in row:
            v = getattr(c, "value", None)
            if v is None:
                continue
            has = True
            col = getattr(c, "column", None) or 0
            max_col = max(max_col, col)
            if isinstance(v, str) and v.startswith("="):
                key = getattr(c, "column_letter", str(col))
                if key not in formula_examples:
                    formula_examples[key] = f"{c.coordinate}: {v[:200]}"
        if has:
            rows = r_idx
        if r_idx <= max_rows:
            vals = [(getattr(c, "coordinate", "?"), c.value) for c in row if getattr(c, "value", None) is not None]
            if vals:
                sample.append(vals[:40])
    print("=" * 100)
    print(f"SHEET: {ws.title!r}  last_row={rows}  max_col={max_col}")
    for s in sample:
        print("  ", s)
    print("  FORMULAS (first per column):")
    for k, v in list(formula_examples.items())[:60]:
        print("     ", v)
