from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from . import models, schemas
from datetime import datetime

def get_transactions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Transaction).order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()

def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    db_transaction = models.Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def get_dashboard_summary(db: Session):
    # Calculate totals
    income = db.query(func.sum(models.Transaction.amount_uzs)).filter(models.Transaction.type == 'ДОХОД').scalar() or 0
    expense = db.query(func.sum(models.Transaction.amount_uzs)).filter(models.Transaction.type == 'РАСХОД').scalar() or 0
    balance = income - expense
    
    # Monthly aggregation
    monthly_data = db.query(
        extract('year', models.Transaction.date).label('year'),
        extract('month', models.Transaction.date).label('month'),
        models.Transaction.type,
        func.sum(models.Transaction.amount_uzs).label('total')
    ).group_by('year', 'month', models.Transaction.type).all()

    formatted_monthly = []
    current_year = datetime.now().year
    
    return {
        "total_income": income,
        "total_expense": expense,
        "net_balance": balance,
        "monthly_data": [
            {"year": int(row.year), "month": int(row.month), "type": row.type, "total": float(row.total)}
            for row in monthly_data
        ]
    }
