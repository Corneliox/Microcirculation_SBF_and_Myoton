"""
Microcirculation & Myotonometer Analytics Engine - CLI Bridge for Electron / JavaScript UI
Accepts JSON parameters or CLI flags, performs numerical DSP/Statistics, and returns structured JSON.
"""

import sys
import os
import json
import argparse
import re
import numpy as np

# Ensure root directory is on Python path to access core module
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import warnings
warnings.filterwarnings('ignore')

from scipy import stats

COMPASS_POINTS = [
    {"id": 1, "name": "North-West (NW)", "code": "NW", "row": 0, "col": 0},
    {"id": 2, "name": "North (N)", "code": "N", "row": 0, "col": 1},
    {"id": 3, "name": "North-East (NE)", "code": "NE", "row": 0, "col": 2},
    {"id": 4, "name": "West (W)", "code": "W", "row": 1, "col": 0},
    {"id": 5, "name": "Center (C)", "code": "C", "row": 1, "col": 1},
    {"id": 6, "name": "East (E)", "code": "E", "row": 1, "col": 2},
    {"id": 7, "name": "South-West (SW)", "code": "SW", "row": 2, "col": 0},
    {"id": 8, "name": "South (S)", "code": "S", "row": 2, "col": 1},
    {"id": 9, "name": "South-East (SE)", "code": "SE", "row": 2, "col": 2},
]


def calculate_dwell_value(samples: np.ndarray, method: str = "p25") -> float:
    if len(samples) == 0:
        return 0.0
    if method == "p25":
        return float(np.percentile(samples, 25))
    elif method == "median":
        return float(np.median(samples))
    elif method == "mean":
        return float(np.mean(samples))
    return float(np.percentile(samples, 25))


def segment_signal(samples: np.ndarray, fs: float = 40.0, dwell_sec: float = 7.41, method: str = "p25"):
    samples_per_dwell = max(10, int(round(dwell_sec * fs)))
    dwells = []

    for i in range(9):
        s0 = i * samples_per_dwell
        s1 = min(s0 + samples_per_dwell, len(samples))
        seg = samples[s0:s1]
        cp = COMPASS_POINTS[i]

        if len(seg) > 0:
            val = calculate_dwell_value(seg, method)
            dwells.append({
                "dwellIndex": i + 1,
                "compassName": cp["name"],
                "compassCode": cp["code"],
                "gridRow": cp["row"],
                "gridCol": cp["col"],
                "startTimeSec": round(s0 / fs, 2),
                "endTimeSec": round(s1 / fs, 2),
                "sampleCount": len(seg),
                "value": round(val, 2),
                "mean": round(float(np.mean(seg)), 2),
                "std": round(float(np.std(seg)), 2)
            })
        else:
            dwells.append({
                "dwellIndex": i + 1,
                "compassName": cp["name"],
                "compassCode": cp["code"],
                "gridRow": cp["row"],
                "gridCol": cp["col"],
                "startTimeSec": 0.0,
                "endTimeSec": 0.0,
                "sampleCount": 0,
                "value": 0.0,
                "mean": 0.0,
                "std": 0.0
            })
    return dwells


def parse_microcirculation_excel(file_path: str):
    import pandas as pd
    df_raw = pd.read_excel(file_path, header=None)
    
    # Row index 1 contains subject names (Bas at col 1, Cornel at col 13, Reuben at col 25)
    subjects = {}
    row1 = df_raw.iloc[1]

    sub_cols = []
    for c in range(1, len(row1)):
        val = row1[c]
        if pd.notna(val) and str(val).strip():
            sub_cols.append((str(val).strip(), c))

    freq_offsets = [
        ("30Hz", 0, 2),
        ("50Hz", 4, 6),
        ("100Hz", 8, 10),
    ]

    for name, base_col in sub_cols:
        subjects[name] = {"name": name, "frequencies": {}}
        for f_label, be_off, af_off in freq_offsets:
            be_col = base_col + be_off
            af_col = base_col + af_off
            
            be_vals = pd.to_numeric(df_raw.iloc[5:, be_col], errors="coerce").dropna().values
            af_vals = pd.to_numeric(df_raw.iloc[5:, af_col], errors="coerce").dropna().values

            subjects[name]["frequencies"][f_label] = {
                "before": be_vals,
                "after": af_vals
            }

    return subjects


