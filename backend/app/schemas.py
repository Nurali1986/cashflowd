from pydantic import BaseModel
from datetime import date
from typing import Optional

class TransactionBase(BaseModel):
    date: date
    month_pnl: str
    category: str
    payment_type: str
    usd: Optional[float] = None
    usd_rate: Optional[float] = None
    amount_uzs: float
    project: str
    comment: Optional[str] = None
    type: str

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int

    class Config:
        orm_mode = True
