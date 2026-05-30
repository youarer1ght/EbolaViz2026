"""
Generate minimal GeoJSON for affected health zones using approximate
boundary polygons. When team members obtain real admin boundary GeoJSON
from geoboundaries.org or HDX, replace files in data/geo/ with those.

Usage: python3 scripts/generate_geo_placeholder.py
"""
import json
from pathlib import Path

GEO_DIR = Path(__file__).parent.parent / "data" / "geo"
GEO_DIR.mkdir(parents=True, exist_ok=True)

# Approximate polygon outlines for affected health zones
# Each polygon is a rough rectangle/circle around the zone center
# Real boundaries will be more precise from HDX/geoboundaries

def make_rect(lon, lat, w=0.15, h=0.15):
    """Create a simple rectangular polygon around (lon, lat)."""
    return [[
        [lon - w, lat - h],
        [lon + w, lat - h],
        [lon + w, lat + h],
        [lon - w, lat + h],
        [lon - w, lat - h],
    ]]

# Affected health zones with approximate centers
COD_ZONES = {
    "Mongbalu":   [30.05, 1.72],
    "Nyakunde":   [30.10, 1.55],
    "Rwampara":   [30.18, 1.62],
    "Bunia":      [30.25, 1.56],
    "Butembo":    [29.29, 0.13],
    "Katwa":      [29.38, 0.08],
    "Goma":       [29.23, -1.68],
}

UGA_ZONES = {
    "Kampala":    [32.58, 0.32],
    "Kisoro":     [29.68, -1.28],
    "Kanungu":    [29.78, -0.78],
    "Arua":       [30.91, 3.02],
    "Bundibugyo": [30.06, 0.71],
}

def build_geojson(zones, country_code):
    """Build a FeatureCollection GeoJSON from zone definitions."""
    features = []
    for name, (lon, lat) in zones.items():
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "shapeName": name,
                "country": country_code,
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": make_rect(lon, lat, w=0.12, h=0.12),
            },
        })
    return {
        "type": "FeatureCollection",
        "features": features,
    }

def main():
    # Generate DRC GeoJSON
    drc = build_geojson(COD_ZONES, "COD")
    with open(GEO_DIR / "DRC.geojson", "w") as f:
        json.dump(drc, f, indent=2)
    print(f"  DRC.geojson: {len(drc['features'])} zones")

    # Generate Uganda GeoJSON
    uga = build_geojson(UGA_ZONES, "UGA")
    with open(GEO_DIR / "UGA.geojson", "w") as f:
        json.dump(uga, f, indent=2)
    print(f"  UGA.geojson: {len(uga['features'])} zones")

    print("\n⚠  These are APPROXIMATE simplified polygons for development.")
    print("   Replace with real admin boundaries from:")
    print("   https://www.geoboundaries.org/api/current/gbOpen/COD/ADM1/geojson/")
    print("   https://www.geoboundaries.org/api/current/gbOpen/UGA/ADM1/geojson/")
    print("   or https://data.humdata.org/")

if __name__ == "__main__":
    main()
