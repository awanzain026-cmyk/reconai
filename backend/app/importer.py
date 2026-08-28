"""ReconAI — CSV parsing for imports (Stage 3).

Turns an uploaded CSV (bank statement OR internal ledger export) into clean
transaction rows. Default column mapping only for now (header name matching);
an explicit column-mapping UI can come later.

Amount handling: a single `amount` column, OR separate `debit`/`credit`
columns (credit positive, debit negative). Parenthesized amounts are negative.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime

DATE_FORMATS = [
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d-%b-%Y",
    "%Y/%m/%d",
    "%b %d, %Y",
    "%d %b %Y",
    "%b %d %Y",
]

DATE_KEYS = {"date", "transactiondate", "postingdate", "valuedate", "txndate", "posteddate"}
AMOUNT_KEYS = {"amount", "transactionamount", "amountusd", "value"}
DEBIT_KEYS = {"debit", "debitamount", "withdrawal", "withdrawals", "payment", "moneyout"}
CREDIT_KEYS = {"credit", "creditamount", "deposit", "deposits", "moneyin"}
DESC_KEYS = {"description", "memo", "payee", "details", "narration", "particulars",
             "transactiondescription", "descriptionoftransaction"}
REF_KEYS = {"reference", "ref", "referencenumber", "refno", "refnumber", "check",
            "checknumber", "chequenumber", "invoicenumber", "invoiceno",
            "transactionid", "transactionref", "transactionreference"}


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _find_col(headers: list[str], keys: set[str]) -> int | None:
    for i, header in enumerate(headers):
        if _norm(header) in keys:
            return i
    return None


def parse_amount(value: str) -> float | None:
    s = str(value).strip().replace(",", "").replace("$", "").replace(" ", "")
    if not s:
        return None
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    try:
        return -float(s) if negative else float(s)
    except ValueError:
        return None


def parse_date(value: str) -> datetime.date | None:
    s = str(value).strip()
    if not s:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_csv(data: bytes) -> tuple[list[dict], list[tuple[str, str]]]:
    """Returns (rows, rejections). Each row is {date, amount, description, reference}.

    rejections is a list of (row_number_or_where, reason).
    """
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        return [], [("1", "file is empty")]
    headers = [h.strip() for h in header]
    if not headers or not any(headers):
        return [], [("1", "no header row found")]

    date_idx = _find_col(headers, DATE_KEYS)
    amount_idx = _find_col(headers, AMOUNT_KEYS)
    debit_idx = _find_col(headers, DEBIT_KEYS)
    credit_idx = _find_col(headers, CREDIT_KEYS)
    desc_idx = _find_col(headers, DESC_KEYS)
    ref_idx = _find_col(headers, REF_KEYS)

    if date_idx is None:
        return [], [("header", "no date column found (expected e.g. 'date')")]
    if amount_idx is None and debit_idx is None and credit_idx is None:
        return [], [("header", "no amount column found (expected 'amount' or debit/credit)")]

    rows: list[dict] = []
    rejections: list[tuple[str, str]] = []

    for row_num, row in enumerate(reader, start=2):
        if not row or all(not c.strip() for c in row):
            continue

        def cell(i: int | None) -> str:
            return row[i].strip() if i is not None and i < len(row) else ""

        day = parse_date(cell(date_idx))
        if day is None:
            rejections.append((str(row_num), f"invalid date: {cell(date_idx)!r}"))
            continue

        if amount_idx is not None:
            amount = parse_amount(cell(amount_idx))
        else:
            debit = parse_amount(cell(debit_idx))
            credit = parse_amount(cell(credit_idx))
            amount = (credit or 0.0) - (debit or 0.0) if debit is not None or credit is not None else None
        if amount is None:
            rejections.append((str(row_num), f"invalid amount: {cell(amount_idx or debit_idx or credit_idx)!r}"))
            continue

        description = cell(desc_idx) or None
        reference = cell(ref_idx) or None
        rows.append({
            "date": day,
            "amount": amount,
            "description": description[:255] if description else None,
            "reference": reference[:255] if reference else None,
        })

    return rows, rejections