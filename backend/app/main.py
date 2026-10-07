import io
import os
from datetime import date
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import logic, models, schemas
from .database import BASE_DIR, Base, SessionLocal, engine, get_db, wait_for_database
from .exporter import export_workbook
from .importer import import_workbook
from .models import EXPENSE, INCOME, TRANSFER

SEED_WORKBOOK = os.path.join(BASE_DIR, "data_source.xlsx")
FRONTEND_DIST = os.getenv("FRONTEND_DIST", os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist"))

wait_for_database()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pifagor Cash flow & P&L")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def seed_from_excel():
    """First start: load the original workbook so the platform opens with the existing data."""
    if os.getenv("SKIP_SEED") == "1" or not os.path.exists(SEED_WORKBOOK):
        return
    with SessionLocal() as db:
        if db.scalar(select(func.count(models.Account.id))) or db.scalar(select(func.count(models.Transaction.id))):
            return
        import_workbook(db, SEED_WORKBOOK)


def _commit(db: Session, what: str = "Yozuv"):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"{what} allaqachon mavjud")


def _get(db: Session, model, obj_id: int):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(404, "Topilmadi")
    return obj


# ---------------------------------------------------------------- meta / settings

@app.get("/api/meta")
def meta(db: Session = Depends(get_db)):
    settings = logic.get_settings(db)
    years = {date.today().year}
    for (d,) in db.execute(select(models.Transaction.date).where(models.Transaction.date.is_not(None))):
        years.add(d.year)
    for (d,) in db.execute(select(models.Transaction.pnl_month).where(models.Transaction.pnl_month.is_not(None))):
        years.add(d.year)
    return {
        "settings": settings,
        "months": logic.MONTHS,
        "years": sorted(years),
        "today": date.today().isoformat(),
        "accounts": [schemas.AccountOut.model_validate(a).model_dump() for a in logic.ordered_accounts(db)],
        "articles": [
            {"id": a.id, "type": a.type, "category": a.category, "subcategory": a.subcategory, "full_name": a.full_name}
            for a in logic.ordered_articles(db)
        ],
        "projects": [
            {"id": p.id, "name": p.name, "customer": p.customer, "close_date": p.close_date}
            for p in db.scalars(select(models.Project).order_by(models.Project.name))
        ],
        "directory": [
            schemas.DirectoryOut.model_validate(d).model_dump()
            for d in db.scalars(select(models.DirectoryItem).order_by(models.DirectoryItem.kind, models.DirectoryItem.sort))
        ],
        "statuses": models.PROJECT_STATUSES,
    }


@app.put("/api/settings")
def update_settings(values: dict[str, Optional[str]], db: Session = Depends(get_db)):
    for key, value in values.items():
        if key not in logic.DEFAULT_SETTINGS:
            raise HTTPException(400, f"Noma'lum sozlama: {key}")
        if key == "start_date":
            date.fromisoformat(value)
        db.merge(models.Setting(key=key, value=value))
    db.commit()
    return logic.get_settings(db)


# ---------------------------------------------------------------- transactions (Cash flow, P&L Reja)

def _tx_out(t: models.Transaction, settings: dict) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=t.id,
        is_plan=t.is_plan,
        date=t.date,
        pnl_month=t.pnl_month,
        pnl_month_label=logic.month_label(t.pnl_month),
        effective_pnl_label=logic.month_label(logic.effective_pnl_month(t, settings)),
        cf_month_label=logic.month_label(t.date),
        kind=t.kind,
        article_id=t.article_id,
        article_name=(t.article.full_name if t.article else
                      (f"ПЕРЕВОД. {t.account.name if t.account else '?'} → {t.to_account.name if t.to_account else '?'}"
                       if t.kind == TRANSFER else None)),
        category=t.article.category if t.article else None,
        account_id=t.account_id,
        account_name=t.account.name if t.account else None,
        to_account_id=t.to_account_id,
        to_account_name=t.to_account.name if t.to_account else None,
        usd=t.usd,
        usd_rate=t.usd_rate,
        amount=t.amount or 0,
        project_id=t.project_id,
        project_name=t.project.name if t.project else None,
        project_close_date=t.project.close_date if t.project else None,
        comment=t.comment,
        import_warning=t.import_warning,
    )


