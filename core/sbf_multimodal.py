"""
Multimodal Plantar Foot Grid analysis module:
Integrates Laser-Doppler skin microcirculation flux with Myotonometer tissue stiffness.
Coordinates 9 anatomical plantar sites: [5, 2, 6, 8, 4, 3, 9, 7, 1].
"""
from __future__ import annotations
import re, csv
from pathlib import Path
from typing import Union, Optional, Literal
import numpy as np
import pandas as pd
from scipy import stats as sp_stats

# Standard 9-point measurement sequence -> plantar grid coordinate
PLANTAR_PATH = [5, 2, 6, 8, 4, 3, 9, 7, 1]
PATH = PLANTAR_PATH


def read_flux_series(path: Union[str, Path]) -> np.ndarray:
    """Reads single-channel laser-Doppler flux time-series from text file."""
    vals = []
    text = Path(path).read_text(errors="ignore")
    for line in text.splitlines():
        toks = line.replace(",", " ").split()
        if not toks:
            continue
        try:
            vals.append(float(toks[0]))
        except ValueError:
            continue
    return np.array(vals, dtype=float)


def parse_myoton_text(path: Union[str, Path]) -> dict:
    """
    Parses Myoton recording file containing:
      - stiff_before, stiff_after (9 ints in PATH order)
      - ts_before, ts_after (cumulative seconds at end of each coordinate window)
    """
    text = Path(path).read_text(errors="ignore")

    # Dash or space-separated stiffness rows
    dash = re.findall(r"\d+(?:\s*[-|]\s*\d+){4,}", text)
    if len(dash) >= 2:
        stiff_before = [int(x) for x in re.findall(r"\d+", dash[0])]
        stiff_after = [int(x) for x in re.findall(r"\d+", dash[1])]
    else:
        # Fallback: find rows of 9 numbers
        all_nums = [int(x) for x in re.findall(r"\b\d{2,4}\b", text)]
        stiff_before = all_nums[:9] if len(all_nums) >= 18 else [0] * 9
        stiff_after = all_nums[9:18] if len(all_nums) >= 18 else [0] * 9

    # Timestamp rows: NN MM.SS.hh MM.SS.hh
    rows = re.findall(
        r"^\s*(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})",
        text, re.M
    )
    cums = []
    for _idx, cm, cs, ch, _dm, _ds, _dh in rows:
        cums.append(int(cm) * 60 + int(cs) + int(ch) / 100.0)

    if len(cums) >= 18:
        ts_before = cums[:9]
        ts_after = cums[9:18]
    elif len(cums) >= 9:
        ts_before = cums[:9]
        ts_after = cums[:9]
    else:
        # Fallback default uniform ~5s windows
        ts_before = [float(5.0 * (i + 1)) for i in range(9)]
        ts_after = [float(5.0 * (i + 1)) for i in range(9)]

    return {
        "stiff_before": stiff_before[:9],
        "stiff_after": stiff_after[:9],
        "ts_before": ts_before[:9],
        "ts_after": ts_after[:9],
    }


def compute_dwell_estimator(seg: np.ndarray,
                            method: Literal["p25", "median", "stable2s"] = "p25",
                            fs: float = 40.0) -> float:
    """
    Estimates steady-state perfusion level in a coordinate dwell segment.
    - 'p25': 25th percentile (resists upward motion/probe-movement artifacts)
    - 'median': Window median
    - 'stable2s': Mean of the 2-second sub-window with minimum variance
    """
    if len(seg) == 0:
        return 0.0

    if method == "p25":
        return float(np.percentile(seg, 25))
    elif method == "median":
        return float(np.median(seg))
    elif method == "stable2s":
        win = int(2.0 * fs)
        if len(seg) <= win:
            return float(np.median(seg))
        # Sliding variance
        min_var = float("inf")
        best_mean = float(np.median(seg))
        for i in range(len(seg) - win + 1):
            sub = seg[i:i + win]
            v = float(np.var(sub))
            if v < min_var:
                min_var = v
                best_mean = float(np.mean(sub))
        return best_mean
    return float(np.median(seg))


def segment_flux_into_coords(flux: np.ndarray, cum_times: list[float],
                             fs: float = 40.0,
                             estimator: Literal["p25", "median", "stable2s"] = "p25",
                             min_samples: int = 20) -> list[dict]:
    """Segments raw flux trace into 9 coordinate dwells based on cumulative timestamp boundaries."""
    out = []
    prev = 0.0
    for m, cum in enumerate(cum_times, start=1):
        s0 = int(round(prev * fs))
        s1 = min(int(round(cum * fs)), len(flux))
        seg = flux[s0:s1]
        prev = cum

        if len(seg) < min_samples:
            out.append({
                "m": m,
                "n": len(seg),
                "flux": np.nan,
                "median": np.nan,
                "iqr": np.nan,
                "s0": s0,
                "s1": s1,
            })
            continue

        q25, q50, q75 = np.percentile(seg, [25, 50, 75])
        val = compute_dwell_estimator(seg, method=estimator, fs=fs)

        out.append({
            "m": m,
            "n": len(seg),
            "flux": round(val, 2),
            "median": round(float(q50), 2),
            "iqr": round(float(q75 - q25), 2),
            "s0": s0,
            "s1": s1,
        })
    return out


