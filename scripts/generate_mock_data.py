"""Generate synthetic Ebola outbreak data for DRC and Uganda, 2026."""
import json
import random
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
GEO_DIR = DATA_DIR / "geo"
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ---- Config ----
START_DATE = "2026-01-15"
END_DATE = "2026-05-15"
DATES = []
d = datetime(2026, 1, 15)
while d <= datetime(2026, 5, 15):
    DATES.append(d.strftime("%Y-%m-%d"))
    d += timedelta(days=1)

# DRC and Uganda provinces
REGIONS = {
    "COD": ["Nord-Kivu", "Ituri", "Sud-Kivu", "Tshopo", "Haut-Uele", "Maniema", "Bas-Uele", "Equateur", "Kinshasa", "Kongo-Central"],
    "UGA": ["Kampala", "Wakiso", "Jinja", "Mbale", "Gulu", "Arua", "Mbarara", "Kabale", "Kisoro", "Kanungu"],
}

def generate_cases():
    """Generate daily case counts per region, with realistic outbreak dynamics."""
    records = []
    for country, regions in REGIONS.items():
        for region in regions:
            # Base risk: border regions higher
            is_border = region in ["Nord-Kivu", "Ituri", "Sud-Kivu", "Kisoro", "Kanungu", "Arua"]
            is_urban = region in ["Kinshasa", "Kampala", "Wakiso", "Gulu"]
            base_rate = 0.3 if is_border else 0.05
            urban_mult = 2.5 if is_urban else 1.0

            cumulative = 0
            for i, date in enumerate(DATES):
                # Outbreak peaks around day 60-80
                t = i / len(DATES)
                wave = np.exp(-((t - 0.45) ** 2) / 0.03) * 8 + np.exp(-((t - 0.7) ** 2) / 0.05) * 3
                new_cases = max(0, int(np.random.poisson(base_rate * urban_mult * (1 + wave))))
                new_deaths = max(0, int(new_cases * np.random.beta(2, 20)))  # ~5-10% CFR
                cumulative += new_cases
                records.append({
                    "date": date,
                    "country": "COD" if country == "COD" else "UGA",
                    "region": region,
                    "new_cases": new_cases,
                    "new_deaths": new_deaths,
                    "cumulative_cases": cumulative,
                })
    return records

def generate_demographics():
    """Generate per-province demographic and healthcare data."""
    records = []
    for country, regions in REGIONS.items():
        for i, region in enumerate(regions):
            pop_density = round(random.uniform(15, 500), 1)
            records.append({
                "country": country,
                "region": region,
                "population": random.randint(80000, 1500000),
                "population_density": pop_density,
                "doctors_per_100k": round(random.uniform(0.5, 25.0), 2),
            })
    return records

def generate_policy_events():
    """Generate structured policy/timeline events."""
    events = [
        {"id": "P001", "date": "2026-01-20", "type": "surveillance", "country": "COD", "region": "Nord-Kivu", "title": "Alert: First cases reported in Nord-Kivu", "description": "Local health authorities report cluster of hemorrhagic fever cases.", "source": "WHO AFRO Situation Report"},
        {"id": "P002", "date": "2026-01-25", "type": "surveillance", "country": "COD", "region": "Ituri", "title": "Cases confirmed in Ituri province", "description": "Laboratory confirmation of Ebola (Bundibugyo strain).", "source": "WHO AFRO"},
        {"id": "P003", "date": "2026-02-01", "type": "lockdown", "country": "COD", "region": "Nord-Kivu", "title": "Border restrictions imposed", "description": "DRC restricts movement at Uganda border crossings.", "source": "ReliefWeb"},
        {"id": "P004", "date": "2026-02-10", "type": "vaccination", "country": "COD", "region": "Nord-Kivu", "title": "Ring vaccination campaign launched", "description": "WHO-led vaccination targeting contacts in Nord-Kivu.", "source": "WHO AFRO"},
        {"id": "P005", "date": "2026-02-15", "type": "aid", "country": "COD", "region": "Ituri", "title": "MSF deploys treatment centers", "description": "Médecins Sans Frontières opens Ebola treatment units.", "source": "ACAPS"},
        {"id": "P006", "date": "2026-02-20", "type": "surveillance", "country": "UGA", "region": "Kisoro", "title": "First confirmed case in Uganda", "description": "Cross-border case detected in Kisoro district.", "source": "WHO AFRO"},
        {"id": "P007", "date": "2026-02-25", "type": "lockdown", "country": "UGA", "region": "Kisoro", "title": "Uganda closes border with DRC", "description": "All non-essential cross-border movement halted.", "source": "ReliefWeb"},
        {"id": "P008", "date": "2026-03-05", "type": "vaccination", "country": "UGA", "region": "Kampala", "title": "Vaccination extended to Uganda", "description": "Ring vaccination begins in affected Ugandan districts.", "source": "WHO AFRO"},
        {"id": "P009", "date": "2026-03-15", "type": "aid", "country": "UGA", "region": "Kampala", "title": "International aid package approved", "description": "$50M emergency funding released by World Bank.", "source": "ReliefWeb"},
        {"id": "P010", "date": "2026-04-01", "type": "surveillance", "country": "COD", "region": "Nord-Kivu", "title": "Case decline observed", "description": "New cases drop below 5/day for first time in Nord-Kivu.", "source": "WHO AFRO"},
        {"id": "P011", "date": "2026-04-20", "type": "lockdown", "country": "COD", "region": "Nord-Kivu", "title": "Restrictions partially lifted", "description": "Some border controls eased as transmission declines.", "source": "ACAPS"},
        {"id": "P012", "date": "2026-05-01", "type": "surveillance", "country": "UGA", "region": "Kampala", "title": "Outbreak declared contained in Uganda", "description": "No new cases for 21 days in Uganda.", "source": "WHO AFRO"},
    ]
    return events

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GEO_DIR.mkdir(parents=True, exist_ok=True)

    cases = generate_cases()
    with open(DATA_DIR / "cases_by_region_date.json", "w") as f:
        json.dump(cases, f, indent=2)

    demos = generate_demographics()
    with open(DATA_DIR / "demographics.json", "w") as f:
        json.dump(demos, f, indent=2)

    policies = generate_policy_events()
    with open(DATA_DIR / "policy_events.json", "w") as f:
        json.dump(policies, f, indent=2)

    print(f"Generated: {len(cases)} case records, {len(demos)} province records, {len(policies)} policy events")

if __name__ == "__main__":
    main()
