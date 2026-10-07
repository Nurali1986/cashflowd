"""Database tables. Each one mirrors an input area of the original Excel workbook."""
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

INCOME = "ДОХОД"
EXPENSE = "РАСХОД"
TRANSFER = "ПЕРЕВОД"
KINDS = (INCOME, EXPENSE, TRANSFER)

PROJECT_STATUSES = ("новый", "в работе", "приостановлен", "выполнен", "отменен")
# Projects with these statuses drop out of the «Kim uchun» list (настройки AN in the workbook).
INACTIVE_STATUSES = ("приостановлен", "выполнен", "отменен")


class Setting(Base):
    """справочник: ДАТА НАЧАЛА, «Учитывать в ОПУ дату закрытия проекта» and similar flags."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Account(Base):
    """справочник K:M — СЧЕТ and СУММА НА НАЧАЛО."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    opening_balance: Mapped[float] = mapped_column(Float, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Article(Base):
    """Статья: «ДОХОД. Категория. Подкатегория» (справочник C:I, настройки I:Q)."""

    __tablename__ = "articles"
    __table_args__ = (UniqueConstraint("type", "category", "subcategory", name="uq_article"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(200))
    subcategory: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)

    @property
    def full_name(self) -> str:
        name = f"{self.type}. {self.category}"
        if self.subcategory:
            name += f". {self.subcategory}"
        return name


class DirectoryItem(Base):
    """Simple lookup lists from справочник: ЗАКАЗЧИК (customer) and КАТЕГОРИЯ ЗАКАЗА (order_category)."""

    __tablename__ = "directory_items"
    __table_args__ = (UniqueConstraint("kind", "name", name="uq_directory_item"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(200))
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Project(Base):
    """P&L sheet: one row per project (student / contract)."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    customer: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    contract_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Transaction(Base):
    """Cash flow (is_plan=False) and P&L Reja (is_plan=True) rows."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_plan: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # Empty date = P&L-only row (accrual): counted in P&L, not in cash reports — same as a blank «Qaysi sanada».
    date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    pnl_month: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    kind: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    article_id: Mapped[Optional[int]] = mapped_column(ForeignKey("articles.id"), nullable=True, index=True)
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"), nullable=True, index=True)
    to_account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usd_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0)
    project_id: Mapped[Optional[int]] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Problems found while importing the Excel row (e.g. amount typed as text); empty when the row is clean.
    import_warning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    article: Mapped[Optional[Article]] = relationship(lazy="joined")
    account: Mapped[Optional[Account]] = relationship(foreign_keys=[account_id], lazy="joined")
    to_account: Mapped[Optional[Account]] = relationship(foreign_keys=[to_account_id], lazy="joined")
    project: Mapped[Optional[Project]] = relationship(lazy="joined")


class ExchangeRate(Base):
    """Kurs sheet: Sana → Dollar."""

    __tablename__ = "exchange_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    rate: Mapped[float] = mapped_column(Float)
