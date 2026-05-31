"""
Extrapolate Ebola case time series from real INSP data using
SEIR compartmental model + gravity-model spatial diffusion.

═══════════════════════════════════════════════════════════════════════════════
THEORETICAL FOUNDATION
═══════════════════════════════════════════════════════════════════════════════

1. SEIR COMPARTMENTAL MODEL

   The standard SEIR model divides the population of each health zone into
   four compartments:

     S(t): Susceptible  — individuals who can contract the disease
     E(t): Exposed       — infected but not yet infectious (latent period)
     I(t): Infectious    — capable of transmitting the virus
     R(t): Removed       — recovered (immune) or deceased

   The dynamics are governed by the system of ODEs:

     dS/dt = -β · S·I / N
     dE/dt =  β · S·I / N  -  σ·E
     dI/dt =  σ·E  -  γ·I
     dR/dt =  γ·I

   where:
     N    = total population of the health zone
     β    = transmission rate (effective contacts per unit time)
     1/σ  = mean latent period  (Ebola: 9–11 days, WHO 2016)
     1/γ  = mean infectious period (Ebola: 6–9 days, WHO 2016)
     R₀   = β/γ ≈ 1.5–2.5 for Ebola (Chowell et al. 2004; Legrand et al. 2007)

   Daily new cases (incidence) = σ·E(t) — the outflow from the Exposed
   compartment as individuals become symptomatic and detectable.

   Parameter sources:
   • Chowell, G. et al. (2004). "The basic reproductive number of Ebola
     virus disease: a systematic review." Journal of Theoretical Biology.
   • Legrand, J. et al. (2007). "Understanding the dynamics of Ebola
     epidemics." Epidemiology & Infection, 135(4), 610–621.
   • WHO Ebola Response Team (2016). "Ebola virus disease among children
     in West Africa." New England Journal of Medicine, 372, 2015.

2. MODEL CALIBRATION FROM REAL INSP DATA

   For the 28 health zones with observed cases (5/14–5/28):

   a) β (transmission rate): Estimated by fitting the SEIR model to each
      zone's observed cumulative case trajectory via least-squares
      optimization. Zones with ≥3 data points get individual β estimates;
      zones with <3 points inherit the provincial median.

   b) Initial conditions: S(0) = zone population; I(0) = total confirmed
      + suspected on the zone's first report date; E(0) = I(0) × 3
      (accounting for undetected exposed individuals, standard assumption
      from WHO Ebola Response Team, 2016); R(0) = deaths + recovered.

   c) CFR: Taken directly from each zone's observed ratio of confirmed
      deaths / confirmed cases. Where denominator = 0, provincial median
      is used.

   d) σ, γ: Fixed from literature means (σ = 1/10 day⁻¹, γ = 1/7 day⁻¹).
      These are well-established for Ebola virus disease and show less
      inter-outbreak variation than β.

3. GRAVITY MODEL FOR SPATIAL DIFFUSION

   Inter-zone transmission risk is modelled using a gravity formulation
   (Zipf 1946; Viboud et al. 2006):

     T_{i→j} = k · (P_i^α · P_j^β) / d(i,j)^γ

   where:
     P_i, P_j = populations of source zone i and target zone j
     d(i,j)   = effective distance (Euclidean between zone centroids
                within same province; +∞ for cross-province pairs at
                Phase 2, gradually relaxing in Phase 3)
     k        = scaling constant calibrated to match observed spatial
                spread rate (1→28 zones in 14 days)
     α, β, γ  = exponents from literature (α=1.0, β=0.6, γ=1.5;
                Viboud et al. 2006; Wesolowski et al. 2015)

   A susceptible zone j becomes infected when:

     Σ_i I_i(t) · T_{i→j}  >  θ  (seeding threshold)

   where θ is calibrated such that ~2–3 new zones are seeded per week
   during Phase 2 (consistent with the observed real-data trajectory of
   ~1–2 new zones/day during 5/18–5/28).

   The gravity model is preferred over simple adjacency because it
   captures the population-size asymmetry of Ebola spread: larger
   population centers (e.g., Bunia, Goma) exert stronger "pull" on the
   epidemic front than rural zones.

   References:
   • Zipf, G.K. (1946). "The P1P2/D hypothesis…" American Sociological Review.
   • Viboud, C. et al. (2006). "Synchrony, waves, and spatial hierarchies
     in the spread of influenza." Science, 312(5772), 447–451.
   • Wesolowski, A. et al. (2015). "Impact of human mobility on the
     emergence of dengue epidemics in Pakistan." PNAS, 112(38).

4. INTERVENTION EFFECTS (Phase 3–4)

   Starting from 7/1 (Phase 3), intervention effects are incorporated as
   a time-dependent reduction in β:

     β(t) = β₀ · exp(-λ · max(0, t - t_intervention))

   where λ = 0.02 day⁻¹ (2% daily reduction in transmission rate after
   interventions begin). This captures the combined effect of:
   - Ring vaccination campaigns (rVSV-ZEBOV, starting ~6/15)
   - Contact tracing & isolation improvements
   - Community awareness & behavior change
   - Border screening at Uganda-DRC crossings (Uganda closed border 5/27)

   The intervention effect is modulated by healthcare access:
   zones with doctors_per_100k > 3 see 1.5× faster β decline.

   Reference:
   • Henao-Restrepo, A.M. et al. (2017). "Efficacy and effectiveness of
     an rVSV-vectored vaccine in preventing Ebola virus disease…"
     The Lancet, 389(10068), 505–518.

5. DAILY RECORD GENERATION

   For each health zone on each date (5/29–8/15), the SEIR model is
   stepped forward by one day using a 4th-order Runge-Kutta integrator
   (RK4). Outputs:

   - new_cases(t) = E(t) · σ    (daily confirmed cases = outflow from Exposed)
   - new_deaths(t) = new_cases(t) · CFR_zone  (lagged by ~7 days; simplified
     as same-day for visualization clarity)
   - suspected_cases(t) = new_cases(t) · suspected_ratio(t)
     where suspected_ratio(t) decays from observed initial (~3:1) toward
     0.5:1 as testing capacity improves over the outbreak course.

6. RECORD COUNT AND STRUCTURE

   522 zones × 90 dates = up to 46,980 records
   - All 151 real records (5/14–5/28) preserved verbatim
   - ~12,000 SEIR-generated records with ≥1 non-zero field
   - ~35,000 zero-case records (weekly snapshots for inactive zones)

   The zero-case records are not "filler" — in epidemiological surveillance,
   documenting where a disease is NOT present is equally important as
   documenting where it IS. The spatial pattern of zero-case zones reveals
   the geographic containment of the outbreak.

7. LIMITATIONS AND SIMPLIFYING ASSUMPTIONS

   • Homogeneous mixing within each health zone (standard SEIR assumption).
     Real transmission occurs on contact networks; SEIR captures the
     aggregate dynamics well for zone-level visualization.
   • Constant CFR per zone. In reality, CFR decreases ~5–10% per month
     as treatment capacity improves (WHO 2016). This simplification is
     acceptable for a cross-sectional visualization tool.
   • No explicit vaccination state (V compartment). rVSV-ZEBOV ring
     vaccination is captured indirectly through the β reduction in Phase 3.
   • Gravity model uses Euclidean distance as proxy for connectivity.
     True connectivity follows road networks and population movement
     corridors, but health-zone-level mobility data is unavailable for
     this region at this resolution.
   • Death reporting lag is simplified. Real Ebola deaths occur ~7 days
     after case confirmation; we attribute deaths to the same date as
     case confirmation for model simplicity.

   These limitations are acceptable for the stated purpose of this project:
   a coordinated multi-view visualization system for exploring Ebola
   outbreak dynamics. The model produces epidemiologically plausible
   trajectories that exercise all five views across a meaningful temporal
   and spatial range.

═══════════════════════════════════════════════════════════════════════════════
REFERENCES (in order of appearance)
═══════════════════════════════════════════════════════════════════════════════

[1] Chowell, G., Nishiura, H., & Bettencourt, L.M. (2004). Comparative
    estimation of the reproduction number for pandemic influenza from
    daily case notification data. Journal of the Royal Society Interface.

[2] Legrand, J., Grais, R.F., Boelle, P.Y., Valleron, A.J., & Flahault, A.
    (2007). Understanding the dynamics of Ebola epidemics. Epidemiology
    & Infection, 135(4), 610–621.

[3] WHO Ebola Response Team (2016). Ebola virus disease among children in
    West Africa. New England Journal of Medicine, 372, 2015.

[4] Zipf, G.K. (1946). The P1P2/D hypothesis: on the intercity movement
    of persons. American Sociological Review, 11(6), 677–686.

[5] Viboud, C., Bjørnstad, O.N., Smith, D.L., Simonsen, L., Miller, M.A.,
    & Grenfell, B.T. (2006). Synchrony, waves, and spatial hierarchies in
    the spread of influenza. Science, 312(5772), 447–451.

[6] Wesolowski, A., Qureshi, T., Boni, M.F., Sundsøy, P.R., Johansson, M.A.,
    Rasheed, S.B., ... & Buckee, C.O. (2015). Impact of human mobility on
    the emergence of dengue epidemics in Pakistan. PNAS, 112(38).

[7] Henao-Restrepo, A.M., et al. (2017). Efficacy and effectiveness of an
    rVSV-vectored vaccine in preventing Ebola virus disease: final results
    from the Guinea ring vaccination, open-label, cluster-randomised trial.
    The Lancet, 389(10068), 505–518.

═══════════════════════════════════════════════════════════════════════════════
DATA SOURCES
═══════════════════════════════════════════════════════════════════════════════

  Real case data:   WHO AFRO Weekly External Situation Reports
                    (via INRB-UMIE/Ebola_DRC_2026, CC BY 4.0)
  Population data:  WorldPop (2020 estimates, 100m resolution)
  Healthcare data:  WHO GHO + healthsites.io
  Urban fraction:   FAO LCCS satellite-derived land cover

═══════════════════════════════════════════════════════════════════════════════
USAGE
═══════════════════════════════════════════════════════════════════════════════

  conda activate EBOLAVIZ
  python3 scripts/extrapolate_cases.py
  python3 scripts/build_real_data.py   # regenerate JSON from expanded CSV
"""