def parse_myoton_excel(file_path: str):
    import pandas as pd
    xls = pd.ExcelFile(file_path)

    # 1. Check all sheets for new OCT Foot Record format (e.g. KYLE OCT.xlsx)
    all_kyle_data = {}
    found_kyle = False

    for s_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=s_name, header=None)
        first_cells = [str(df.iloc[r, 0]) for r in range(min(10, len(df))) if pd.notna(df.iloc[r, 0])]
        is_kyle = any('OCT FOOT MEASUREMENT' in c or 'Participant' in c or 'Protocol' in c for c in first_cells)

        if is_kyle:
            participant = 'KYLE'
            protocols = []
            current_date = None

            for r in range(len(df)):
                c0 = df.iloc[r, 0]
                c0_str = str(c0).strip() if pd.notna(c0) else ''

                if 'participant' in c0_str.lower():
                    parts = c0_str.split(':')
                    if len(parts) > 1 and parts[1].strip():
                        participant = parts[1].strip()

                if 'date' in c0_str.lower():
                    d_val = df.iloc[r, 1] if df.shape[1] > 1 else None
                    current_date = str(d_val) if pd.notna(d_val) else c0_str

                if c0_str.lower().startswith('protocol'):
                    m_proto = re.search(r'protocol\s*(\d+)', c0_str, re.I)
                    proto_num = int(m_proto.group(1)) if m_proto else len(protocols) + 1

                    m_freq = re.search(r'frequency:\s*([\d.]+)\s*hz', c0_str, re.I)
                    freq_str = (m_freq.group(1) + 'Hz') if m_freq else 'Unknown'

                    m_int = re.search(r'intensity:\s*([\d.]+)%?', c0_str, re.I)
                    int_str = (m_int.group(1) + '%') if m_int else 'Unknown'

                    foot_cell = df.iloc[r + 1, 0] if r + 1 < len(df) else None
                    foot_str = str(foot_cell).strip() if pd.notna(foot_cell) else 'Unknown Foot'

                    pts = {}
                    for p_idx in range(1, 10):
                        data_r = r + 3 + p_idx
                        if data_r >= len(df):
                            continue

                        e1_be = float(df.iloc[data_r, 1]) if pd.notna(df.iloc[data_r, 1]) else 0.0
                        e2_be = float(df.iloc[data_r, 2]) if pd.notna(df.iloc[data_r, 2]) else 0.0
                        e3_be = float(df.iloc[data_r, 3]) if pd.notna(df.iloc[data_r, 3]) else 0.0

                        e1_af = float(df.iloc[data_r, 5]) if pd.notna(df.iloc[data_r, 5]) else 0.0
                        e2_af = float(df.iloc[data_r, 6]) if pd.notna(df.iloc[data_r, 6]) else 0.0
                        e3_af = float(df.iloc[data_r, 7]) if pd.notna(df.iloc[data_r, 7]) else 0.0

                        m_be = round((e1_be + e2_be + e3_be) / 3.0, 1)
                        m_af = round((e1_af + e2_af + e3_af) / 3.0, 1)
                        d = round(m_af - m_be, 1)

                        pts[p_idx] = {
                            'pointId': p_idx,
                            'before': m_be,
                            'after': m_af,
                            'delta': d,
                            'triplicatesBefore': [e1_be, e2_be, e3_be],
                            'triplicatesAfter': [e1_af, e2_af, e3_af]
                        }

                    protocols.append({
                        'protocolNum': proto_num,
                        'name': f'Protocol {proto_num}: {freq_str} {int_str} ({foot_str})',
                        'frequency': freq_str,
                        'intensity': int_str,
                        'foot': foot_str,
                        'date': current_date,
                        'points': pts
                    })

            standard_points = {}
            for p_idx in range(1, 10):
                cp = COMPASS_POINTS[p_idx - 1]
                freqs = {}
                for p in protocols:
                    pt = p['points'].get(p_idx, {})
                    freqs[p['name']] = {'before': pt.get('before', 0.0), 'after': pt.get('after', 0.0), 'delta': pt.get('delta', 0.0)}

                p1_pt = protocols[0]['points'].get(p_idx, {}) if len(protocols) > 0 else {}
                p50_matches = [p for p in protocols if '50' in p['frequency']]
                p50_pt = p50_matches[0]['points'].get(p_idx, {}) if len(p50_matches) > 0 else p1_pt

                freqs['1Hz'] = {'before': p1_pt.get('before', 0.0), 'after': p1_pt.get('after', 0.0), 'delta': p1_pt.get('delta', 0.0)}
                freqs['50Hz'] = {'before': p50_pt.get('before', 0.0), 'after': p50_pt.get('after', 0.0), 'delta': p50_pt.get('delta', 0.0)}
                freqs['30Hz'] = freqs['1Hz']
                freqs['100Hz'] = freqs['50Hz']

                standard_points[p_idx] = {
                    'pointId': p_idx,
                    'compassName': cp['name'],
                    'compassCode': cp['code'],
                    'gridRow': cp['row'],
                    'gridCol': cp['col'],
                    'frequencies': freqs
                }

            s_data = {
                'id': len(all_kyle_data) + 1,
                'name': participant,
                'isProtocolFormat': True,
                'protocols': protocols,
                'points': standard_points
            }
            all_kyle_data[participant] = s_data
            all_kyle_data[len(all_kyle_data)] = s_data
            if 'ALL' not in all_kyle_data:
                all_kyle_data['ALL'] = s_data
            found_kyle = True

    if found_kyle:
        return all_kyle_data

    # 2. Standard / Legacy Subject-block format
    df = pd.read_excel(file_path, header=None)

    # 2. Standard / Legacy Subject-block format
    subject_ranges = [
        (1, "Bas", 3),
        (2, "Cornel", 13),
        (3, "Reuben", 23)
    ]

    myoton_data = {}

    for s_id, s_name, start_r in subject_ranges:
        s_data = {"id": s_id, "name": s_name, "points": {}}
        for p_idx in range(1, 10):
            r = start_r + p_idx - 1
            if r >= len(df):
                continue
            row = df.iloc[r]
            cp = COMPASS_POINTS[p_idx - 1]

            be_30 = float(row[1]) if pd.notna(row[1]) else 0.0
            af_30 = float(row[2]) if pd.notna(row[2]) else 0.0
            be_50 = float(row[3]) if pd.notna(row[3]) else 0.0
            af_50 = float(row[4]) if pd.notna(row[4]) else 0.0
            be_100 = float(row[5]) if pd.notna(row[5]) else 0.0
            af_100 = float(row[6]) if pd.notna(row[6]) else 0.0

            s_data["points"][p_idx] = {
                "pointId": p_idx,
                "compassName": cp["name"],
                "compassCode": cp["code"],
                "gridRow": cp["row"],
                "gridCol": cp["col"],
                "frequencies": {
                    "30Hz": {"before": be_30, "after": af_30, "delta": round(af_30 - be_30, 2)},
                    "50Hz": {"before": be_50, "after": af_50, "delta": round(af_50 - be_50, 2)},
                    "100Hz": {"before": be_100, "after": af_100, "delta": round(af_100 - be_100, 2)}
                }
            }
        myoton_data[s_id] = s_data
        myoton_data[s_name] = s_data

    return myoton_data


