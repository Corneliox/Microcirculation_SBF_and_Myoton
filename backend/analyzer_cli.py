"""
Microcirculation & Myotonometer Analytics Engine - CLI Bridge for Electron / JavaScript UI
Accepts JSON parameters or CLI flags, performs numerical DSP/Statistics, and returns structured JSON.
"""

import sys
import os
import json
import argparse
import numpy as np

# Ensure root directory is on Python path to access core module
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import pandas as pd
from scipy import stats

COMPASS_POINTS = [
    {"id": 1, "name": "Barat Laut (NW)", "code": "NW", "row": 0, "col": 0},
    {"id": 2, "name": "Utara (N)", "code": "N", "row": 0, "col": 1},
    {"id": 3, "name": "Timur Laut (NE)", "code": "NE", "row": 0, "col": 2},
    {"id": 4, "name": "Barat (W)", "code": "W", "row": 1, "col": 0},
    {"id": 5, "name": "Tengah (C)", "code": "C", "row": 1, "col": 1},
    {"id": 6, "name": "Timur (E)", "code": "E", "row": 1, "col": 2},
    {"id": 7, "name": "Barat Daya (SW)", "code": "SW", "row": 2, "col": 0},
    {"id": 8, "name": "Selatan (S)", "code": "S", "row": 2, "col": 1},
    {"id": 9, "name": "Tenggara (SE)", "code": "SE", "row": 2, "col": 2},
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
    df = pd.read_excel(file_path, header=None)
    # Subject 1 (Bas): rows 3-11 (0-indexed 3..11)
    # Subject 2 (Cornel): rows 13-21
    # Subject 3 (Reuben): rows 23-31
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


def main():
    parser = argparse.ArgumentParser(description="Microcirculation & Myoton Python CLI Analyzer")
    parser.add_argument("--task", default="protocol_b_grid", choices=["health", "protocol_b_grid", "parse_summary"])
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