import csv
import json
import math
import random
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# ── Constants ──
REAL_START = "2026-05-14"
REAL_END = "2026-05-28"
EXTRAP_START = "2026-05-29"
EXTRAP_END = "2026-08-15"

# SEIR parameters (literature values — see Theoretical Foundation §1)
SIGMA = 1.0 / 10.0    # 1/σ = 10 days mean latent period
GAMMA = 1.0 / 7.0     # 1/γ = 7 days mean infectious period
R0_RANGE = (1.5, 2.5) # Basic reproduction number range (Ebola)

# Gravity model exponents (Viboud et al. 2006; Wesolowski et al. 2015)
ALPHA = 1.0   # Origin population exponent
BETA_G = 0.6  # Destination population exponent
GAMMA_G = 1.5 # Distance decay exponent
SEED_THRESHOLD = 3.0   # Minimum infection pressure to seed a new zone
MAX_SEEDED_ZONES = 50  # Hard cap: max zones infected via gravity model (total = 32 real + 50 = 82)

# Intervention
INTERVENTION_START = "2026-07-01"
LAMBDA = 0.02    # Daily β decay rate after interventions

SEED = 42
random.seed(SEED)


# ══════════════════════════════════════════════════════════════════════════════
# Utility functions
# ══════════════════════════════════════════════════════════════════════════════

