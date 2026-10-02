"""Official-source snapshot builder. Python 3.10+ and xlrd 2.0.1.

All downloads and validation finish before atomic snapshot replacement.
Use --replay DIR to rebuild from the five archived official-source files.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import tempfile
import urllib.request
import xlrd

ROOT = Path(__file__).resolve().parent.parent
URLS = {f"{geo}-{freq}.xls": f"https://www.eia.gov/dnav/pet/hist_xls/EMM_EPMR_PTE_{state}_DPG{freq}.xls"
        for geo, state in [("ca", "SCA"), ("us", "NUS")] for freq in ["w", "m"]}
URLS["bls-all-items.txt"] = "https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems"


def prices(path, geo, frequency, today):
    book = xlrd.open_workbook(path)
    sheet = book.sheet_by_name("Data 1")
    series = f"EMM_EPMR_PTE_{'SCA' if geo == 'ca' else 'NUS'}_DPG"
    if sheet.cell_value(1, 1) != series or "Regular All Formulations" not in sheet.cell_value(2, 1):
        raise ValueError(f"Wrong series/product: {path.name}")
    if "Dollars per Gallon" not in sheet.cell_value(2, 1):
        raise ValueError("Wrong units")
    records = {}
    for i in range(3, sheet.nrows):
        date_cell, value = sheet.cell_value(i, 0), sheet.cell_value(i, 1)
        date = xlrd.xldate_as_datetime(date_cell, book.datemode).date()
        period = date.isoformat() if frequency == "w" else date.strftime("%Y-%m")
        if period in records:
            raise ValueError(f"Duplicate period: {period}")
        if date > today:
            raise ValueError(f"Future observation: {period}")
        if frequency == "w" and date.weekday() != 0:
            raise ValueError(f"Unexpected weekly observation day: {period}")
        if value in ("", "NA", "N/A", "--"):
            records[period] = None
        elif not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"Invalid price at {period}: {value!r}")
        else:
            records[period] = float(value)
    if len(records) < (1000 if frequency == "w" else 250):
        raise ValueError("Unexpectedly truncated price history")
    return records


def cpi(path, today):
    result = {}
    for line in path.read_text().splitlines()[1:]:
        cells = line.split()
        if len(cells) < 4 or cells[0] != "CUUR0000SA0" or not cells[2].startswith("M"):
            continue
        month = int(cells[2][1:])
        if not 1 <= month <= 12:
            continue  # M13 is an annual average, never a calendar-month observation.
        period = f"{cells[1]}-{month:02d}"
        if cells[3] in ('-', 'NA', 'N/A'):
            continue  # Missing CPI is unavailable, never zero or carried forward.
        value = float(cells[3])
        if period in result or not math.isfinite(value) or value <= 0:
            raise ValueError(f"Duplicate/invalid CPI at {period}")
        if period >= today.strftime("%Y-%m"):
            raise ValueError(f"Uncompleted/future CPI period: {period}")
        result[period] = value
    if len(result) < 300:
        raise ValueError("Missing/truncated CPI series")
    return result


def assemble(raw, today, retrieved):
    all_prices = {(g, f): prices(raw / f"{g}-{f}.xls", g, f, today)
                  for g in ("ca", "us") for f in ("w", "m")}
    result = {}
    coverage = {}
    for frequency, name in [("w", "weekly"), ("m", "monthly")]:
        ca, us = all_prices[("ca", frequency)], all_prices[("us", frequency)]
        start = "2000-05-22" if frequency == "w" else "2000-06"
        end = max(ca)
        periods = []
        cursor = dt.date.fromisoformat(start if frequency == "w" else start + "-01")
        while True:
            period = cursor.isoformat() if frequency == "w" else cursor.strftime("%Y-%m")
            if period > end:
                break
            if frequency == "w" or period < today.strftime("%Y-%m"):
                periods.append(period)
            if frequency == "w":
                cursor += dt.timedelta(days=7)
            else:
                cursor = dt.date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
        rows = [{"period": p, "ca": ca.get(p), "us": us.get(p)} for p in periods]
        valid = [r for r in rows if r["ca"] is not None and r["us"] is not None]
        if not valid:
            raise ValueError("No shared price observations")
        result[name] = rows
        coverage[name] = {"first": valid[0]["period"], "last": valid[-1]["period"], "rows": len(rows),
                          "missingPeriods": [r["period"] for r in rows if r["ca"] is None or r["us"] is None]}
    cpis = cpi(raw / "bls-all-items.txt", today)
    result["cpi"] = [{"period": p, "value": v} for p, v in sorted(cpis.items()) if p >= "2000-06"]
    shared_real = [r for r in result["monthly"] if r["ca"] is not None and r["us"] is not None and r["period"] in cpis]
    if not shared_real:
        raise ValueError("No common monthly price/CPI coverage")
    raw_hashes = {name: hashlib.sha256((raw / name).read_bytes()).hexdigest() for name in URLS}
    canonical = json.dumps({**result, "rawHashes": raw_hashes}, sort_keys=True, separators=(",", ":"))
    snapshot_id = "eia-bls-" + hashlib.sha256(canonical.encode()).hexdigest()[:16]
    cpi_periods = sorted(p for p in cpis if p >= '2000-06')
    cpi_coverage = {"first": cpi_periods[0], "last": cpi_periods[-1], "rows": len(cpi_periods),
                    "missingPeriods": [r['period'] for r in result['monthly'] if r['period'] <= cpi_periods[-1] and r['period'] not in cpis]}
    return {"schemaVersion": 1, "snapshotId": snapshot_id, "retrievedAt": retrieved,
            "cpiCoverage": cpi_coverage,
            "coverage": coverage, "realEndpoint": shared_real[-1]["period"],
            "sources": [{"file": name, "url": url, "sha256": raw_hashes[name], "retrievedAt": retrieved} for name, url in URLS.items()],
            "series": {"ca": "EMM_EPMR_PTE_SCA_DPG", "us": "EMM_EPMR_PTE_NUS_DPG", "cpi": "CUUR0000SA0"},
            "excluded": {"monthly": ["2000-05"], "reason": "California series began partway through May 2000; partial initial month excluded."},
            "validation": {"status": "passed", "checks": ["series/product/units", "positive finite values", "duplicates", "future dates", "coverage", "completed months", "common endpoints", "missing periods retained"]},
            **result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data/snapshot.json")
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    today = now.date()
    retrieved = now.isoformat()
    (ROOT / "data").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="refresh-", dir=ROOT / "data") as directory:
        raw = Path(directory)
        if args.replay:
            for name in URLS:
                shutil.copyfile(args.replay / name, raw / name)
        else:
            def fetch(item):
                name, url = item
                request = urllib.request.Request(url, headers={"User-Agent": "CaliforniaGasPriceExplorer/0.1 (official-data-research)"})
                error = None
                for _ in range(3):
                    try:
                        with urllib.request.urlopen(request, timeout=45) as response:
                            (raw / name).write_bytes(response.read())
                        return
                    except Exception as exc:
                        error = exc
                raise RuntimeError(f"Could not retrieve {name}") from error
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
                list(pool.map(fetch, URLS.items()))
        snapshot = assemble(raw, today, retrieved)
        if args.output.exists():
            previous = json.loads(args.output.read_text())
            for frequency in ("weekly", "monthly"):
                if snapshot["coverage"][frequency]["last"] < previous["coverage"][frequency]["last"]:
                    raise ValueError("New download would regress coverage; previous snapshot retained")
        archived = ROOT / "data/raw" / snapshot["snapshotId"]
        archived.parent.mkdir(exist_ok=True)
        if not archived.exists():
            shutil.copytree(raw, archived)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        pending = args.output.with_suffix(".pending")
        with pending.open("w") as stream:
            json.dump(snapshot, stream, separators=(",", ":"), allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(pending, args.output)
        print(json.dumps({"snapshotId": snapshot["snapshotId"], "coverage": snapshot["coverage"], "realEndpoint": snapshot["realEndpoint"]}))


if __name__ == "__main__":
    main()
