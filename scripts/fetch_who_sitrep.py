#!/usr/bin/env python3
"""
fetch_who_sitrep.py — Automated WHO AFRO Situation Report data pipeline.

Downloads Bundibugyo Ebola outbreak SitRep PDFs from WHO AFRO,
extracts per-zone cumulative case numbers, and converts to daily
new cases suitable for appending to data/cases.csv.

Usage:
    python3 scripts/fetch_who_sitrep.py              # Download + extract + diff
    python3 scripts/fetch_who_sitrep.py --list       # Show available reports
    python3 scripts/fetch_who_sitrep.py --dry-run    # Download only, no CSV output

Requirements:
    pip install PyPDF2 requests

Output:
    Prints CSV rows (date,country,region,province,confirmed_cases,...) to stdout
    that can be appended to data/cases.csv.

Method:
    1. Fetch https://www.afro.who.int/countries/democratic-republic-of-congo/publications
    2. Parse HTML for Ebola Bundibugyo SitRep links
    3. Extract iris.who.int PDF download URLs
    4. Download PDF → PyPDF2 text extraction
    5. Parse summary table (cumulative confirmed cases/deaths per health zone)
    6. Diff consecutive reports → daily new cases
"""

import re
import sys
import json
import os
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    from PyPDF2 import PdfReader
except ImportError:
    print("ERROR: pip install PyPDF2", file=sys.stderr)
    sys.exit(1)

# ── Configuration ──

WHO_AFRO_PUBS = "https://www.afro.who.int/countries/democratic-republic-of-congo/publications"
CACHE_DIR = Path(__file__).parent.parent / ".cache" / "who_sitrep"
# iris.who.int (DSpace Angular) ONLY accepts this exact UA string.
# Any other UA (including full browser strings) gets the Angular shell HTML.
HEADERS = {"User-Agent": "Mozilla/5.0"}
# For PDF downloads, minimal headers are required — no Referer, no Accept
PDF_HEADERS = {"User-Agent": "Mozilla/5.0"}

# Known health zone → province mapping (eastern DRC outbreak area)
ZONE_PROVINCE = {
    "Mongbwalu": "Ituri", "Mongbalu": "Ituri",
    "Bunia": "Ituri", "Rwampara": "Ituri",
    "Nyakunde": "Ituri", "Nyankunde": "Ituri",
    "Nizi": "Ituri", "Kilo": "Ituri",
    "Aungba": "Ituri", "Damas": "Ituri", "Gety": "Ituri",
    "Komanda": "Ituri", "Lita": "Ituri", "Logo": "Ituri",
    "Mangala": "Ituri",
    "Butembo": "Nord-Kivu", "Katwa": "Nord-Kivu",
    "Beni": "Nord-Kivu", "Kyondo": "Nord-Kivu",
    "Oicha": "Nord-Kivu", "Kalunguta": "Nord-Kivu",
    "Goma": "Nord-Kivu",
    "Miti-Murhesa": "Sud-Kivu",
    "Karisimbi": "Nord-Kivu",
    "Bambu": "Ituri", "Aru": "Ituri",
}