@app.get("/api/transactions", response_model=schemas.TransactionPage)
def list_transactions(
    is_plan: bool = False,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    account_id: Optional[int] = None,
    article_id: Optional[int] = None,
    kind: Optional[str] = None,
    category: Optional[str] = None,
    project_id: Optional[int] = None,
    pnl_month: Optional[str] = None,
    q: Optional[str] = None,
    warnings_only: bool = False,
    cash: Optional[str] = None,
    sort: str = "date_desc",
    limit: int = Query(200, le=5000),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    stmt = select(models.Transaction).where(models.Transaction.is_plan == is_plan)
    if date_from:
        stmt = stmt.where(models.Transaction.date >= date_from)
    if date_to:
        stmt = stmt.where(models.Transaction.date <= date_to)
    if cash == "cash":
        stmt = stmt.where(models.Transaction.date.is_not(None))
    elif cash == "accrual":
        stmt = stmt.where(models.Transaction.date.is_(None))
    if account_id:
        stmt = stmt.where(or_(models.Transaction.account_id == account_id, models.Transaction.to_account_id == account_id))
    if article_id:
        stmt = stmt.where(models.Transaction.article_id == article_id)
    if kind == "none":
        stmt = stmt.where(models.Transaction.kind.is_(None))
    elif kind:
        stmt = stmt.where(models.Transaction.kind == kind)
    if category:
        stmt = stmt.join(models.Article, models.Transaction.article_id == models.Article.id).where(models.Article.category == category)
    if project_id:
        stmt = stmt.where(models.Transaction.project_id == project_id)
    if pnl_month:
        stmt = stmt.where(models.Transaction.pnl_month == schemas._month(pnl_month))
    if warnings_only:
        stmt = stmt.where(models.Transaction.import_warning.is_not(None))

    rows = list(db.scalars(stmt).unique())
    if q:
        needle = q.strip().lower()
        rows = [t for t in rows if needle in " ".join(filter(None, [
            t.comment, t.project.name if t.project else None, t.article.full_name if t.article else None,
            t.account.name if t.account else None, f"{t.amount:.0f}",
        ])).lower()]
    # Dated (cash) rows first, newest on top; undated P&L-only rows after them.
    desc = sort != "date_asc"
    dated = sorted((t for t in rows if t.date), key=lambda t: (t.date, t.id), reverse=desc)
    undated = sorted((t for t in rows if not t.date), key=lambda t: (t.pnl_month or date.min, t.id), reverse=desc)
    rows = dated + undated
    settings = logic.get_settings(db)
    return schemas.TransactionPage(
        items=[_tx_out(t, settings) for t in rows[offset: offset + limit]],
        total=len(rows),
        sum_income=sum(t.amount or 0 for t in rows if t.kind == INCOME),
        sum_expense=sum(t.amount or 0 for t in rows if t.kind == EXPENSE),
        sum_transfer=sum(t.amount or 0 for t in rows if t.kind == TRANSFER),
    )


def _apply_tx(db: Session, t: models.Transaction, data: schemas.TransactionIn):
    t.is_plan = data.is_plan
    t.date = data.date
    t.pnl_month = data.pnl_month or (data.date.replace(day=1) if data.date else None)
    if t.date is None and t.pnl_month is None:
        raise HTTPException(400, "Sana yoki P&L oyini kiriting")
    t.comment = (data.comment or "").strip() or None

    if data.transfer:
        if not data.account_id or not data.to_account_id:
            raise HTTPException(400, "O'tkazma uchun ikkala hisobni tanlang")
        if data.account_id == data.to_account_id:
            raise HTTPException(400, "O'tkazma bir xil hisobga bo'lishi mumkin emas")
        t.kind = TRANSFER
        t.article_id = None
        t.to_account_id = data.to_account_id
    else:
        if not data.article_id:
            raise HTTPException(400, "Статья (Turi) tanlanmagan")
        article = _get(db, models.Article, data.article_id)
        t.kind = article.type
        t.article_id = article.id
        t.to_account_id = None
    if data.account_id:
        _get(db, models.Account, data.account_id)
    t.account_id = data.account_id

    t.usd = data.usd or None
    t.usd_rate = data.usd_rate or None
    if t.usd and not t.usd_rate:
        t.usd_rate = logic.rate_on(db, data.date or t.pnl_month)
    if data.amount is not None:
        t.amount = data.amount
    elif t.usd and t.usd_rate:
        t.amount = t.usd * t.usd_rate
    else:
        raise HTTPException(400, "Summa kiritilmagan")

    if data.project_name and data.project_name.strip():
        name = " ".join(data.project_name.split())
        project = db.scalar(select(models.Project).where(models.Project.name == name))
        if project is None:
            project = models.Project(name=name, sort=(db.scalar(select(func.max(models.Project.sort))) or 0) + 1,
                                     comment="Cash flow kiritishda yangi qo'shildi")
            db.add(project)
            db.flush()
        t.project_id = project.id
    elif data.project_id:
        t.project_id = _get(db, models.Project, data.project_id).id
    else:
        t.project_id = None
    # The row was reviewed by a person, so import warnings no longer apply.
    t.import_warning = None


@app.post("/api/transactions", response_model=schemas.TransactionOut)
def create_transaction(data: schemas.TransactionIn, db: Session = Depends(get_db)):
    t = models.Transaction()
    _apply_tx(db, t, data)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _tx_out(t, logic.get_settings(db))


@app.put("/api/transactions/{tx_id}", response_model=schemas.TransactionOut)
def update_transaction(tx_id: int, data: schemas.TransactionIn, db: Session = Depends(get_db)):
    t = _get(db, models.Transaction, tx_id)
    _apply_tx(db, t, data)
    db.commit()
    db.refresh(t)
    return _tx_out(t, logic.get_settings(db))


@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, models.Transaction, tx_id))
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- projects (P&L)

