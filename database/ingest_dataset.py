"""
Ingest New Dataset Module
-------------------------
Loads the datasets from the `dataset/` directory into `facilityops.db`:
- dataset/maintenance/maintenance_ahu_data.csv  -> assets & maintenance_records
- dataset/energy_agent/2019Floor2.csv          -> energy_usage
- dataset/occupancy/Occupancy_Estimation.csv   -> occupancy_records
- dataset/security/security_events.csv         -> security_events
- dataset/cost/cost_data.csv                   -> cost_reports & cost_optimization

Anchor date range: 56 days ending at 2026-09-30 23:59:59 (matches September 2026 in CSVs).
"""
import os
import sys
import csv
import sqlite3
import random
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, "facilityops.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")
DATASET_DIR = os.path.join(PROJECT_DIR, "dataset")

NOW = datetime(2026, 9, 30, 23, 59, 59)
DAYS_OF_HISTORY = 56
START = NOW - timedelta(days=DAYS_OF_HISTORY)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_schema(conn):
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()


def ingest_facilities(conn):
    facilities = [
        ("Skyline Corporate Tower (FAC001)", "Corporate Office", "Bengaluru, IN"),
        ("Meridian IT Park - Block C", "IT Park", "Pune, IN"),
        ("Northgate University Campus", "University", "Hyderabad, IN"),
        ("Riverside General Hospital", "Hospital", "Chennai, IN"),
    ]
    conn.executemany(
        "INSERT INTO facilities (facility_name, facility_type, location) VALUES (?,?,?)",
        facilities,
    )
    conn.commit()
    facility_ids = [row[0] for row in conn.execute("SELECT facility_id FROM facilities")]
    return facility_ids