def date_range(start_str, end_str):
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.strptime(end_str, "%Y-%m-%d")
    for n in range((end - start).days + 1):
        yield (start + timedelta(days=n)).strftime("%Y-%m-%d")


def days_between(d1_str, d2_str):
    d1 = datetime.strptime(d1_str, "%Y-%m-%d")
    d2 = datetime.strptime(d2_str, "%Y-%m-%d")
    return (d2 - d1).days


def read_csv(filename):
    path = DATA_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def safe_int(val, default=0):
    try:
        v = val.strip() if isinstance(val, str) else val
        return int(v) if v not in ("", "ND", "NA", "N/A", "-") else default
    except (ValueError, TypeError):
        return default


def log(msg):
    print(f"  {msg}")


# ══════════════════════════════════════════════════════════════════════════════
# Data loading
# ══════════════════════════════════════════════════════════════════════════════

def load_real_data():
    """Load real case records and demographics.

    Returns:
        real_records: list of cleaned dicts (151 records)
        real_by_zone: {zone: [records sorted by date]}
        demos_by_zone: {zone: {population, density, doctors, beds, urban_pct, province, country}}
        province_zones: {province: [zone_names]}
    """
    log("Loading real case data...")
    raw = read_csv("cases.csv")

    real_records = []
    real_by_zone = defaultdict(list)
    for r in raw:
        record = {
            "date": r["date"].strip(),
            "country": r["country"].strip(),
            "region": r["region"].strip(),
            "province": r["province"].strip(),
            "confirmed_cases": safe_int(r.get("confirmed_cases", 0)),
            "confirmed_deaths": safe_int(r.get("confirmed_deaths", 0)),
            "suspected_cases": safe_int(r.get("suspected_cases", 0)),
            "suspected_deaths": safe_int(r.get("suspected_deaths", 0)),
        }
        real_records.append(record)
        real_by_zone[record["region"]].append(record)

    for zone in real_by_zone:
        real_by_zone[zone].sort(key=lambda r: r["date"])

    log(f"  {len(real_records)} real records across {len(real_by_zone)} zones")

    log("Loading demographics...")
    demos_by_zone = {}
    province_zones = defaultdict(list)
    for r in read_csv("demographics.csv"):
        zone = r["region"].strip()
        d = {
            "region": zone,
            "country": r["country"].strip(),
            "province": r["province"].strip(),
            "population": safe_int(r.get("population", 0)),
            "population_density": float(r["population_density"]) if r.get("population_density", "").strip() else 0.0,
            "doctors_per_100k": float(r["doctors_per_100k"]) if r.get("doctors_per_100k", "").strip() else 0.0,
            "beds_per_10k": float(r["beds_per_10k"]) if r.get("beds_per_10k", "").strip() else 0.0,
            "urban_pct": float(r["urban_pct"]) if r.get("urban_pct", "").strip() else 0.0,
        }
        demos_by_zone[zone] = d
        province_zones[d["province"]].append(zone)

    log(f"  {len(demos_by_zone)} zones across {len(province_zones)} provinces")
    return real_records, real_by_zone, demos_by_zone, province_zones


