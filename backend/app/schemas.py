import datetime as dt
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _month(value):
    """Accept «2026-05», «2026-05-17» or a date; keep the first day of the month."""
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value.replace(day=1)
    text = str(value)
    if len(text) == 7:
        text += "-01"
    return date.fromisoformat(text).replace(day=1)


class TransactionIn(BaseModel):
    is_plan: bool = False
    date: Optional[dt.date] = None
    pnl_month: Optional[dt.date] = None
    article_id: Optional[int] = None
    account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    usd: Optional[float] = None
    usd_rate: Optional[float] = None
    amount: Optional[float] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    comment: Optional[str] = None
    transfer: bool = False

    _pnl = field_validator("pnl_month", mode="before")(_month)


class TransactionOut(BaseModel):
    id: int
    is_plan: bool
    date: Optional[dt.date]
    pnl_month: Optional[dt.date]
    pnl_month_label: str
    effective_pnl_label: str
    cf_month_label: str
    kind: Optional[str]
    article_id: Optional[int]
    article_name: Optional[str]
    category: Optional[str]
    account_id: Optional[int]
    account_name: Optional[str]
    to_account_id: Optional[int]
    to_account_name: Optional[str]
    usd: Optional[float]
    usd_rate: Optional[float]
    amount: float
    project_id: Optional[int]
    project_name: Optional[str]
    project_close_date: Optional[dt.date]
    comment: Optional[str]
    import_warning: Optional[str]


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    sum_income: float
    sum_expense: float
    sum_transfer: float


class ProjectIn(BaseModel):
    order_date: Optional[dt.date] = None
    name: str
    customer: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    contract_amount: Optional[float] = None
    status: Optional[str] = None
    close_date: Optional[dt.date] = None
    comment: Optional[str] = None


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    paid: float = 0
    debt: float = 0
    expenses: float = 0
    margin: float = 0
    profitability: Optional[float] = None
    operations: int = 0
    duplicate: bool = False
    close_error: bool = False


class AccountIn(BaseModel):
    name: str
    opening_balance: float = 0
    sort: int = 0


class AccountOut(AccountIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ArticleIn(BaseModel):
    type: str
    category: str
    subcategory: Optional[str] = None
    sort: Optional[int] = None


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    category: str
    subcategory: Optional[str]
    sort: int
    full_name: str
    usage: int = 0


class RateIn(BaseModel):
    date: dt.date
    rate: float


class RateOut(RateIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DirectoryIn(BaseModel):
    kind: str
    name: str
    sort: int = 0


class DirectoryOut(DirectoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
