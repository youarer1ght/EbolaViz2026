"""
Build analysis datasets from CSV source files.

Reads CSV files → validates consistency → outputs JSON for frontend.
No hardcoded data — all data lives in editable CSV files under data/.

Data sources (all CC BY 4.0):
  B.1 - WHO AFRO Weekly SitReps (via kraemer-lab/Ebola_DRC_2026)
  B.2 - WHO Disease Outbreak News (DON 605)
  B.3 - World Bank + HDX population/geographic data
  B.4 - WHO GHO health workforce statistics
  B.5 - ReliefWeb humanitarian/policy data

Usage:
  conda activate EBOLAVIZ
  python3 scripts/build_real_data.py
"""
import csv
import json
import sys
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).parent.parent / "data"
GEO_DIR = DATA_DIR / "geo"

# ── Helpers ──

def read_csv(filename):
    """Read a CSV file, return list of dicts with stripped whitespace."""
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  ❌ Missing: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for i, row in enumerate(reader, start=2):  # line 2 = first data row
            # Strip whitespace from all fields
            cleaned = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            # Skip empty rows
            if not any(cleaned.values()):
                continue
            cleaned["_line"] = i
            rows.append(cleaned)
    return rows


def warn(msg):
    print(f"  ⚠  {msg}")


def ok(msg):
    print(f"  ✓  {msg}")


# ── Validators ──

VALID_POLICY_TYPES = {"lockdown", "vaccination", "aid", "surveillance", "health_response"}


def validate_date(d, context=""):
    try:
        datetime.strptime(d, "%Y-%m-%d")
        return True
    except (ValueError, TypeError):
        warn(f"Invalid date '{d}' — expected YYYY-MM-DD {context}")
        return False


def validate_policy_type(t, context=""):
    if t not in VALID_POLICY_TYPES:
        warn(f"Unknown policy type '{t}' — expected one of {VALID_POLICY_TYPES} {context}")
        return False
    return True


def to_int(val, field, context=""):
    try:
        return int(val)
    except (ValueError, TypeError):
        warn(f"Expected integer for '{field}', got '{val}' {context}")
        return 0


def to_float(val, field, context=""):
    try:
        return float(val)
    except (ValueError, TypeError):
        warn(f"Expected number for '{field}', got '{val}' {context}")
        return 0.0


# ── Data loaders ──