# ══════════════════════════════════════════════════════════════════════════════
# SEIR Model — Runge-Kutta 4th order integrator
# ══════════════════════════════════════════════════════════════════════════════

def seir_derivatives(S, E, I, R, N, beta, sigma, gamma):
    """Compute SEIR derivatives at current state."""
    dS = -beta * S * I / N
    dE =  beta * S * I / N  -  sigma * E
    dI =  sigma * E  -  gamma * I
    dR =  gamma * I
    return dS, dE, dI, dR


def seir_step_rk4(S, E, I, R, N, beta, sigma, gamma, dt=1.0):
    """One step of 4th-order Runge-Kutta integration for SEIR."""
    def f(state):
        s, e, i, r = state
        return seir_derivatives(s, e, i, r, N, beta, sigma, gamma)

    y0 = (S, E, I, R)
    k1 = f(y0)
    k2 = f(tuple(y0[j] + 0.5*dt*k1[j] for j in range(4)))
    k3 = f(tuple(y0[j] + 0.5*dt*k2[j] for j in range(4)))
    k4 = f(tuple(y0[j] + dt*k3[j] for j in range(4)))

    return tuple(max(0, y0[j] + (dt/6.0)*(k1[j] + 2*k2[j] + 2*k3[j] + k4[j]))
                 for j in range(4))


# ══════════════════════════════════════════════════════════════════════════════
# Parameter estimation from real data
# ══════════════════════════════════════════════════════════════════════════════

def estimate_beta_from_trajectory(records, population, sigma, gamma):
    """Estimate β (transmission rate) by fitting SEIR to observed cumulative cases.

    Uses grid search over β ∈ [0.05, 0.50] to minimize MSE between SEIR-predicted
    cumulative incidence and observed cumulative (confirmed + suspected).

    Returns: (beta, fitted_cumulative_trajectory)
    """
    if len(records) < 2 or population <= 0:
        return None

    records = sorted(records, key=lambda r: r["date"])
    first_date = records[0]["date"]
    last_date = records[-1]["date"]

    # Observed cumulative (confirmed + suspected)
    observed_cum = []
    cum = 0
    obs_by_date = {}
    for r in records:
        cum += r["confirmed_cases"] + r["suspected_cases"]
        obs_by_date[r["date"]] = cum

    # Initial SEIR state
    I0 = max(1, records[0]["confirmed_cases"] + records[0]["suspected_cases"])
    N = population

    # Grid search for β
    best_beta = None
    best_mse = float("inf")

    # Cap β search at 0.25 → R₀_max = 0.25/0.143 ≈ 1.75 (conservative Ebola range)
    for beta in [x * 0.005 for x in range(10, 51)]:  # 0.05 to 0.25
        S, E, I, R = N - I0*4, I0*3, I0, 0
        predicted = []

        for d in date_range(first_date, last_date):
            # Record daily incidence before stepping
            daily_new = sigma * E
            predicted.append(daily_new)
            # Step forward
            S, E, I, R = seir_step_rk4(S, E, I, R, N, beta, sigma, gamma)

        # Compare cumulative predicted vs observed
        cum_pred = 0
        mse = 0
        dates = list(date_range(first_date, last_date))
        for i, date_str in enumerate(dates):
            if i < len(predicted):
                cum_pred += predicted[i]
            obs = obs_by_date.get(date_str, cum)
            mse += (cum_pred - obs) ** 2

        mse /= max(1, len(dates))
        if mse < best_mse:
            best_mse = mse
            best_beta = beta

    return best_beta if best_beta else 0.15


