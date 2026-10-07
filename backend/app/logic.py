"""Calculations that replace the formulas of the Excel workbook.

The workbook computes everything from the «Cash flow» and «P&L Reja» rows with SUMIF formulas;
here the same numbers are produced in Python from the transactions table.
"""
import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .models import EXPENSE, INCOME, TRANSFER

MONTHS = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
          "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"]

# Operation filters of the report sheets («ВСЕ ОПЕРАЦИИ / ПРОЕКТЫ / КОМПАНИЯ» in настройки AL3:AL5).
MODE_ALL = "all"
MODE_PROJECTS = "projects"
MODE_COMPANY = "company"

NO_SUBCATEGORY = "(без подкатегории)"

DEFAULT_SETTINGS = {
    "start_date": "2024-07-01",
    "pnl_use_close_date": "0",
    "company_name": "Pifagor",
}


# ---------------------------------------------------------------- helpers

def month_label(d: Optional[date]) -> str:
    return f"{MONTHS[d.month - 1]} {d.year}" if d else ""


def parse_month_label(text) -> Optional[date]:
    """«МАЙ 2026» → date(2026, 5, 1)."""
    if not text:
        return None
    if isinstance(text, date):
        return text.replace(day=1)
    parts = str(text).strip().upper().split()
    if len(parts) != 2 or parts[0] not in MONTHS:
        return None
    try:
        return date(int(parts[1]), MONTHS.index(parts[0]) + 1, 1)
    except ValueError:
        return None


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def get_settings(db: Session) -> dict:
    values = dict(DEFAULT_SETTINGS)
    for s in db.scalars(select(models.Setting)):
        values[s.key] = s.value
    return values


def start_date(settings: dict) -> date:
    try:
        return date.fromisoformat(settings.get("start_date") or DEFAULT_SETTINGS["start_date"])
    except ValueError:
        return date.fromisoformat(DEFAULT_SETTINGS["start_date"])


def rate_on(db: Session, d: date) -> Optional[float]:
    """Kurs for a date: the exact row, otherwise the latest earlier one."""
    row = db.scalars(
        select(models.ExchangeRate).where(models.ExchangeRate.date <= d).order_by(models.ExchangeRate.date.desc()).limit(1)
    ).first()
    return row.rate if row else None


def ordered_articles(db: Session) -> list[models.Article]:
    return list(db.scalars(select(models.Article).order_by(models.Article.sort, models.Article.id)))


def ordered_accounts(db: Session) -> list[models.Account]:
    return list(db.scalars(select(models.Account).order_by(models.Account.sort, models.Account.id)))


def fact_transactions(db: Session, is_plan: bool = False) -> list[models.Transaction]:
    return list(db.scalars(select(models.Transaction).where(models.Transaction.is_plan == is_plan)).unique())


def cash_transactions(db: Session) -> list[models.Transaction]:
    """Rows that moved money: dated Cash flow rows (Excel: «Cash flow»!Q = TRUE)."""
    return [t for t in fact_transactions(db) if t.date is not None]


def passes_mode(tx: models.Transaction, mode: str) -> bool:
    if mode == MODE_PROJECTS:
        return tx.project_id is not None
    if mode == MODE_COMPANY:
        return tx.project_id is None
    return True


def effective_pnl_month(tx: models.Transaction, settings: dict) -> Optional[date]:
    """МЕСЯЦ ОПУ (итог): Cash flow!L — optionally the project's close date instead of the P&L month."""
    if settings.get("pnl_use_close_date") == "1" and tx.project is not None:
        return month_start(tx.project.close_date) if tx.project.close_date else None
    return tx.pnl_month