def run_protocol_b_analysis(micro_file: str, myoton_file: str, subject: str = "Bas", freq: str = "30Hz",
                            fs: float = 40.0, dwell_sec: float = 7.41, estimator: str = "p25"):
    micro_subjects = parse_microcirculation_excel(micro_file)
    myoton_subjects = parse_myoton_excel(myoton_file)

    if subject not in micro_subjects:
        # fallback to first subject
        subject = list(micro_subjects.keys())[0]

    subj_micro = micro_subjects[subject]
    subj_myoton = myoton_subjects.get(subject, list(myoton_subjects.values())[0])

    be_samples = subj_micro["frequencies"][freq]["before"]
    af_samples = subj_micro["frequencies"][freq]["after"]

    dwells_be = segment_signal(be_samples, fs=fs, dwell_sec=dwell_sec, method=estimator)
    dwells_af = segment_signal(af_samples, fs=fs, dwell_sec=dwell_sec, method=estimator)

    cells = []
    flux_be_arr, flux_af_arr, flux_d_arr = [], [], []
    stiff_be_arr, stiff_af_arr, stiff_d_arr = [], [], []

    for i in range(9):
        p_id = i + 1
        cp = COMPASS_POINTS[i]
        fb = dwells_be[i]["value"]
        fa = dwells_af[i]["value"]
        df = round(fa - fb, 2)

        myo_p = subj_myoton["points"].get(p_id, {})
        myo_freq = myo_p.get("frequencies", {}).get(freq, {"before": 0.0, "after": 0.0, "delta": 0.0})
        sb = myo_freq["before"]
        sa = myo_freq["after"]
        ds = round(sa - sb, 2)

        flux_be_arr.append(fb)
        flux_af_arr.append(fa)
        flux_d_arr.append(df)
        stiff_be_arr.append(sb)
        stiff_af_arr.append(sa)
        stiff_d_arr.append(ds)

        cells.append({
            "id": p_id,
            "name": cp["name"],
            "code": cp["code"],
            "row": cp["row"],
            "col": cp["col"],
            "fluxBefore": fb,
            "fluxAfter": fa,
            "fluxDelta": df,
            "fluxChangePct": round((df / fb * 100), 1) if fb > 0 else 0.0,
            "stiffBefore": sb,
            "stiffAfter": sa,
            "stiffDelta": ds,
            "stiffChangePct": round((ds / sb * 100), 1) if sb > 0 else 0.0
        })

    # Statistical Concordance
    spearman_rho, spearman_p = stats.spearmanr(flux_d_arr, stiff_d_arr)
    pearson_r, pearson_p = stats.pearsonr(flux_d_arr, stiff_d_arr)

    return {
        "status": "success",
        "engine": "Python SciPy Core (v3.12)",
        "subject": subject,
        "frequency": freq,
        "samplingRateHz": fs,
        "dwellDurationSec": dwell_sec,
        "estimator": estimator,
        "cells": cells,
        "correlations": {
            "deltaSpearman": round(float(spearman_rho), 3) if not np.isnan(spearman_rho) else 0.0,
            "deltaSpearmanPValue": round(float(spearman_p), 4) if not np.isnan(spearman_p) else 1.0,
            "deltaPearson": round(float(pearson_r), 3) if not np.isnan(pearson_r) else 0.0,
            "deltaPearsonPValue": round(float(pearson_p), 4) if not np.isnan(pearson_p) else 1.0
        },
        "means": {
            "fluxBeforeMean": round(float(np.mean(flux_be_arr)), 2),
            "fluxAfterMean": round(float(np.mean(flux_af_arr)), 2),
            "fluxDeltaMean": round(float(np.mean(flux_d_arr)), 2),
            "stiffBeforeMean": round(float(np.mean(stiff_be_arr)), 1),
            "stiffAfterMean": round(float(np.mean(stiff_af_arr)), 1),
            "stiffDeltaMean": round(float(np.mean(stiff_d_arr)), 1)
        }
    }


