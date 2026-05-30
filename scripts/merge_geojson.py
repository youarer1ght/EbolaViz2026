"""
Merge DRC and Uganda ADM1 GeoJSON into a single cross-border outbreak region map.
Normalizes feature names to match our case data province field.

Usage: python3 scripts/merge_geojson.py
"""
import json
from pathlib import Path

GEO_DIR = Path(__file__).parent.parent / "data" / "geo"

# Province name normalization: GeoJSON feature name → our data's province name
# DRC: geoboundaries uses English names, our data uses French/mixed names
DRC_NAME_MAP = {
    "North Kivu": "Nord-Kivu",   # English → French (used in WHO SitReps)
    "South Kivu": "Sud-Kivu",
    "Upper Uele": "Haut-Uele",
    "Lower Uele": "Bas-Uele",
}

# Uganda: our data uses district names, but GeoJSON is ADM1 regions
# Map districts → ADM1 regions for choropleth aggregation
UGA_DISTRICT_TO_REGION = {
    "Kampala": "Central Region",
    "Kisoro": "Western Region",
    "Kanungu": "Western Region",
    "Arua": "Northern Region",
    "Bundibugyo": "Western Region",
}


def merge_geojson():
    """Merge DRC and UGA GeoJSON, normalizing feature names."""
    features = []

    # Load DRC
    with open(GEO_DIR / "DRC.geojson") as f:
        drc = json.load(f)
    for feat in drc["features"]:
        name = feat["properties"].get("shapeName", "")
        # Normalize French/English names to match our data
        normalized = DRC_NAME_MAP.get(name, name)
        feat["properties"]["shapeName"] = normalized
        feat["properties"]["name"] = normalized       # ECharts map default match key
        feat["properties"]["country"] = "COD"
        feat["properties"]["origName"] = name         # Preserve original
        features.append(feat)
    print(f"  DRC: {len(drc['features'])} features")

    # Load UGA
    with open(GEO_DIR / "UGA.geojson") as f:
        uga = json.load(f)
    for feat in uga["features"]:
        feat["properties"]["name"] = feat["properties"]["shapeName"]  # ECharts match key
        feat["properties"]["country"] = "UGA"
        features.append(feat)
    print(f"  UGA: {len(uga['features'])} features")

    merged = {
        "type": "FeatureCollection",
        "features": features,
    }

    outpath = GEO_DIR / "outbreak_region.geojson"
    with open(outpath, "w") as f:
        json.dump(merged, f, ensure_ascii=False)

    mb = outpath.stat().st_size / (1024 * 1024)
    print(f"\n  Merged: {len(features)} features, {mb:.1f} MB → {outpath.name}")


def write_uganda_district_map():
    """Export Uganda district-to-region mapping for JS use."""
    outpath = GEO_DIR / "uga_district_region_map.json"
    with open(outpath, "w") as f:
        json.dump(UGA_DISTRICT_TO_REGION, f, ensure_ascii=False, indent=2)
    print(f"  Uganda district→region map saved to {outpath.name}")


if __name__ == "__main__":
    merge_geojson()
    write_uganda_district_map()
    print("Done.")