def cash_effect(tx: models.Transaction, account_id: Optional[int]) -> float:
    """Signed effect of one operation on the balance of an account (None = all accounts)."""
    amount = tx.amount or 0
    if tx.kind == INCOME:
        return amount if account_id is None or tx.account_id == account_id else 0
    if tx.kind == EXPENSE:
        return -amount if account_id is None or tx.account_id == account_id else 0
    if tx.kind == TRANSFER and account_id is not None:
        effect = 0.0
        if tx.to_account_id == account_id:
            effect += amount
        if tx.account_id == account_id:
            effect -= amount
        return effect
    return 0


# ---------------------------------------------------------------- category tree

@dataclass
class TreeRow:
    key: str
    level: int  # 1 = category, 2 = subcategory
    type: str
    label: str
    category: str
    article_id: Optional[int] = None
    account_id: Optional[int] = None

    def as_dict(self) -> dict:
        return {
            "key": self.key, "level": self.level, "type": self.type, "label": self.label,
            "category": self.category, "article_id": self.article_id, "account_id": self.account_id,
        }


def build_tree(articles: list[models.Article], accounts: Optional[list[models.Account]] = None) -> list[TreeRow]:
    """Rows of the «ДЛЯ СВОДА» tree: category rows followed by their subcategory rows."""
    rows: list[TreeRow] = []
    for kind in (INCOME, EXPENSE):
        categories: dict[str, list[models.Article]] = {}
        for a in articles:
            if a.type == kind:
                categories.setdefault(a.category, []).append(a)
        for category, items in categories.items():
            rows.append(TreeRow(key=f"{kind}|{category}", level=1, type=kind, label=category, category=category))
            with_sub = [a for a in items if a.subcategory]
            if not with_sub:
                continue
            for a in items:
                rows.append(TreeRow(
                    key=f"a{a.id}", level=2, type=kind, label=a.subcategory or NO_SUBCATEGORY,
                    category=category, article_id=a.id,
                ))
    for acc in accounts or []:
        rows.append(TreeRow(key=f"t{acc.id}", level=1, type=TRANSFER, label=f"ПЕРЕВОД. {acc.name}",
                            category=acc.name, account_id=acc.id))
        rows.append(TreeRow(key=f"t{acc.id}|in", level=2, type=TRANSFER, label="на счет (+)",
                            category=acc.name, account_id=acc.id))
        rows.append(TreeRow(key=f"t{acc.id}|out", level=2, type=TRANSFER, label="со счета (-)",
                            category=acc.name, account_id=acc.id))
    return rows


def tree_keys_for(tx: models.Transaction) -> list[tuple[str, float]]:
    """Tree rows an operation contributes to, with the signed amount for each."""
    amount = tx.amount or 0
    if tx.kind in (INCOME, EXPENSE) and tx.article is not None:
        return [(f"{tx.kind}|{tx.article.category}", amount), (f"a{tx.article.id}", amount)]
    if tx.kind == TRANSFER:
        out = []
        if tx.account_id:
            out += [(f"t{tx.account_id}", -amount), (f"t{tx.account_id}|out", -amount)]
        if tx.to_account_id:
            out += [(f"t{tx.to_account_id}", amount), (f"t{tx.to_account_id}|in", amount)]
        return out
    return []


def involves_account(tx: models.Transaction, account_id: Optional[int]) -> bool:
    if account_id is None:
        return True
    return tx.account_id == account_id or (tx.kind == TRANSFER and tx.to_account_id == account_id)


# ---------------------------------------------------------------- Kassa