def run_fast_protocol_b(payload: dict):
    subject = payload.get("subject", "Bas")
    freq = payload.get("freq", "30Hz")
    fs = float(payload.get("fs", 40.0))
    dwell_sec = float(payload.get("dwellDuration", 7.41))
    estimator = payload.get("estimator", "p25")

    # If raw timeseries samples are provided in payload:
    if "beSamples" in payload and "afSamples" in payload and len(payload["beSamples"]) > 0:
        be_samples = np.array(payload["beSamples"], dtype=float)
        af_samples = np.array(payload["afSamples"], dtype=float)
        dwells_be = segment_signal(be_samples, fs=fs, dwell_sec=dwell_sec, method=estimator)
        dwells_af = segment_signal(af_samples, fs=fs, dwell_sec=dwell_sec, method=estimator)
        flux_be_arr = [d["value"] for d in dwells_be]
        flux_af_arr = [d["value"] for d in dwells_af]
    elif "dwellsBefore" in payload and "dwellsAfter" in payload:
        dwells_be_in = payload["dwellsBefore"]
        dwells_af_in = payload["dwellsAfter"]
        flux_be_arr = [float(d["value"] if isinstance(d, dict) else d) for d in dwells_be_in]
        flux_af_arr = [float(d["value"] if isinstance(d, dict) else d) for d in dwells_af_in]
    else:
        flux_be_arr = [0.0] * 9
        flux_af_arr = [0.0] * 9

    # Helper to extract (before, after) stiffness values from various object schemas
    def extract_stiffness(pt):
        if isinstance(pt, dict):
            if "stiffBefore" in pt and "stiffAfter" in pt:
                return float(pt.get("stiffBefore", 0.0)), float(pt.get("stiffAfter", 0.0))
            if "frequencies" in pt and isinstance(pt["frequencies"], dict) and freq in pt["frequencies"]:
                f_obj = pt["frequencies"][freq]
                return float(f_obj.get("before", 0.0)), float(f_obj.get("after", 0.0))
            if "before" in pt and "after" in pt:
                return float(pt.get("before", 0.0)), float(pt.get("after", 0.0))
        elif isinstance(pt, (int, float)):
            return float(pt), float(pt)
        return 0.0, 0.0

    # Myoton points
    myo_be_arr = []
    myo_af_arr = []
    myo_pts = payload.get("myotonPoints", [])
    if isinstance(myo_pts, dict):
        for i in range(1, 10):
            pt = myo_pts.get(str(i), myo_pts.get(i, {}))
            sb, sa = extract_stiffness(pt)
            myo_be_arr.append(sb)
            myo_af_arr.append(sa)
    elif isinstance(myo_pts, list):
        for i in range(9):
            if i < len(myo_pts):
                sb, sa = extract_stiffness(myo_pts[i])
                myo_be_arr.append(sb)
                myo_af_arr.append(sa)
            else:
                myo_be_arr.append(0.0)
                myo_af_arr.append(0.0)
    else:
        myo_be_arr = [0.0] * 9
        myo_af_arr = [0.0] * 9

    flux_d_arr = [round(fa - fb, 2) for fb, fa in zip(flux_be_arr, flux_af_arr)]
    stiff_d_arr = [round(sa - sb, 2) for sb, sa in zip(myo_be_arr, myo_af_arr)]

    cells = []
    for i in range(9):
        p_id = i + 1
        cp = COMPASS_POINTS[i]
        fb = flux_be_arr[i]
        fa = flux_af_arr[i]
        df = flux_d_arr[i]
        sb = myo_be_arr[i]
        sa = myo_af_arr[i]
        ds = stiff_d_arr[i]

        cells.append({
            "id": p_id,
            "name": cp["name"],
            "code": cp["code"],
            "row": cp["row"],
            "col": cp["col"],
            "fluxBefore": fb,
            "fluxAfter": fa,
            "fluxDelta": df,
            "fluxChangePct": round((df / fb * 100), 1) if fb > 0 else 0.0,
            "stiffBefore": sb,
            "stiffAfter": sa,
            "stiffDelta": ds,
            "stiffChangePct": round((ds / sb * 100), 1) if sb > 0 else 0.0
        })

    # Statistical Concordance via SciPy
    spearman_rho, spearman_p = stats.spearmanr(flux_d_arr, stiff_d_arr)
    pearson_r, pearson_p = stats.pearsonr(flux_d_arr, stiff_d_arr)

    return {
        "status": "success",
        "engine": "Python SciPy Core (Fast In-Memory IPC)",
        "subject": subject,
        "frequency": freq,
        "samplingRateHz": fs,
        "dwellDurationSec": dwell_sec,
        "estimator": estimator,
        "cells": cells,
        "correlations": {
            "deltaSpearman": round(float(spearman_rho), 3) if not np.isnan(spearman_rho) else 0.0,
            "deltaSpearmanPValue": round(float(spearman_p), 4) if not np.isnan(spearman_p) else 1.0,
            "deltaPearson": round(float(pearson_r), 3) if not np.isnan(pearson_r) else 0.0,
            "deltaPearsonPValue": round(float(pearson_p), 4) if not np.isnan(pearson_p) else 1.0
        },
        "means": {
            "fluxBeforeMean": round(float(np.mean(flux_be_arr)), 2),
            "fluxAfterMean": round(float(np.mean(flux_af_arr)), 2),
            "fluxDeltaMean": round(float(np.mean(flux_d_arr)), 2),
            "stiffBeforeMean": round(float(np.mean(myo_be_arr)), 1),
            "stiffAfterMean": round(float(np.mean(myo_af_arr)), 1),
            "stiffDeltaMean": round(float(np.mean(stiff_d_arr)), 1)
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Microcirculation & Myoton Python CLI Analyzer")
    parser.add_argument("--task", default="protocol_b_grid", choices=["health", "protocol_b_grid", "fast_grid", "parse_summary"])
    parser.add_argument("--stdin", action="store_true", help="Read payload JSON from standard input")
    parser.add_argument("--payload-json", help="Direct JSON payload string or file")
    parser.add_argument("--micro-file", help="Path to microcirculation-data.xlsx")
    parser.add_argument("--myoton-file", help="Path to OCT_Myoton(R_R)(2).xlsx")
    parser.add_argument("--subject", default="Bas")
    parser.add_argument("--freq", default="30Hz")
    parser.add_argument("--fs", type=float, default=40.0)
    parser.add_argument("--dwell-duration", type=float, default=7.41)
    parser.add_argument("--estimator", default="p25", choices=["p25", "median", "mean"])
    parser.add_argument("--output-json", help="Optional output JSON file")

    args = parser.parse_args()

    if args.task == "health":
        res = {"status": "ok", "version": "2.1.0", "python": sys.version}
        print(json.dumps(res, indent=2))
        return

    # Fast Grid Execution via stdin or payload-json
    if args.task == "fast_grid" or args.stdin or args.payload_json:
        if args.stdin:
            input_data = sys.stdin.read()
            payload = json.loads(input_data)
        elif args.payload_json:
            if os.path.exists(args.payload_json):
                with open(args.payload_json, "r", encoding="utf-8") as pf:
                    payload = json.load(pf)
            else:
                payload = json.loads(args.payload_json)
        else:
            payload = {}

        result = run_fast_protocol_b(payload)
        if args.output_json:
            with open(args.output_json, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
        print(json.dumps(result, indent=2))
        return

    if args.task == "protocol_b_grid":
        if not args.micro_file or not args.myoton_file:
            print(json.dumps({"status": "error", "message": "Missing --micro-file or --myoton-file"}, indent=2))
            sys.exit(1)

        result = run_protocol_b_analysis(
            micro_file=args.micro_file,
            myoton_file=args.myoton_file,
            subject=args.subject,
            freq=args.freq,
            fs=args.fs,
            dwell_sec=args.dwell_duration,
            estimator=args.estimator
        )

        if args.output_json:
            with open(args.output_json, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
