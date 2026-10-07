"""Explore reference data: справочник, настройки tree/transfers, Kurs, P&L, P&L Reja, Cash flow stats."""
import openpyxl
from collections import Counter

wb = openpyxl.load_workbook("/app/data_source.xlsx", read_only=True, data_only=True)


def rows(name, min_row=1, max_row=None, max_col=None):
    for r in wb[name].iter_rows(min_row=min_row, max_row=max_row, max_col=max_col, values_only=True):
        yield r


print("=== справочник (all non-empty) ===")
for i, r in enumerate(rows("справочник", max_col=21), start=1):
    if any(v not in (None, "") for v in r):
        print(i, [v for v in r])

print("\n=== настройки N:Q (tree) and R:U (transfers), I:M ===")
for i, r in enumerate(rows("настройки", min_row=3, max_row=400, max_col=21), start=3):
    I, J, K, L, M, N, O, P, Q, R, S, T, U = r[8:21]
    if any(v not in (None, "") for v in (N, O, P, Q, R, S, T, U)):
        print(i, "N-Q:", (N, O, P, Q), "| R-U:", (R, S, T, U))
print("--- I:M sample")
cnt = 0
for i, r in enumerate(rows("настройки", min_row=3, max_row=400, max_col=13), start=3):
    if r[8] not in (None, ""):
        cnt += 1
        if cnt < 400:
            print(i, r[8:13])
print("I count", cnt)

print("\n=== Kurs ===")
k = [r for r in rows("Kurs", min_row=2, max_col=3) if r[0] is not None]
withv = [r for r in k if r[1] not in (None, "")]
print("rows", len(k), "with value", len(withv), "first", withv[:3], "last", withv[-3:])

print("\n=== Cash flow ===")
cf = [r[:9] for r in rows("Cash flow", min_row=3, max_col=25) if r[0] not in (None, "")]
print("rows", len(cf))
print("accounts", Counter(r[3] for r in cf))
print("types", Counter(str(r[2]).split(".")[0] for r in cf))
print("pnl months", Counter(r[1] for r in cf))
print("usd rows", sum(1 for r in cf if r[4] not in (None, "", 0)))
print("min date", min(r[0] for r in cf), "max", max(r[0] for r in cf))
print("projects", Counter(r[7] for r in cf).most_common(15))
tr = [r for r in cf if str(r[2]).startswith("ПЕРЕВОД")]
print("transfers sample", tr[:10])
nondate = [r for r in cf if not hasattr(r[0], "year")]
print("non-date A", nondate[:5])
nonnum = [r for r in cf if not isinstance(r[6], (int, float))]
print("non-numeric G", len(nonnum), nonnum[:5])

print("\n=== P&L ===")
pl = [r[:16] for r in rows("P&L", min_row=3, max_col=16) if r[1] not in (None, "")]
print("rows", len(pl))
for r in pl[:15]:
    print(r)
print("status", Counter(r[6] for r in pl))

print("\n=== P&L Reja ===")
pr = [r[:9] for r in rows("P&L Reja", min_row=3, max_col=9) if r[0] not in (None, "") or r[2] not in (None, "")]
print("rows", len(pr), pr[:10])

print("\n=== Back-end ===")
be = [r[:9] for r in rows("Back-end", min_row=2, max_col=9) if any(v not in (None, "", "#N/A") for v in r[:9])]
print("rows", len(be), be[:3])