def ingest_maintenance(conn, facility_ids):
    """
    Ingest from dataset/maintenance/maintenance_ahu_data.csv:
    Columns: Datetime, CHWC_VLV, OA_CFM, OA_DMPF, OA_TEMP, RA_CFM, RA_DMPR,
             RA_TEMP, RF_CS, RF_SPD, fault_type, fault_detected, severity, data_source
    """
    csv_file = os.path.join(DATASET_DIR, "maintenance", "maintenance_ahu_data.csv")
    rows = []
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

    # Assets per facility
    asset_types = [
        ("AHU-01 Primary Chilled Air Unit", "HVAC", 12),
        ("AHU-02 Secondary Air Handler", "HVAC", 10),
        ("Chiller Unit #1 Centrifugal", "HVAC", 15),
        ("Cooling Tower #1 Induced Draft", "HVAC", 12),
        ("Return Air Fan RF-01", "HVAC", 8),
        ("Emergency Generator CAT-500", "Power", 15),
        ("Main UPS Inverter Rack", "Power", 10),
    ]

    asset_map = {}
    for fid in facility_ids:
        for name, atype, life in asset_types:
            installed = START - timedelta(days=random.randint(400, 2200))
            cur = conn.execute(
                """INSERT INTO assets (facility_id, asset_name, asset_type, status,
                   installed_on, expected_life_years) VALUES (?,?,?,?,?,?)""",
                (fid, name, atype, "Operational", installed.strftime("%Y-%m-%d"), life),
            )
            asset_map.setdefault(fid, []).append((cur.lastrowid, name, atype))
    conn.commit()

    # Distribute the 1,200 AHU readings across daily history (56 days) for assets
    maintenance_records = []
    if rows:
        n_rows = len(rows)
        for fid in facility_ids:
            assets = asset_map[fid]
            for asset_idx, (aid, aname, atype) in enumerate(assets):
                # Pick a slice of AHU rows
                step = max(1, n_rows // (DAYS_OF_HISTORY + 1))
                t = START
                day_i = 0
                cum_runtime = 120.0
                while t <= NOW:
                    row_idx = (asset_idx * 17 + day_i * step) % n_rows
                    r = rows[row_idx]
                    
                    fault_type = r.get("fault_type", "normal")
                    fault_detected = r.get("fault_detected", "0")
                    severity = r.get("severity", "none").lower()
                    
                    try:
                        ra_temp = float(r.get("RA_TEMP", 23.5))
                        rf_cs = float(r.get("RF_CS", 0.72))
                        rf_spd = float(r.get("RF_SPD", 0.70))
                    except (ValueError, TypeError):
                        ra_temp, rf_cs, rf_spd = 23.5, 0.72, 0.70

                    # Realistic equipment operating temp (42C - 78C)
                    temp_c = round(38.0 + (ra_temp - 15.0) * 2.2 + (rf_spd * 12.0), 1)

                    # Vibration score based on RF speed, current & fault severity
                    if severity == "high" or fault_detected == "1":
                        vibe = round(5.1 + rf_cs * 1.8 + random.uniform(0.1, 0.6), 2)
                        status = "In Progress"
                        issue_type = fault_type.replace("_", " ").title() if fault_type != "normal" else "Thermal Surge"
                    elif severity == "medium":
                        vibe = round(3.7 + rf_cs * 1.2 + random.uniform(-0.1, 0.3), 2)
                        status = "Scheduled"
                        issue_type = fault_type.replace("_", " ").title() if fault_type != "normal" else "Vibration Anomaly"
                    else:
                        vibe = round(1.4 + rf_cs * 0.9 + random.uniform(-0.1, 0.15), 2)
                        status = "Completed"
                        issue_type = "Routine Diagnostic"

                    cum_runtime += random.uniform(8.0, 16.0)
                    maintenance_records.append((
                        aid, issue_type, t.strftime("%Y-%m-%d"), status, vibe, temp_c, round(cum_runtime, 1)
                    ))
                    t += timedelta(days=1)
                    day_i += 1

    conn.executemany(
        """INSERT INTO maintenance_records (asset_id, issue_type, maintenance_date,
           status, vibration_score, temperature_c, runtime_hours) VALUES (?,?,?,?,?,?,?)""",
        maintenance_records,
    )
    conn.commit()
    print(f"Ingested {len(maintenance_records)} maintenance records from maintenance_ahu_data.csv")


def ingest_energy(conn, facility_ids):
    """
    Ingest from dataset/energy_agent/2019Floor2.csv
    Aggregates submetered AC, lighting and plug circuits into 3-hour intervals over 56 days.
    """
    csv_file = os.path.join(DATASET_DIR, "energy_agent", "2019Floor2.csv")
    energy_records = []

    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            header = next(csv.reader(f))
            ac_idx = [i for i, c in enumerate(header) if "AC" in c]
            light_idx = [i for i, c in enumerate(header) if "Light" in c]
            plug_idx = [i for i, c in enumerate(header) if "Plug" in c]
            reader = csv.reader(f)

            # Sample every 180 rows (3 hours of minutes) to match the rolling 56-day window
            sampled_energy = []
            for row_num, row in enumerate(reader):
                if row_num % 180 == 0:
                    try:
                        ac = sum(float(row[i]) for i in ac_idx if row[i])
                        light = sum(float(row[i]) for i in light_idx if row[i])
                        plug = sum(float(row[i]) for i in plug_idx if row[i])
                    except (ValueError, TypeError):
                        ac, light, plug = 5.0, 1.2, 0.8
                    total = ac + light + plug
                    sampled_energy.append((ac, light, plug, total))
                    if len(sampled_energy) >= (DAYS_OF_HISTORY * 8 + 50):
                        break

        n_samples = len(sampled_energy)
        for f_idx, fid in enumerate(facility_ids):
            t = START
            sample_i = 0
            while t <= NOW:
                s = sampled_energy[(sample_i + f_idx * 23) % n_samples]
                ac, light, plug, tot = s
                
                # Scale up submeter kw to facility building scale (60 - 150 kWh)
                scale_mult = 12.0 + (f_idx * 4.0)
                kwh = round(max(35.0, tot * scale_mult * random.uniform(0.95, 1.05)), 2)
                
                # Injected peak anomaly in ~2% of readings for anomaly detector
                if random.random() < 0.022:
                    kwh = round(kwh * random.uniform(1.65, 2.1), 2)

                water = round(kwh * random.uniform(3.2, 4.4), 1)

                if tot > 0:
                    hvac_pct = round((ac / tot) * 100, 1)
                    light_pct = round((light / tot) * 100, 1)
                    plug_pct = round((plug / tot) * 100, 1)
                    other_pct = round(max(0, 100 - hvac_pct - light_pct - plug_pct), 1)
                else:
                    hvac_pct, light_pct, plug_pct, other_pct = 45.0, 25.0, 20.0, 10.0

                energy_records.append((
                    fid, t.strftime("%Y-%m-%d %H:%M:%S"), kwh, water,
                    hvac_pct, light_pct, plug_pct, other_pct
                ))
                t += timedelta(hours=3)
                sample_i += 1

    conn.executemany(
        """INSERT INTO energy_usage (facility_id, timestamp, electricity_usage,
           water_usage, hvac_load_pct, lighting_load_pct, equipment_load_pct, other_load_pct)
           VALUES (?,?,?,?,?,?,?,?)""",
        energy_records,
    )
    conn.commit()
    print(f"Ingested {len(energy_records)} energy telemetry points from 2019Floor2.csv")


def ingest_occupancy(conn, facility_ids):
    """
    Ingest from dataset/occupancy/Occupancy_Estimation.csv
    Maps sensor telemetry (CO2, PIR motion, Light, Temp) and counts into zone occupancy records.
    """
    csv_file = os.path.join(DATASET_DIR, "occupancy", "Occupancy_Estimation.csv")
    rows = []
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            # Take a periodic stride through the 10,129 sensor rows
            for i, r in enumerate(reader):
                if i % 15 == 0:
                    rows.append(r)

    zones = [
        ("Zone 1 - Primary Office Floor", 120),
        ("Zone 2 - Collaborative Workspaces", 75),
        ("Zone 3 - Conference Rooms", 45),
        ("Zone 4 - Engineering Labs", 50),
        ("Zone 5 - Executive Suite", 25),
        ("Zone 6 - Cafeteria & Lounge", 90),
    ]

    occ_records = []
    n_rows = len(rows) if rows else 1
    for f_idx, fid in enumerate(facility_ids):
        t = START
        step_i = 0
        while t <= NOW:
            for z_idx, (zname, cap) in enumerate(zones):
                r = rows[(step_i + z_idx * 11 + f_idx * 19) % n_rows]
                base_count = float(r.get("Room_Occupancy_Count", 1))
                pir1 = float(r.get("S6_PIR", 0))
                pir2 = float(r.get("S7_PIR", 0))
                
                # Real sensor-driven multiplier based on PIR activity and time of day
                hour = t.hour
                weekday = t.weekday()
                if weekday < 5 and 8 <= hour <= 18:
                    mult = 18.0 + (pir1 + pir2) * 12.0 + (base_count * 8.0)
                elif weekday < 5 and (7 <= hour <= 21):
                    mult = 6.0 + base_count * 4.0
                else:
                    mult = 1.5 + base_count * 0.8
                
                count = min(cap, max(0, int(mult * random.uniform(0.9, 1.1))))
                # Injected peak overcrowding in ~1% of readings
                if weekday < 5 and 11 <= hour <= 14 and random.random() < 0.015:
                    count = int(cap * random.uniform(0.92, 1.05))

                occ_records.append((fid, zname, count, cap, t.strftime("%Y-%m-%d %H:%M:%S")))
            t += timedelta(hours=4)
            step_i += 1

    conn.executemany(
        """INSERT INTO occupancy_records (facility_id, zone, occupancy_count, capacity, timestamp)
           VALUES (?,?,?,?,?)""",
        occ_records,
    )
    conn.commit()
    print(f"Ingested {len(occ_records)} occupancy sensor readings from Occupancy_Estimation.csv")


def ingest_security(conn, facility_ids):
    """
    Ingest from dataset/security/security_events.csv
    Directly maps 120 authentic security incidents and events across facilities.
    """
    csv_file = os.path.join(DATASET_DIR, "security", "security_events.csv")
    rows = []
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

    event_type_names = {
        "door_forced": "Forced Door Alarm",
        "door_held_open": "Door Held Open Alarm",
        "access_attempt": "Unauthorized Access Attempt",
        "visitor_checkin": "Visitor Registration & Check-in",
    }

    security_records = []
    if rows:
        for f_idx, fid in enumerate(facility_ids):
            for i, r in enumerate(rows):
                raw_type = r.get("event_type", "access_attempt")
                ev_type = event_type_names.get(raw_type, raw_type.replace("_", " ").title())
                raw_sev = r.get("severity", "MEDIUM").capitalize()
                if raw_sev not in ("Low", "Medium", "High", "Critical"):
                    raw_sev = "Medium"
                
                # If access was denied or suspicious, elevate or keep
                if r.get("is_suspicious") == "True" and raw_sev == "High":
                    if random.random() < 0.2:
                        raw_sev = "Critical"

                zone = r.get("zone_name", "Main Entrance")
                ts = r.get("timestamp", "2026-09-15 12:00:00")
                
                # Distribute timestamps cleanly across the facilities
                dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S") + timedelta(hours=f_idx * 6)
                if dt > NOW:
                    dt = NOW - timedelta(minutes=i * 15)

                security_records.append((
                    fid, ev_type, raw_sev, zone, dt.strftime("%Y-%m-%d %H:%M:%S")
                ))

    conn.executemany(
        """INSERT INTO security_events (facility_id, event_type, severity, zone, timestamp)
           VALUES (?,?,?,?,?)""",
        security_records,
    )
    conn.commit()
    print(f"Ingested {len(security_records)} security event records from security_events.csv")


def ingest_cost(conn, facility_ids):
    """
    Ingest from dataset/cost/cost_data.csv and load_cost_dataset.py
    Loads submeter cost breakdowns and full portfolio OPEX metrics.
    """
    csv_file = os.path.join(DATASET_DIR, "cost", "cost_data.csv")
    cost_reports = []
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                cat = r.get("category", "HVAC")
                cost_inr = float(r.get("energy_cost_inr", 0))
                date_str = r.get("date", "2026-09-01")
                for fid in facility_ids:
                    multiplier = 1.0 if fid == 1 else random.uniform(0.85, 1.25)
                    cost_reports.append((fid, cat, round(cost_inr * multiplier, 2), date_str))

    conn.executemany(
        "INSERT INTO cost_reports (facility_id, category, amount, report_date) VALUES (?,?,?,?)",
        cost_reports,
    )
    conn.commit()
    print(f"Ingested {len(cost_reports)} cost reports from cost_data.csv")

    # Also load the cost_optimization dataset table
    from database.load_cost_dataset import load as load_cost_opt
    load_cost_opt(conn)
    print("Cost optimization table refreshed.")


def run():
    print(f"Connecting to {DB_PATH}...")
    conn = get_db_connection()
    try:
        print("Rebuilding schema...")
        init_schema(conn)
        
        print("Ingesting facilities...")
        f_ids = ingest_facilities(conn)
        
        print("Ingesting maintenance AHU dataset...")
        ingest_maintenance(conn, f_ids)
        
        print("Ingesting energy floor telemetry dataset...")
        ingest_energy(conn, f_ids)
        
        print("Ingesting occupancy estimation dataset...")
        ingest_occupancy(conn, f_ids)
        
        print("Ingesting security events dataset...")
        ingest_security(conn, f_ids)
        
        print("Ingesting cost datasets...")
        ingest_cost(conn, f_ids)

        print("\nAll datasets ingested successfully into facilityops.db!")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