def kassa(db: Session, date_from: Optional[date], date_to: Optional[date]) -> dict:
    settings = get_settings(db)
    accounts = ordered_accounts(db)
    txs = cash_transactions(db)
    today = date.today()
    rate = rate_on(db, today)

    rows = []
    for acc in accounts:
        balance = acc.opening_balance + sum(cash_effect(t, acc.id) for t in txs)
        period = [t for t in txs if (date_from is None or t.date >= date_from) and (date_to is None or t.date <= date_to)]
        income = sum(t.amount for t in period if t.kind == INCOME and t.account_id == acc.id)
        expense = sum(t.amount for t in period if t.kind == EXPENSE and t.account_id == acc.id)
        transfers = sum(cash_effect(t, acc.id) for t in period if t.kind == TRANSFER)
        rows.append({
            "account_id": acc.id,
            "account": acc.name,
            "opening_balance": acc.opening_balance,
            "balance": balance,
            "balance_usd": balance / rate if rate else None,
            "period_income": income,
            "period_expense": expense,
            "period_transfers": transfers,
            "period_balance": acc.opening_balance + income - expense + transfers,
        })

    unassigned = [t for t in txs if t.account_id is None and t.kind in (INCOME, EXPENSE)]
    return {
        "today": today.isoformat(),
        "rate": rate,
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "start_date": settings.get("start_date"),
        "rows": rows,
        "total": {
            "balance": sum(r["balance"] for r in rows),
            "balance_usd": (sum(r["balance"] for r in rows) / rate) if rate else None,
            "period_income": sum(r["period_income"] for r in rows),
            "period_expense": sum(r["period_expense"] for r in rows),
            "period_balance": sum(r["period_balance"] for r in rows),
        },
        "unassigned": {
            "count": len(unassigned),
            "net": sum(cash_effect(t, None) for t in unassigned),
        },
    }


# ---------------------------------------------------------------- Cash flow (oylik / kunlik)

def _opening_balance(accounts, txs, account_id: Optional[int], start: date, before: date) -> float:
    base = sum(a.opening_balance for a in accounts if account_id is None or a.id == account_id)
    return base + sum(cash_effect(t, account_id) for t in txs if start <= t.date < before)


def cashflow_matrix(db: Session, columns: list[tuple[date, date]], account_id: Optional[int], mode: str) -> dict:
    """Shared body of «Cash flow oylik» (month columns) and «Cash flow kunlik» (day columns)."""
    settings = get_settings(db)
    start = start_date(settings)
    accounts = ordered_accounts(db)
    articles = ordered_articles(db)
    txs = cash_transactions(db)
    tree = build_tree(articles, accounts)
    today = date.today()

    n = len(columns)
    values: dict[str, list[float]] = defaultdict(lambda: [0.0] * n)
    income = [0.0] * n
    expense = [0.0] * n
    transfers = [0.0] * n

    for t in txs:
        if not passes_mode(t, mode) or not involves_account(t, account_id):
            continue
        idx = next((i for i, (a, b) in enumerate(columns) if a <= t.date <= b), None)
        if idx is None:
            continue
        for key, amount in tree_keys_for(t):
            values[key][idx] += amount
        if t.kind == INCOME:
            income[idx] += t.amount or 0
        elif t.kind == EXPENSE:
            expense[idx] += t.amount or 0
        elif t.kind == TRANSFER and account_id is not None:
            transfers[idx] += cash_effect(t, account_id)

    opening: list[Optional[float]] = []
    closing: list[Optional[float]] = []
    for i, (a, b) in enumerate(columns):
        if mode != MODE_ALL or a > today or b < start:
            opening.append(None)
            closing.append(None)
            continue
        o = _opening_balance(accounts, txs, account_id, start, a)
        opening.append(o)
        closing.append(o + income[i] - expense[i] + transfers[i])

    known_open = [v for v in opening if v is not None]
    known_close = [v for v in closing if v is not None]
    return {
        "columns": [{"from": a.isoformat(), "to": b.isoformat()} for a, b in columns],
        "summary": {
            "opening": opening,
            "closing": closing,
            "income": income,
            "expense": expense,
            "net": [income[i] - expense[i] for i in range(n)],
            "transfers": transfers,
            "total_opening": known_open[0] if known_open else None,
            "total_closing": known_close[-1] if known_close else None,
        },
        "rows": [
            {**r.as_dict(), "values": values[r.key], "total": sum(values[r.key])}
            for r in tree
        ],
    }


