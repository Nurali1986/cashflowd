from sqlalchemy import Column, Integer, String, Float, Date, Text
from .database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    month_pnl = Column(String, index=True)
    category = Column(String, index=True)
    payment_type = Column(String)
    usd = Column(Float, nullable=True)
    usd_rate = Column(Float, nullable=True)
    amount_uzs = Column(Float)
    project = Column(String, index=True)
    comment = Column(Text, nullable=True)
    type = Column(String) # 'ДОХОД' or 'РАСХОД'