def process_multimodal_subject(subject_name: str,
                               flux_before_path: Union[str, Path],
                               flux_after_path: Union[str, Path],
                               myoton_path: Union[str, Path],
                               fs: float = 40.0,
                               estimator: Literal["p25", "median", "stable2s"] = "p25") -> dict:
    """
    Executes complete multimodal analysis for one subject across all 9 plantar grid sites.
    """
    flux_b = read_flux_series(flux_before_path)
    flux_a = read_flux_series(flux_after_path)
    myo = parse_myoton_text(myoton_path)

    seg_b = segment_flux_into_coords(flux_b, myo["ts_before"], fs=fs, estimator=estimator)
    seg_a = segment_flux_into_coords(flux_a, myo["ts_after"], fs=fs, estimator=estimator)

    rec = {}
    for i, cell in enumerate(PLANTAR_PATH):
        fb_val = seg_b[i]["flux"] if i < len(seg_b) else np.nan
        fa_val = seg_a[i]["flux"] if i < len(seg_a) else np.nan
        sb_val = myo["stiff_before"][i] if i < len(myo["stiff_before"]) else 0
        sa_val = myo["stiff_after"][i] if i < len(myo["stiff_after"]) else 0

        d_flux = (fa_val - fb_val) if not np.isnan(fa_val) and not np.isnan(fb_val) else np.nan
        d_stiff = sa_val - sb_val

        rec[cell] = {
            "cell": cell,
            "path_index": i + 1,
            "flux_before": fb_val,
            "flux_after": fa_val,
            "flux_delta": d_flux,
            "stiff_before": sb_val,
            "stiff_after": sa_val,
            "stiff_delta": d_stiff,
            "n_before": seg_b[i]["n"] if i < len(seg_b) else 0,
            "n_after": seg_a[i]["n"] if i < len(seg_a) else 0,
        }

    cells = sorted(rec.keys())
    fbv = [rec[c]["flux_before"] for c in cells]
    fav = [rec[c]["flux_after"] for c in cells]
    sbv = [rec[c]["stiff_before"] for c in cells]
    sav = [rec[c]["stiff_after"] for c in cells]
    fdv = [rec[c]["flux_delta"] for c in cells]
    sdv = [rec[c]["stiff_delta"] for c in cells]

    # Spatial concordance (Spearman rho and Pearson r)
    def safe_corr(x, y):
        x = np.array(x, dtype=float)
        y = np.array(y, dtype=float)
        valid = ~(np.isnan(x) | np.isnan(y))
        if valid.sum() < 3 or np.all(x[valid] == x[valid][0]) or np.all(y[valid] == y[valid][0]):
            return np.nan, np.nan
        r, _ = sp_stats.pearsonr(x[valid], y[valid])
        rho, _ = sp_stats.spearmanr(x[valid], y[valid])
        return float(r), float(rho)

    r_bef, rho_bef = safe_corr(fbv, sbv)
    r_aft, rho_aft = safe_corr(fav, sav)
    r_del, rho_del = safe_corr(fdv, sdv)

    summary_df = pd.DataFrame([rec[c] for c in cells])

    return {
        "subject": subject_name,
        "grid_dict": rec,
        "summary_df": summary_df,
        "flux_before_raw": flux_b,
        "flux_after_raw": flux_a,
        "seg_before": seg_b,
        "seg_after": seg_a,
        "myoton": myo,
        "correlations": {
            "before_pearson": r_bef, "before_spearman": rho_bef,
            "after_pearson": r_aft, "after_spearman": rho_aft,
            "delta_pearson": r_del, "delta_spearman": rho_del,
        },
        "group_means": {
            "flux_before_mean": float(np.nanmean(fbv)),
            "flux_after_mean": float(np.nanmean(fav)),
            "flux_delta_mean": float(np.nanmean(fdv)),
            "stiff_before_mean": float(np.mean(sbv)),
            "stiff_after_mean": float(np.mean(sav)),
            "stiff_delta_mean": float(np.mean(sdv)),
        }
    }


def to_3x3_grid(dict_values: dict[int, float]) -> np.ndarray:
    """Converts a dict {cell_1_to_9: val} to a 3x3 2D array."""
    grid = np.zeros((3, 3), dtype=float)
    for r in range(3):
        for c in range(3):
            cell = r * 3 + c + 1
            grid[r, c] = dict_values.get(cell, np.nan)
    return grid


# Backward-compatible aliases
read_flux = read_flux_series
parse_myoton_file = parse_myoton_text
segment_flux = segment_flux_into_coords