def cashflow_monthly(db: Session, year: int, account_id: Optional[int], mode: str) -> dict:
    columns = [(date(year, m, 1), month_end(date(year, m, 1))) for m in range(1, 13)]
    result = cashflow_matrix(db, columns, account_id, mode)
    result["labels"] = MONTHS
    result["year"] = year
    return result


def cashflow_daily(db: Session, month: date, account_id: Optional[int], mode: str) -> dict:
    first = month_start(month)
    days = (month_end(first) - first).days + 1
    columns = [(first + timedelta(days=i), first + timedelta(days=i)) for i in range(days)]
    result = cashflow_matrix(db, columns, account_id, mode)
    result["labels"] = [str(i + 1) for i in range(days)]
    result["month"] = first.isoformat()
    result["month_label"] = month_label(first)
    return result


# ---------------------------------------------------------------- P&L oylik

def pnl_monthly(db: Session, year: int, mode: str) -> dict:
    settings = get_settings(db)
    articles = ordered_articles(db)
    tree = build_tree(articles)

    def collect(txs: Iterable[models.Transaction]):
        values: dict[str, list[float]] = defaultdict(lambda: [0.0] * 12)
        income = [0.0] * 12
        expense = [0.0] * 12
        for t in txs:
            if t.kind not in (INCOME, EXPENSE) or not passes_mode(t, mode):
                continue
            m = effective_pnl_month(t, settings)
            if m is None or m.year != year:
                continue
            i = m.month - 1
            for key, amount in tree_keys_for(t):
                values[key][i] += amount
            if t.kind == INCOME:
                income[i] += t.amount or 0
            else:
                expense[i] += t.amount or 0
        return values, income, expense

    fact, f_income, f_expense = collect(fact_transactions(db))
    plan, p_income, p_expense = collect(fact_transactions(db, is_plan=True))

    return {
        "year": year,
        "labels": [f"{m} {year}" for m in MONTHS],
        "summary": {
            "income": f_income,
            "expense": f_expense,
            "profit": [f_income[i] - f_expense[i] for i in range(12)],
            "plan_income": p_income,
            "plan_expense": p_expense,
            "plan_profit": [p_income[i] - p_expense[i] for i in range(12)],
        },
        "rows": [
            {
                **r.as_dict(),
                "values": fact[r.key],
                "plan": plan[r.key],
                "total": sum(fact[r.key]),
                "plan_total": sum(plan[r.key]),
            }
            for r in tree
        ],
    }


# ---------------------------------------------------------------- P&L (projects)

def project_figures(db: Session) -> dict[int, dict]:
    """ОПЛАЧЕНО ФАКТ / ДОЛГ / РАСХОДЫ / МАРЖА / РЕНТАБЕЛЬНОСТЬ / checks for every project."""
    paid: dict[int, float] = defaultdict(float)
    spent: dict[int, float] = defaultdict(float)
    operations: dict[int, int] = defaultdict(int)
    for t in fact_transactions(db):
        if t.project_id is None:
            continue
        operations[t.project_id] += 1
        if t.kind == INCOME:
            paid[t.project_id] += t.amount or 0
        elif t.kind == EXPENSE:
            spent[t.project_id] += t.amount or 0

    projects = list(db.scalars(select(models.Project)))
    name_count: dict[str, int] = defaultdict(int)
    for p in projects:
        name_count[p.name.strip().lower()] += 1

    out = {}
    for p in projects:
        contract = p.contract_amount or 0
        margin = contract - spent[p.id]
        closed_status = p.status in ("выполнен", "отменен")
        out[p.id] = {
            "paid": paid[p.id],
            "debt": contract - paid[p.id],
            "expenses": spent[p.id],
            "margin": margin,
            "profitability": (margin / contract) if contract else None,
            "operations": operations[p.id],
            "duplicate": name_count[p.name.strip().lower()] > 1,
            "close_error": (bool(p.close_date) and not closed_status) or (not p.close_date and closed_status),
        }
    return out
