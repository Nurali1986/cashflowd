from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import engine, get_db
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cashflow P&L API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-csv/")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')), on_bad_lines='skip')
    
    # Process only rows with valid dates
    df = df[df['Qaysi sanada'].notna()]
    added = 0
    for _, row in df.iterrows():
        try:
            type_val = 'ДОХОД' if 'ДОХОД' in str(row.get('Turi (СТАТЬЯ)', '')) else 'РАСХОД'
            amount = float(str(row.get('Summa', 0)).replace(',', '.')) if pd.notna(row.get('Summa')) else 0
            
            # Extract relevant info mapping to our DB model
            transaction = schemas.TransactionCreate(
                date=pd.to_datetime(row['Qaysi sanada']).date(),
                month_pnl=str(row.get('Qaysi oy uchun oyi (P&L)', '')),
                category=str(row.get('Turi (СТАТЬЯ)', '')),
                payment_type=str(row.get("To'lov turi (СЧЕТ)", '')),
                amount_uzs=amount,
                project=str(row.get('Nima uchun(Proyekt)', row.get("Kim uchun tolov (o'quvchi F.I.Sh)", ''))),
                comment=str(row.get('КОММЕНТАРИЙ\nCheck linki', '')),
                type=type_val
            )
            crud.create_transaction(db, transaction)
            added += 1
        except Exception as e:
            print(f"Skipping row error: {e}")
            continue
    return {"message": f"Successfully added {added} transactions"}

@app.get("/")
def read_root():
    return {"message": "Cashflow P&L API is running"}

@app.get("/transactions/", response_model=list[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = crud.get_transactions(db, skip=skip, limit=limit)
    return transactions

@app.get("/dashboard/summary/")
def get_dashboard_summary(db: Session = Depends(get_db)):
    return crud.get_dashboard_summary(db)