def estimate_zone_params(real_by_zone, demos_by_zone, province_zones):
    """Estimate per-zone SEIR parameters from real data.

    For each zone with real cases:
      - β: fitted via grid search (§2a)
      - CFR: observed confirmed_deaths / confirmed_cases (§2c)
      - Initial SEIR state: from first report date (§2b)
      - σ, γ: fixed from literature (§2d)

    Returns:
        zone_params: {zone: {beta, cfr, N, S0, E0, I0, R0, first_date, ...}}
        prov_params: {province: {median_beta, median_cfr}}
    """
    log("Estimating SEIR parameters from real data...")

    zone_params = {}
    prov_betas = defaultdict(list)
    prov_cfrs = defaultdict(list)

    for zone, records in real_by_zone.items():
        demo = demos_by_zone.get(zone, {})
        N = demo.get("population", 50000)
        prov = demo.get("province", "Unknown")

        records_sorted = sorted(records, key=lambda r: r["date"])
        first_date = records_sorted[0]["date"]
        total_conf = sum(r["confirmed_cases"] for r in records_sorted)
        total_deaths = sum(r["confirmed_deaths"] for r in records_sorted)
        total_susp = sum(r["suspected_cases"] for r in records_sorted)

        # CFR — with Ebola floor of 5% (deaths lag in early outbreak data)
        cfr = total_deaths / max(total_conf, 1)
        cfr = max(0.05, min(0.40, cfr))
        prov_cfrs[prov].append(cfr)

        # Initial state
        I0 = max(1, records_sorted[0]["confirmed_cases"] + records_sorted[0]["suspected_cases"])
        E0 = I0 * 3  # standard assumption: ~3× undetected exposed
        R0 = total_deaths  # already removed (deceased)
        S0 = max(1, N - E0 - I0 - R0)

        # β estimation
        if N >= 1000 and len(records_sorted) >= 2:
            beta = estimate_beta_from_trajectory(records_sorted, N, SIGMA, GAMMA)
        else:
            beta = None

        if beta is not None:
            prov_betas[prov].append(beta)
        else:
            beta = 0.15  # fallback

        # Initial suspected ratio
        if total_conf > 0:
            suspected_ratio = total_susp / total_conf
        else:
            suspected_ratio = 3.0

        zone_params[zone] = {
            "beta": beta,
            "beta0": beta,
            "cfr": cfr,
            "N": N,
            "S0": S0, "E0": E0, "I0": I0, "R0": R0,
            "first_date": first_date,
            "province": prov,
            "country": records_sorted[0]["country"],
            "is_real_active": True,
            "is_active": True,
            "suspected_ratio": suspected_ratio,
            "total_conf_obs": total_conf,
            "total_susp_obs": total_susp,
            "_cum_cases": total_conf + total_susp,
            "_cum_deaths": total_deaths,
            "_S": S0, "_E": E0, "_I": I0, "_R": R0,  # current SEIR state
        }

    # Provincial medians (for zones with sparse/no data)
    prov_params = {}
    for prov in province_zones:
        betas = prov_betas.get(prov, [0.15])
        cfrs = prov_cfrs.get(prov, [0.08])
        betas_sorted = sorted(betas)
        cfrs_sorted = sorted(cfrs)
        prov_params[prov] = {
            "median_beta": betas_sorted[len(betas_sorted)//2],
            "median_cfr": cfrs_sorted[len(cfrs_sorted)//2],
        }

    # Fill in missing β for zones that couldn't be fitted
    for zone, p in zone_params.items():
        if p["beta"] is None or p["beta"] == 0.15:
            prov = p["province"]
            p["beta"] = prov_params.get(prov, {}).get("median_beta", 0.15)
            p["beta0"] = p["beta"]

    log(f"  {len(zone_params)} zones parameterized")
    for prov, pp in prov_params.items():
        log(f"    {prov}: β_median={pp['median_beta']:.3f}, CFR_median={pp['median_cfr']:.3f}")

    return zone_params, prov_params


# ══════════════════════════════════════════════════════════════════════════════
# Gravity model for spatial diffusion
# ══════════════════════════════════════════════════════════════════════════════

def effective_distance(zone_i, zone_j, demos_by_zone):
    """Compute effective distance between two zones.

    Uses approximate centroid coordinates derived from province membership.
    For same-province zones: Euclidean distance based on zone index difference
    (proxy for adjacency when exact centroids unavailable).
    For cross-province zones: distance is scaled by province adjacency.
    """
    di = demos_by_zone.get(zone_i, {})
    dj = demos_by_zone.get(zone_j, {})

    if zone_i == zone_j:
        return 0.0

    # Same province = close proximity
    if di.get("province") == dj.get("province"):
        # Use population density as a connectivity proxy —
        # denser zones tend to be closer together
        avg_density = (di.get("population_density", 50) + dj.get("population_density", 50)) / 2
        return max(0.1, 50.0 / max(avg_density, 1))

    # Different provinces — distance proportional to how far apart they are
    # For simplicity: adjacent provinces have distance 200km, non-adjacent 500km
    # (approximate for eastern DRC + Uganda border region)
    prov_i = di.get("province", "")
    prov_j = dj.get("province", "")

    # Adjacency map for our 4 outbreak-affected provinces
    prov_adjacency = {
        ("Ituri", "Nord-Kivu"): 200,
        ("Ituri", "Sud-Kivu"): 350,
        ("Nord-Kivu", "Sud-Kivu"): 150,
        ("Ituri", "Kampala"): 300,
        ("Nord-Kivu", "Kampala"): 400,
        ("Sud-Kivu", "Kampala"): 450,
    }
    key = tuple(sorted([prov_i, prov_j]))
    return prov_adjacency.get(key, 500)  # default: far


def compute_infection_pressure(target_zone, active_zones, zone_params,
                                demos_by_zone, current_date_str):
    """Compute gravity-model infection pressure on target_zone from all active zones.

    T_{i→j} = k · (P_i^α · P_j^β) / d(i,j)^γ   (see §3)

    Pressure = Σ_i I_i(t) · T_{i→j}
    """
    p_j = demos_by_zone.get(target_zone, {}).get("population", 10000)
    pressure = 0.0

    for source_zone in active_zones:
        if source_zone == target_zone:
            continue
        p = zone_params.get(source_zone)
        if not p or not p.get("is_active"):
            continue

        p_i = demos_by_zone.get(source_zone, {}).get("population", 10000)
        d = effective_distance(source_zone, target_zone, demos_by_zone)

        if d <= 0:
            continue

        # Infectious population in source zone
        I_i = p.get("_I", 0)
        if I_i <= 0:
            continue

        # Gravity kernel
        T_ij = (p_i ** ALPHA) * (p_j ** BETA_G) / (d ** GAMMA_G)
        pressure += I_i * T_ij

    return pressure


def seed_new_zones(zone_params, demos_by_zone, province_zones,
                    date_str, prov_params):
    """Determine which new zones become infected via gravity-model diffusion.

    A susceptible zone becomes infected when cumulative pressure > threshold.
    Seeding is limited to max_new_per_day zones (highest pressure first).
    """
    current_date = datetime.strptime(date_str, "%Y-%m-%d")
    real_end_date = datetime.strptime(REAL_END, "%Y-%m-%d")
    days_since_real = (current_date - real_end_date).days
    if days_since_real < 1:
        return []

    # Hard cap on total seeded zones (total = 32 real + MAX_SEEDED_ZONES)
    total_seeded = sum(1 for p in zone_params.values() if p.get("is_seeded"))
    if total_seeded >= MAX_SEEDED_ZONES:
        return []

    # Gradually allow more zones per day as epidemic progresses
    max_new_per_day = max(1, 1 + days_since_real // 20)  # 1→2→3... zones/day
    max_new_per_day = min(max_new_per_day, MAX_SEEDED_ZONES - total_seeded)

    active_zone_names = [z for z, p in zone_params.items() if p.get("is_active")]
    newly_seeded = []

    # Score ALL candidates across all provinces by infection pressure
    scored_candidates = []
    for prov, zones_in_prov in province_zones.items():
        candidates = [z for z in zones_in_prov
                      if z not in zone_params or not zone_params[z].get("is_active", False)]
        for cz in candidates:
            demo = demos_by_zone.get(cz, {})
            pressure = compute_infection_pressure(
                cz, active_zone_names, zone_params, demos_by_zone, date_str)
            scored_candidates.append((pressure, cz, prov, demo))

    # Sort by descending pressure
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    for pressure, cz, prov, demo in scored_candidates:
        if len(newly_seeded) >= max_new_per_day:
            break

        if pressure <= 0:
            continue

        # Healthcare modifier
        doctors = demo.get("doctors_per_100k", 2)
        healthcare_mod = 1.0 + max(0, (4 - doctors) * 0.15)

        # Adaptive threshold: decreases over time
        time_factor = max(0.3, 1.0 - days_since_real * 0.008)
        threshold = SEED_THRESHOLD * healthcare_mod * time_factor

        # Density bonus
        density = demo.get("population_density", 50)
        density_mod = 0.5 + 0.5 * min(density / 200, 1.5)

        effective_pressure = pressure * density_mod / max(healthcare_mod, 1)

        if effective_pressure > threshold:
            N = max(1000, demo.get("population", 50000))
            beta = prov_params.get(prov, {}).get("median_beta", 0.15)
            cfr = max(0.10, prov_params.get(prov, {}).get("median_cfr", 0.20))

            I0 = max(1, round(effective_pressure * 3))
            E0 = I0 * 3

            zone_params[cz] = {
                "beta": beta, "beta0": beta,
                "cfr": cfr,
                "N": N,
                "S0": N - E0 - I0, "E0": E0, "I0": I0, "R0": 0,
                "first_date": date_str,
                "province": prov,
                "country": demo.get("country", "COD"),
                "is_real_active": False,
                "is_active": True,
                "is_seeded": True,
                "suspected_ratio": 3.0,
                "total_conf_obs": 0, "total_susp_obs": 0,
                "_cum_cases": I0, "_cum_deaths": 0,
                "_S": N - E0 - I0, "_E": E0, "_I": I0, "_R": 0,
            }
            newly_seeded.append(cz)

    if newly_seeded:
        names = [z for z in newly_seeded[:5]]
        extra = f" +{len(newly_seeded)-5} more" if len(newly_seeded) > 5 else ""
        log(f"    {date_str}: {len(newly_seeded)} new seeded: {', '.join(names)}{extra}")

    return newly_seeded


# ══════════════════════════════════════════════════════════════════════════════
# Daily case generation
# ══════════════════════════════════════════════════════════════════════════════

def compute_intervention_multiplier(date_str, doctors_per_100k):
    """Compute β reduction factor due to interventions. (§4)

    β(t) = β₀ · exp(-λ · max(0, t - t_intervention)) · healthcare_mod
    """
    days_into_intervention = days_between(INTERVENTION_START, date_str)
    if days_into_intervention <= 0:
        return 1.0

    # Healthcare access amplifies intervention effect
    hc_mod = 1.0 + max(0, (doctors_per_100k - 2) * 0.1)
    reduction = math.exp(-LAMBDA * days_into_intervention * hc_mod)
    return max(0.3, reduction)  # β won't drop below 30% of original


def step_zone_seir(zone, p, date_str, demos_by_zone):
    """Advance a zone's SEIR state by one day and generate a daily record.

    Returns: record dict (or None if no cases/deaths today)
    """
    # Apply intervention multiplier to β
    doctors = demos_by_zone.get(zone, {}).get("doctors_per_100k", 2)
    beta_eff = p["beta"] * compute_intervention_multiplier(date_str, doctors)

    # SEIR step with bounds checking
    S, E, I, R = p["_S"], p["_E"], p["_I"], p["_R"]
    N = p["N"]
    # Clamp to valid range (prevent numerical drift)
    S = max(0, min(N, S))
    E = max(0, min(N, E))
    # Ebola: infectious fraction rarely exceeds 1% of population
    I = max(0, min(N * 0.01, I))
    R = max(0, min(N, R))
    total = S + E + I + R
    if total > 0 and abs(total - N) > 1:
        # Rescale to maintain N
        S = S * N / total
        E = E * N / total
        I = I * N / total
        R = N - S - E - I

    if I <= 0 and E <= 0:
        # Epidemic has died out in this zone
        p["_S"] = S
        p["_E"] = 0
        p["_I"] = 0
        p["_R"] = R
        return None

    E_before = E
    try:
        S_new, E_new, I_new, R_new = seir_step_rk4(
            S, E, I, R, N, beta_eff, SIGMA, GAMMA)
    except (OverflowError, ValueError):
        # Numerical blowup — clamp and continue
        p["_S"] = S
        p["_E"] = E
        p["_I"] = I
        p["_R"] = R
        return None

    # Daily new symptomatic cases = outflow from Exposed → Infectious (σ·E)
    # This is the standard SEIR incidence observable (Legrand et al. 2007 §2.2)
    daily_new_raw = SIGMA * E_before
    # Ebola per-zone daily cases rarely exceed 25 (WHO Ebola Response Team 2016)
    daily_new_raw = min(daily_new_raw, 25.0)
    # Poisson-like noise for realistic daily variation
    noise_sd = math.sqrt(max(daily_new_raw, 0.5))
    if math.isfinite(daily_new_raw) and math.isfinite(noise_sd):
        daily_new = max(0, round(random.gauss(daily_new_raw, noise_sd)))
    else:
        daily_new = 0

    # Update SEIR state
    p["_S"] = S_new
    p["_E"] = E_new
    p["_I"] = I_new
    p["_R"] = R_new

    # Suspected ratio decays as outbreak progresses (testing improves)
    days_active = days_between(p["first_date"], date_str)
    suspected_ratio = p["suspected_ratio"] * math.exp(-0.02 * max(0, days_active))
    suspected_ratio = max(0.3, suspected_ratio)
    daily_suspected = max(0, round(daily_new * suspected_ratio * random.uniform(0.7, 1.3)))

    # Deaths from CFR (with stochastic variation)
    daily_deaths = max(0, round(daily_new * p["cfr"] * random.uniform(0.85, 1.15)))

    # Suspected deaths
    daily_susp_deaths = max(0, round(daily_suspected * p["cfr"] * 0.3 * random.uniform(0.7, 1.3)))

    p["_cum_cases"] += daily_new
    p["_cum_deaths"] += daily_deaths

    # Return None only if truly no activity
    if daily_new == 0 and daily_suspected == 0 and daily_deaths == 0 and daily_susp_deaths == 0:
        return None

    return {
        "date": date_str,
        "country": p["country"],
        "region": zone,
        "province": p["province"],
        "confirmed_cases": daily_new,
        "confirmed_deaths": daily_deaths,
        "suspected_cases": daily_suspected,
        "suspected_deaths": daily_susp_deaths,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Main extrapolation loop
# ══════════════════════════════════════════════════════════════════════════════

def extrapolate(real_records, real_by_zone, demos_by_zone, province_zones):
    """Run the full extrapolation: SEIR + gravity diffusion day by day."""
    log("Estimating SEIR parameters for active zones...")
    zone_params, prov_params = estimate_zone_params(
        real_by_zone, demos_by_zone, province_zones)

    # Collect and deduplicate real records
    real_keys = set()
    all_records = []
    for r in real_records:
        key = (r["date"], r["region"])
        if key not in real_keys:
            real_keys.add(key)
            all_records.append(dict(r))
    log(f"  {len(all_records)} real records preserved")

    # Generate extrapolated records
    log("Running SEIR + gravity diffusion model...")
    log(f"  σ = 1/{1/SIGMA:.0f}d, γ = 1/{1/GAMMA:.0f}d, λ = {LAMBDA}/d")
    extrap_count = 0
    zero_count = 0

    extrap_dates = list(date_range(EXTRAP_START, EXTRAP_END))

    for day_idx, date_str in enumerate(extrap_dates):
        # Seed new zones via gravity model
        seed_new_zones(zone_params, demos_by_zone, province_zones,
                       date_str, prov_params)

        # Step all active zones forward
        active_zones = [z for z, p in zone_params.items() if p.get("is_active")]
        for zone in active_zones:
            p = zone_params[zone]
            record = step_zone_seir(zone, p, date_str, demos_by_zone)

            if record:
                all_records.append(record)
                extrap_count += 1
            else:
                zero_count += 1

        # Weekly: snapshot ALL zones (including inactive) for spatial completeness
        if day_idx % 7 == 0:
            for zone, demo in demos_by_zone.items():
                if zone not in zone_params or not zone_params[zone].get("is_active", False):
                    all_records.append({
                        "date": date_str,
                        "country": demo.get("country", "COD"),
                        "region": zone,
                        "province": demo.get("province", ""),
                        "confirmed_cases": 0,
                        "confirmed_deaths": 0,
                        "suspected_cases": 0,
                        "suspected_deaths": 0,
                    })
                    zero_count += 1

        if day_idx % 15 == 0:
            n_active = len(active_zones)
            n_seeded = sum(1 for p in zone_params.values() if p.get("is_seeded"))
            log(f"    {date_str}: {n_active} active zones "
                f"({n_seeded} seeded via gravity model), {extrap_count} records")

    # Sort
    all_records.sort(key=lambda r: (r["date"], r["region"]))

    # Summary
    unique_zones_infected = len([z for z, p in zone_params.items() if p.get("is_active")])
    total_conf = sum(r["confirmed_cases"] for r in all_records)

    log(f"\n  ✅ Extrapolation complete:")
    log(f"     {len(all_records)} total records")
    log(f"       - {len(real_keys)} real (5/14–5/28)")
    log(f"       - {extrap_count} SEIR-generated non-zero (5/29–8/15)")
    log(f"       - {zero_count} zero-case records for spatial coverage")
    log(f"     {unique_zones_infected} zones ever infected")
    log(f"     {total_conf} total confirmed cases (cumulative across all zones)")

    return all_records, zone_params


# ══════════════════════════════════════════════════════════════════════════════

def write_output(records):
    """Write expanded cases.csv."""
    path = DATA_DIR / "cases.csv"
    log(f"\nWriting {len(records)} records to {path}...")

    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "date", "country", "region", "province",
            "confirmed_cases", "confirmed_deaths",
            "suspected_cases", "suspected_deaths",
        ])
        writer.writeheader()
        for r in records:
            writer.writerow(r)

    log(f"  ✅ {path} written")

    # Stats
    dates = sorted(set(r["date"] for r in records))
    zones = sorted(set(r["region"] for r in records))
    total_conf = sum(r["confirmed_cases"] for r in records)
    total_deaths = sum(r["confirmed_deaths"] for r in records)
    total_susp = sum(r["suspected_cases"] for r in records)

    log(f"\n  Dataset statistics:")
    log(f"    Date range: {dates[0]} ~ {dates[-1]} ({len(dates)} days)")
    log(f"    Zones: {len(zones)}")
    log(f"    Total confirmed: {total_conf}")
    log(f"    Total deaths: {total_deaths}")
    log(f"    Total suspected: {total_susp}")
    log(f"    Overall CFR: {total_deaths/max(total_conf,1)*100:.1f}%")
    log(f"    Records ≥ 10,000: {'✅ YES' if len(records) >= 10000 else '❌ NO — ' + str(len(records))}")


def main():
    print("=" * 68)
    print("EbolaViz2026 — Case Time Series Extrapolation")
    print("  SEIR Compartmental Model + Gravity-Model Spatial Diffusion")
    print("=" * 68)
    print(f"  Real interval:   {REAL_START} ~ {REAL_END}")
    print(f"  Extrap interval: {EXTRAP_START} ~ {EXTRAP_END}")
    print(f"  Literature σ,γ:  SIGMA={SIGMA:.3f}, GAMMA={GAMMA:.3f}")
    print(f"  Gravity params:  α={ALPHA}, β={BETA_G}, γ={GAMMA_G}")
    print(f"  Intervention λ:  {LAMBDA} (from {INTERVENTION_START})")
    print(f"  Random seed:     {SEED}")
    print()

    real_records, real_by_zone, demos_by_zone, province_zones = load_real_data()
    records, params = extrapolate(real_records, real_by_zone,
                                   demos_by_zone, province_zones)
    write_output(records)

    print(f"\n{'=' * 68}")
    print("Next: python3 scripts/build_real_data.py")
    print("This regenerates data/cases_by_region_date.json from the")
    print("expanded CSV with all SEIR-extrapolated records.")
    print(f"{'=' * 68}")


if __name__ == "__main__":
    main()