def build_cases():
    """Read cases.csv → list of case dicts."""
    print("\n📊 Loading case data (cases.csv)...")
    rows = read_csv("cases.csv")
    cases = []
    seen = set()

    for r in rows:
        ln = f"(line {r['_line']})"
        validate_date(r.get("date", ""), ln)

        record = {
            "date": r.get("date", ""),
            "country": r.get("country", ""),
            "region": r.get("region", ""),
            "province": r.get("province", ""),
            "new_cases": to_int(r.get("confirmed_cases", 0), "confirmed_cases", ln),
            "new_deaths": to_int(r.get("confirmed_deaths", 0), "confirmed_deaths", ln),
            "suspected_cases": to_int(r.get("suspected_cases", 0), "suspected_cases", ln),
            "suspected_deaths": to_int(r.get("suspected_deaths", 0), "suspected_deaths", ln),
            "source": "WHO AFRO Weekly External Situation Report",
        }

        # Dedup check
        key = (record["date"], record["region"])
        if key in seen:
            warn(f"Duplicate record: {key} {ln} — keeping first")
            continue
        seen.add(key)

        # Required field check
        if not record["region"] or not record["date"]:
            warn(f"Missing required field (region/date) {ln}")
            continue

        cases.append(record)

    dates = sorted(set(c["date"] for c in cases))
    regions = sorted(set(c["region"] for c in cases))
    ok(f"{len(cases)} records, {len(dates)} dates, {len(regions)} regions")
    if dates:
        ok(f"Date range: {dates[0]} ~ {dates[-1]}")

    with open(DATA_DIR / "cases_by_region_date.json", "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=2, ensure_ascii=False)
    return cases


def build_demographics():
    """Read demographics.csv → list of demographic dicts."""
    print("\n👥 Loading demographics (demographics.csv)...")
    rows = read_csv("demographics.csv")
    demos = []

    for r in rows:
        ln = f"(line {r['_line']})"
        record = {
            "country": r.get("country", ""),
            "region": r.get("region", ""),
            "province": r.get("province", ""),
            "population": to_int(r.get("population", 0), "population", ln),
            "population_density": to_float(r.get("population_density", 0), "population_density", ln),
            "urban_pct": to_float(r.get("urban_pct", 0), "urban_pct", ln),
            "doctors_per_100k": to_float(r.get("doctors_per_100k", 0), "doctors_per_100k", ln),
            "beds_per_10k": to_float(r.get("beds_per_10k", 0), "beds_per_10k", ln),
            "health_sites": to_int(r.get("health_sites", 0), "health_sites", ln),
            "source": "World Bank Open Data + WHO GHO + HDX population",
        }
        if not record["region"]:
            warn(f"Missing region name {ln}")
            continue
        demos.append(record)

    ok(f"{len(demos)} regions")
    # Quick stats
    total_pop = sum(d["population"] for d in demos)
    ok(f"Total population: {total_pop/1e6:.1f}M across {len(demos)} health zones")

    with open(DATA_DIR / "demographics.json", "w", encoding="utf-8") as f:
        json.dump(demos, f, indent=2, ensure_ascii=False)
    return demos


def build_policy_events():
    """Read policy_events.csv → list of policy event dicts."""
    print("\n📋 Loading policy events (policy_events.csv)...")
    rows = read_csv("policy_events.csv")
    events = []
    seen_ids = set()

    for r in rows:
        ln = f"(line {r['_line']})"
        pid = r.get("id", "").strip()
        ptype = r.get("type", "").strip().lower()

        if not pid:
            warn(f"Missing id {ln}")
            continue
        if pid in seen_ids:
            warn(f"Duplicate id '{pid}' {ln}")
            continue
        seen_ids.add(pid)

        validate_date(r.get("date", ""), f"id={pid} {ln}")
        validate_policy_type(ptype, f"id={pid} {ln}")

        events.append({
            "id": pid,
            "date": r.get("date", ""),
            "type": ptype,
            "country": r.get("country", ""),
            "region": r.get("region", ""),
            "title": r.get("title", ""),
            "description": r.get("description", ""),
            "source": r.get("source", ""),
        })

    # Sort by date
    events.sort(key=lambda e: e["date"])
    ok(f"{len(events)} events, sorted by date")
    # Count by type
    from collections import Counter
    type_counts = Counter(e["type"] for e in events)
    for t, n in sorted(type_counts.items()):
        ok(f"  {t}: {n}")

    with open(DATA_DIR / "policy_events.json", "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    return events


def build_poe_data():
    """Read border_poe.csv → list of PoE dicts."""
    print("\n🚧 Loading border PoEs (border_poe.csv)...")
    rows = read_csv("border_poe.csv")
    poes = []

    for r in rows:
        ln = f"(line {r['_line']})"
        poes.append({
            "name": r.get("name", ""),
            "lat": to_float(r.get("lat", 0), "lat", ln),
            "lon": to_float(r.get("lon", 0), "lon", ln),
            "country": r.get("country", ""),
            "type": r.get("type", "road"),
        })

    ok(f"{len(poes)} border crossing points")
    with open(DATA_DIR / "border_poe.json", "w", encoding="utf-8") as f:
        json.dump(poes, f, indent=2, ensure_ascii=False)
    return poes


# ── Cross-file validation ──

def cross_validate(cases, demos):
    """Check consistency between datasets."""
    print("\n🔍 Cross-file validation...")

    case_regions = set(c["region"] for c in cases)
    demo_regions = set(d["region"] for d in demos)

    # Regions with cases but no demographics
    missing_demo = case_regions - demo_regions
    if missing_demo:
        warn(f"Regions in cases.csv but NOT in demographics.csv: {missing_demo}")
        warn("  → Add these regions to demographics.csv with population/healthcare data")
    else:
        ok("All case regions have matching demographics")

    # Regions with demographics but no cases (FYI)
    no_cases = demo_regions - case_regions
    if no_cases:
        print(f"  ℹ  {len(no_cases)} regions have demographics but no case data yet: {sorted(no_cases)}")
        print("     (This is normal — at-risk zones without confirmed cases)")

    # Check province names against GeoJSON
    geo_path = GEO_DIR / "outbreak_region.geojson"
    if geo_path.exists():
        geo = json.loads(geo_path.read_text(encoding="utf-8"))
        geo_names = set(f["properties"].get("name", "") for f in geo["features"])

        # Collect all provinces used
        case_provinces = set(c["province"] for c in cases if c["country"] == "COD")
        # For Uganda, the province field is the district name; ADM1 mapping is via uga_district_region_map.json
        # So we only validate DRC province names against GeoJSON

        uga_map_path = GEO_DIR / "uga_district_region_map.json"
        if uga_map_path.exists():
            uga_map = json.loads(uga_map_path.read_text(encoding="utf-8"))
            uga_adm1 = set(uga_map.values())  # Central Region, Western Region, etc.
            geo_uga = geo_names & uga_adm1
            if geo_uga == uga_adm1:
                ok(f"All {len(uga_adm1)} Uganda ADM1 regions found in GeoJSON")
            else:
                missing = uga_adm1 - geo_uga
                if missing:
                    warn(f"Uganda ADM1 regions missing from GeoJSON: {missing}")

        # Check DRC provinces
        drc_in_geo = case_provinces & geo_names
        if drc_in_geo == case_provinces:
            ok(f"All {len(case_provinces)} DRC province names match GeoJSON")
        else:
            missing = case_provinces - geo_names
            if missing:
                warn(f"DRC provinces NOT found in GeoJSON: {missing}")
                warn("  → Check province spelling in cases.csv against outbreak_region.geojson")
    else:
        warn("GeoJSON not found — skipping province name validation")


# ── Main ──

def main():
    print("=" * 60)
    print("EbolaViz2026 — Build Analysis Datasets from CSV")
    print("=" * 60)
    print(f"  Input:  {DATA_DIR}/*.csv")
    print(f"  Output: {DATA_DIR}/*.json")
    print(f"  Sources: WHO AFRO SitReps, WHO DON 605, ReliefWeb,")
    print(f"           World Bank, HDX, geoBoundaries, WHO GHO")

    # ── Build ──
    cases = build_cases()
    demos = build_demographics()
    policies = build_policy_events()
    poes = build_poe_data()

    # ── Cross-validate ──
    cross_validate(cases, demos)

    # ── Summary ──
    print(f"\n{'=' * 60}")
    total = len(cases) + len(demos) + len(policies) + len(poes)
    print(f"✅ Done. {total} total records:")
    print(f"   cases:        {len(cases)} records → data/cases_by_region_date.json")
    print(f"   demographics: {len(demos)} regions → data/demographics.json")
    print(f"   policies:     {len(policies)} events → data/policy_events.json")
    print(f"   border PoEs:  {len(poes)} points → data/border_poe.json")
    print(f"\nData license: CC BY 4.0 — all sources traceable and attributable")


if __name__ == "__main__":
    main()