def _project_out(p: models.Project, figures: dict) -> schemas.ProjectOut:
    out = schemas.ProjectOut.model_validate(p)
    for key, value in figures.get(p.id, {}).items():
        setattr(out, key, value)
    return out


@app.get("/api/projects", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    figures = logic.project_figures(db)
    projects = db.scalars(select(models.Project).order_by(models.Project.sort, models.Project.id))
    return [_project_out(p, figures) for p in projects]


@app.get("/api/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    return _project_out(_get(db, models.Project, project_id), logic.project_figures(db))


def _apply_project(p: models.Project, data: schemas.ProjectIn):
    name = " ".join(data.name.split())
    if not name:
        raise HTTPException(400, "Loyiha nomini kiriting")
    if data.status and data.status not in models.PROJECT_STATUSES:
        raise HTTPException(400, "Noto'g'ri status")
    for key, value in data.model_dump().items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(p, key, value)
    p.name = name


@app.post("/api/projects", response_model=schemas.ProjectOut)
def create_project(data: schemas.ProjectIn, db: Session = Depends(get_db)):
    p = models.Project(sort=(db.scalar(select(func.max(models.Project.sort))) or 0) + 1)
    _apply_project(p, data)
    db.add(p)
    _commit(db, "Bu nomli loyiha")
    return _project_out(p, logic.project_figures(db))


@app.put("/api/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, data: schemas.ProjectIn, db: Session = Depends(get_db)):
    p = _get(db, models.Project, project_id)
    _apply_project(p, data)
    _commit(db, "Bu nomli loyiha")
    return _project_out(p, logic.project_figures(db))


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = _get(db, models.Project, project_id)
    used = db.scalar(select(func.count(models.Transaction.id)).where(models.Transaction.project_id == p.id))
    if used:
        raise HTTPException(409, f"Loyihada {used} ta operatsiya bor — avval ularni o'zgartiring")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- directories (справочник)

@app.post("/api/accounts", response_model=schemas.AccountOut)
def create_account(data: schemas.AccountIn, db: Session = Depends(get_db)):
    acc = models.Account(**data.model_dump())
    acc.name = acc.name.strip()
    db.add(acc)
    _commit(db, "Bu hisob")
    return acc


@app.put("/api/accounts/{account_id}", response_model=schemas.AccountOut)
def update_account(account_id: int, data: schemas.AccountIn, db: Session = Depends(get_db)):
    acc = _get(db, models.Account, account_id)
    acc.name, acc.opening_balance, acc.sort = data.name.strip(), data.opening_balance, data.sort
    _commit(db, "Bu hisob")
    return acc


@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acc = _get(db, models.Account, account_id)
    used = db.scalar(select(func.count(models.Transaction.id)).where(
        or_(models.Transaction.account_id == acc.id, models.Transaction.to_account_id == acc.id)))
    if used:
        raise HTTPException(409, f"Hisobda {used} ta operatsiya bor — o'chirib bo'lmaydi")
    db.delete(acc)
    db.commit()
    return {"ok": True}


@app.get("/api/articles", response_model=list[schemas.ArticleOut])
def list_articles(db: Session = Depends(get_db)):
    usage = dict(db.execute(select(models.Transaction.article_id, func.count(models.Transaction.id))
                            .group_by(models.Transaction.article_id)).all())
    out = []
    for a in logic.ordered_articles(db):
        item = schemas.ArticleOut.model_validate(a)
        item.usage = usage.get(a.id, 0)
        out.append(item)
    return out


def _apply_article(a: models.Article, data: schemas.ArticleIn):
    if data.type not in (INCOME, EXPENSE):
        raise HTTPException(400, "Turi ДОХОД yoki РАСХОД bo'lishi kerak")
    category = " ".join(data.category.split())
    if not category:
        raise HTTPException(400, "Kategoriyani kiriting")
    a.type, a.category = data.type, category
    a.subcategory = " ".join((data.subcategory or "").split()) or None
    if data.sort is not None:
        a.sort = data.sort


@app.post("/api/articles", response_model=schemas.ArticleOut)
def create_article(data: schemas.ArticleIn, db: Session = Depends(get_db)):
    a = models.Article()
    _apply_article(a, data)
    if data.sort is None:
        # Place a new subcategory right after the existing articles of its category.
        same = [x for x in logic.ordered_articles(db) if x.type == a.type and x.category == a.category]
        a.sort = (same[-1].sort if same else (db.scalar(select(func.max(models.Article.sort))) or 0) + 100)
        for later in db.scalars(select(models.Article).where(models.Article.sort > a.sort)):
            later.sort += 1
        a.sort += 1
    db.add(a)
    _commit(db, "Bu статья")
    db.refresh(a)
    return schemas.ArticleOut.model_validate(a)


@app.put("/api/articles/{article_id}", response_model=schemas.ArticleOut)
def update_article(article_id: int, data: schemas.ArticleIn, db: Session = Depends(get_db)):
    a = _get(db, models.Article, article_id)
    _apply_article(a, data)
    for t in db.scalars(select(models.Transaction).where(models.Transaction.article_id == a.id)):
        t.kind = a.type
    _commit(db, "Bu статья")
    return schemas.ArticleOut.model_validate(a)


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    a = _get(db, models.Article, article_id)
    used = db.scalar(select(func.count(models.Transaction.id)).where(models.Transaction.article_id == a.id))
    if used:
        raise HTTPException(409, f"Статья {used} ta operatsiyada ishlatilgan — o'chirib bo'lmaydi")
    db.delete(a)
    db.commit()
    return {"ok": True}


@app.post("/api/directory", response_model=schemas.DirectoryOut)
def create_directory_item(data: schemas.DirectoryIn, db: Session = Depends(get_db)):
    item = models.DirectoryItem(kind=data.kind, name=data.name.strip(), sort=data.sort)
    db.add(item)
    _commit(db, "Bu qiymat")
    return item


@app.put("/api/directory/{item_id}", response_model=schemas.DirectoryOut)
def update_directory_item(item_id: int, data: schemas.DirectoryIn, db: Session = Depends(get_db)):
    item = _get(db, models.DirectoryItem, item_id)
    item.name, item.sort = data.name.strip(), data.sort
    _commit(db, "Bu qiymat")
    return item


@app.delete("/api/directory/{item_id}")
def delete_directory_item(item_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, models.DirectoryItem, item_id))
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- Kurs

@app.get("/api/rates", response_model=list[schemas.RateOut])
def list_rates(db: Session = Depends(get_db)):
    return list(db.scalars(select(models.ExchangeRate).order_by(models.ExchangeRate.date.desc())))


@app.get("/api/rates/lookup")
def lookup_rate(on: date, db: Session = Depends(get_db)):
    return {"date": on, "rate": logic.rate_on(db, on)}


@app.post("/api/rates", response_model=schemas.RateOut)
def upsert_rate(data: schemas.RateIn, db: Session = Depends(get_db)):
    row = db.scalar(select(models.ExchangeRate).where(models.ExchangeRate.date == data.date))
    if row is None:
        row = models.ExchangeRate(date=data.date, rate=data.rate)
        db.add(row)
    else:
        row.rate = data.rate
    db.commit()
    return row


@app.put("/api/rates/{rate_id}", response_model=schemas.RateOut)
def update_rate(rate_id: int, data: schemas.RateIn, db: Session = Depends(get_db)):
    row = _get(db, models.ExchangeRate, rate_id)
    row.date, row.rate = data.date, data.rate
    _commit(db, "Bu sana uchun kurs")
    return row


@app.delete("/api/rates/{rate_id}")
def delete_rate(rate_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, models.ExchangeRate, rate_id))
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- reports

def _mode(mode: str) -> str:
    if mode not in (logic.MODE_ALL, logic.MODE_PROJECTS, logic.MODE_COMPANY):
        raise HTTPException(400, "Noto'g'ri filtr")
    return mode


@app.get("/api/reports/kassa")
def report_kassa(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Session = Depends(get_db)):
    return logic.kassa(db, date_from, date_to)


@app.get("/api/reports/cashflow-monthly")
def report_cashflow_monthly(year: int, account_id: Optional[int] = None, mode: str = "all",
                            db: Session = Depends(get_db)):
    return logic.cashflow_monthly(db, year, account_id, _mode(mode))


@app.get("/api/reports/cashflow-daily")
def report_cashflow_daily(month: str, account_id: Optional[int] = None, mode: str = "all",
                          db: Session = Depends(get_db)):
    return logic.cashflow_daily(db, schemas._month(month), account_id, _mode(mode))


@app.get("/api/reports/pnl-monthly")
def report_pnl_monthly(year: int, mode: str = "all", db: Session = Depends(get_db)):
    return logic.pnl_monthly(db, year, _mode(mode))


# ---------------------------------------------------------------- import / export

@app.post("/api/import")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Faqat .xlsx fayl yuklang")
    content = await file.read()
    try:
        stats = import_workbook(db, io.BytesIO(content))
    except (KeyError, ValueError) as exc:
        db.rollback()
        raise HTTPException(400, f"Faylni o'qib bo'lmadi: {exc}")
    return stats


@app.get("/api/export")
def export_excel(db: Session = Depends(get_db)):
    filename = f"Pifagor-Cashflow-PL-{date.today().isoformat()}.xlsx"
    return Response(
        export_workbook(db),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------- built frontend (production)

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = os.path.join(FRONTEND_DIST, path)
        if path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