def fetch_sitrep_links():
    """Scrape WHO AFRO publications page for Ebola SitRep PDF URLs.
    Returns list of {title, date, pdf_url, html_url} dicts sorted by date."""
    print(f"Fetching {WHO_AFRO_PUBS} ...", file=sys.stderr)
    resp = requests.get(WHO_AFRO_PUBS, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text

    # Find all Ebola Bundibugyo SitRep publication links
    # Pattern: /countries/.../publication/ebola-bundibugyo-...-situation-...
    reports = []
    seen = set()

    for match in re.finditer(
        r'href="(/countries/(?:democratic-republic-of-congo|uganda)/publication/'
        r'ebola-bundibugyo[^"]*?)"',
        html, re.IGNORECASE
    ):
        path = match.group(1)
        if path in seen:
            continue
        seen.add(path)

        url = f"https://www.afro.who.int{path}"
        print(f"  Found: {url}", file=sys.stderr)

        # Fetch the publication page to get the PDF download link
        try:
            pub_resp = requests.get(url, headers=HEADERS, timeout=30)
            pub_resp.raise_for_status()
            pub_html = pub_resp.text

            # Extract iris.who.int PDF URL
            pdf_match = re.search(
                r'href="(https://iris\.who\.int/bitstreams/[^/]+/download)"',
                pub_html
            )
            if not pdf_match:
                print(f"  WARNING: No PDF link found on {url}", file=sys.stderr)
                continue

            pdf_url = pdf_match.group(1)

            # Extract date from page title or content
            date_match = re.search(
                r'data as of (\d{1,2})\s+(\w+)\s+(\d{4})',
                pub_html, re.IGNORECASE
            )
            if not date_match:
                # Try alternative: "Situation Report 0X, Data as of DD Month YYYY"
                date_match = re.search(
                    r'Data as of (\d{1,2})\s+(\w+)\s+(\d{4})',
                    pub_html, re.IGNORECASE
                )

            months = {
                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                'september': 9, 'october': 10, 'november': 11, 'december': 12
            }
            if date_match:
                day = int(date_match.group(1))
                month_name = date_match.group(2).lower()
                year = int(date_match.group(3))
                month = months.get(month_name, 0)
                if month > 0:
                    report_date = f"{year}-{month:02d}-{day:02d}"
                else:
                    report_date = "unknown"
            else:
                report_date = "unknown"

            # Extract title
            title_match = re.search(r'<title>([^<]+)</title>', pub_html)
            title = title_match.group(1).strip() if title_match else path

            reports.append({
                'title': title,
                'date': report_date,
                'pdf_url': pdf_url,
                'html_url': url,
            })
            print(f"    PDF: {pdf_url}", file=sys.stderr)
            print(f"    Date: {report_date}", file=sys.stderr)

        except Exception as e:
            print(f"  ERROR fetching {url}: {e}", file=sys.stderr)

    reports.sort(key=lambda r: r['date'])
    return reports


def download_pdf(url, cache_key):
    """Download PDF from iris.who.int, with caching."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{cache_key}.pdf"

    if cache_path.exists():
        print(f"  Using cached {cache_path}", file=sys.stderr)
        return cache_path

    print(f"  Downloading {url[:80]}...", file=sys.stderr)
    resp = requests.get(url, headers=PDF_HEADERS, timeout=60)
    resp.raise_for_status()

    cache_path.write_bytes(resp.content)
    print(f"  Saved {len(resp.content)} bytes to {cache_path}", file=sys.stderr)
    return cache_path


def extract_cumulative_data(pdf_path):
    """Extract cumulative case numbers from a WHO SitRep PDF.
    Returns dict: {health_zone_name: {confirmed_cases, confirmed_deaths, suspected_cases}}
    """
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text() or ""
        full_text += text + "\n"

    data = {}

    # Strategy: find health zone names in the text and extract nearby numbers.
    # WHO SitReps typically list zones like:
    #   "Rwampara (32 cases), Bunia (24), Mongbwalu (19), Nyankunde (nine)"
    #
    # Or in table format:
    #   "Mongbwalu 339 suspected cases, including 88 deaths"
    #   "Bunia 249 suspected cases, including 48 deaths"

    # Pattern 1: "ZoneName (N cases)" or "ZoneName (N)"
    zone_case_pattern = re.findall(
        r'([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s*\((\d+)\s*(?:cases?)?\)',
        full_text
    )
    for zone, count in zone_case_pattern:
        if zone in ZONE_PROVINCE:
            if zone not in data:
                data[zone] = {'confirmed_cases': 0, 'confirmed_deaths': 0, 'suspected_cases': 0}
            data[zone]['confirmed_cases'] = max(data[zone]['confirmed_cases'], int(count))

    # Pattern 2: "ZoneName (N suspected cases, including M deaths)"
    zone_suspected = re.findall(
        r'([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s*\((\d+)\s*suspected\s*cases?\s*,?\s*including\s*(\d+)\s*deaths?\)',
        full_text, re.IGNORECASE
    )
    for zone, suspected, deaths in zone_suspected:
        if zone in ZONE_PROVINCE:
            if zone not in data:
                data[zone] = {'confirmed_cases': 0, 'confirmed_deaths': 0, 'suspected_cases': 0}
            data[zone]['suspected_cases'] = max(data[zone]['suspected_cases'], int(suspected))
            data[zone]['confirmed_deaths'] = max(data[zone]['confirmed_deaths'], int(deaths))

    # Pattern 3: Summary table with country totals
    # "Democratic Republic of the Congo 906 223 24.6% 105 10 9.5%"
    summary = re.search(
        r'Democratic Republic of the Congo\s+(\d+)\s+(\d+)\s+[\d.]+\%\s+(\d+)\s+(\d+)\s+[\d.]+\%',
        full_text
    )
    if summary:
        drc_suspected = int(summary.group(1))
        drc_suspected_deaths = int(summary.group(2))
        drc_confirmed = int(summary.group(3))
        drc_confirmed_deaths = int(summary.group(4))
        print(f"  DRC totals: {drc_confirmed} confirmed, {drc_confirmed_deaths} deaths, "
              f"{drc_suspected} suspected", file=sys.stderr)

    return data


def compute_daily_new(prev_data, curr_data, prev_date, curr_date):
    """Convert two consecutive cumulative snapshots to daily new cases.
    Returns list of CSV rows for the period (prev_date, curr_date].
    """
    all_zones = set(list(prev_data.keys()) + list(curr_data.keys()))
    rows = []

    # Distribute the difference evenly across days between reports
    days_between = 1
    try:
        d1 = datetime.strptime(prev_date, "%Y-%m-%d")
        d2 = datetime.strptime(curr_date, "%Y-%m-%d")
        days_between = max(1, (d2 - d1).days)
    except ValueError:
        pass

    for zone in sorted(all_zones):
        prev = prev_data.get(zone, {'confirmed_cases': 0, 'confirmed_deaths': 0, 'suspected_cases': 0})
        curr = curr_data.get(zone, {'confirmed_cases': 0, 'confirmed_deaths': 0, 'suspected_cases': 0})

        new_confirmed = curr['confirmed_cases'] - prev['confirmed_cases']
        new_deaths = curr['confirmed_deaths'] - prev['confirmed_deaths']
        new_suspected = curr['suspected_cases'] - prev['suspected_cases']

        if new_confirmed > 0 or new_deaths > 0 or new_suspected > 0:
            province = ZONE_PROVINCE.get(zone, "Ituri")
            # Assign to the midpoint date
            mid_date = (datetime.strptime(prev_date, "%Y-%m-%d") +
                        timedelta(days=days_between // 2 + 1)).strftime("%Y-%m-%d")

            rows.append({
                'date': mid_date,
                'country': 'COD',
                'region': zone,
                'province': province,
                'confirmed_cases': max(0, new_confirmed),
                'confirmed_deaths': max(0, new_deaths),
                'suspected_cases': max(0, new_suspected),
                'suspected_deaths': 0,
            })

    return rows


def main():
    parser = argparse.ArgumentParser(description="WHO AFRO SitRep data pipeline")
    parser.add_argument('--list', action='store_true', help='List available reports')
    parser.add_argument('--dry-run', action='store_true', help='Download only, no CSV output')
    args = parser.parse_args()

    # Step 1: Fetch SitRep links
    reports = fetch_sitrep_links()

    if not reports:
        print("ERROR: No SitRep links found.", file=sys.stderr)
        sys.exit(1)

    if args.list:
        print("\nAvailable reports:")
        for r in reports:
            print(f"  {r['date']}: {r['title'][:80]}")
            print(f"    PDF: {r['pdf_url']}")
        return

    # Step 2: Download PDFs and extract data
    all_data = {}  # date → {zone → {counts}}
    for r in reports:
        print(f"\nProcessing SitRep dated {r['date']} ...", file=sys.stderr)
        try:
            cache_key = f"sitrep_{r['date']}"
            pdf_path = download_pdf(r['pdf_url'], cache_key)
            cumulative = extract_cumulative_data(pdf_path)
            all_data[r['date']] = cumulative
            print(f"  Extracted data for {len(cumulative)} zones", file=sys.stderr)
            for zone, counts in sorted(cumulative.items()):
                print(f"    {zone}: c={counts['confirmed_cases']} "
                      f"d={counts['confirmed_deaths']} s={counts['suspected_cases']}",
                      file=sys.stderr)
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)

    if args.dry_run:
        print("\nDry run complete. Data extracted:", file=sys.stderr)
        for date, zones in sorted(all_data.items()):
            print(f"  {date}: {len(zones)} zones", file=sys.stderr)
        return

    # Step 3: Compute daily new cases by differencing consecutive reports
    sorted_dates = sorted(all_data.keys())
    print(f"\nComputing daily new cases from {len(sorted_dates)} reports ...", file=sys.stderr)

    all_rows = []
    for i in range(1, len(sorted_dates)):
        prev_date = sorted_dates[i - 1]
        curr_date = sorted_dates[i]
        rows = compute_daily_new(
            all_data[prev_date], all_data[curr_date],
            prev_date, curr_date
        )
        all_rows.extend(rows)
        print(f"  {prev_date} → {curr_date}: {len(rows)} new case rows", file=sys.stderr)

    # Step 4: Output CSV
    if all_rows:
        print("date,country,region,province,confirmed_cases,confirmed_deaths,"
              "suspected_cases,suspected_deaths")
        for row in sorted(all_rows, key=lambda r: (r['date'], r['region'])):
            print(f"{row['date']},{row['country']},{row['region']},{row['province']},"
                  f"{row['confirmed_cases']},{row['confirmed_deaths']},"
                  f"{row['suspected_cases']},{row['suspected_deaths']}")
    else:
        print("WARNING: No new case data extracted. Need at least 2 reports.", file=sys.stderr)


if __name__ == '__main__':
    main()
