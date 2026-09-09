"""
Statistical analysis routines for microcirculation data:
- One-way ANOVA with effect sizes (eta-squared)
- Time segment extraction (0-2 min, 2-3.5 min, 3.5-5 min)
- Jackknife / leave-one-out subject robustness testing
- Paired parametric & non-parametric hypothesis tests
"""
from __future__ import annotations
from typing import Optional
import numpy as np
import pandas as pd
from scipy import stats as sp_stats

from .sbf_core import ConditionResult, SBFConfig, filter_signal

SEG_BOUNDS_DEFAULT = [(0.0, 2.0), (2.0, 3.5), (3.5, 5.0)]
SEG_LABELS_DEFAULT = ["0-2 min", "2-3.5 min", "3.5-5 min"]


def extract_segments(af_filt: np.ndarray, fs: float = 40.0,
                     bounds: list[tuple[float, float]] = SEG_BOUNDS_DEFAULT) -> Optional[list[np.ndarray]]:
    """Splits filtered signal into specified time segments (in minutes)."""
    total = len(af_filt)
    if total / fs < 60.0:
        return None

    segs = []
    for t0_min, t1_min in bounds:
        i0 = int(round(t0_min * 60.0 * fs))
        i1 = min(int(round(t1_min * 60.0 * fs)), total)
        if i0 >= total:
            break
        seg = af_filt[i0:i1]
        if len(seg) < 10:
            break
        segs.append(seg)

    return segs if len(segs) == len(bounds) else None


def compute_eta_squared(groups: list[np.ndarray]) -> float:
    """Computes eta-squared effect size for one-way ANOVA."""
    all_data = np.concatenate(groups)
    grand_mean = np.mean(all_data)
    ss_total = float(np.sum((all_data - grand_mean) ** 2))
    ss_between = float(sum(len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups))
    return (ss_between / ss_total) if ss_total > 0 else 0.0


def run_anova(groups: list[np.ndarray]) -> dict:
    """Executes 1-way ANOVA across groups."""
    if any(len(g) < 2 for g in groups):
        return {"F": np.nan, "p": np.nan, "eta_sq": np.nan, "sig": False}
    f_val, p_val = sp_stats.f_oneway(*groups)
    eta_sq = compute_eta_squared(groups)
    return {
        "F": float(f_val),
        "p": float(p_val),
        "eta_sq": round(float(eta_sq), 6),
        "sig": bool(p_val < 0.05),
    }


def run_leave_one_out_simulation(per_cond: list[ConditionResult],
                                 freq: int = 50,
                                 bucket_idx: int = 1) -> pd.DataFrame:
    """
    Evaluates model robustness by systematically excluding one subject at a time
    and assessing stability of group mean, SD, and p-value.
    """
    subjects = [r for r in per_cond if r.freq_hz == freq and len(r.bucket_df) >= bucket_idx]
    if len(subjects) < 4:
        return pd.DataFrame()

    all_vals = np.array([r.bucket_df.iloc[bucket_idx - 1]["change_pct"] for r in subjects])
    all_names = [r.person for r in subjects]
    base_mean = float(np.mean(all_vals))
    base_std = float(np.std(all_vals, ddof=1))

    rows = [{
        "excluded_subject": "None (All Included)",
        "n_remaining": len(all_vals),
        "mean_change_pct": base_mean,
        "std_change_pct": base_std,
        "delta_mean": 0.0,
        "shapiro_p": float(sp_stats.shapiro(all_vals)[1]) if len(all_vals) >= 3 else np.nan,
    }]

    for i in range(len(subjects)):
        remaining = np.delete(all_vals, i)
        m = float(np.mean(remaining))
        s = float(np.std(remaining, ddof=1)) if len(remaining) > 1 else 0.0
        shp_p = float(sp_stats.shapiro(remaining)[1]) if len(remaining) >= 3 else np.nan

        rows.append({
            "excluded_subject": all_names[i],
            "n_remaining": len(remaining),
            "mean_change_pct": m,
            "std_change_pct": s,
            "delta_mean": m - base_mean,
            "shapiro_p": shp_p,
        })

    return pd.DataFrame(rows)


def run_paired_comparison(group_a: np.ndarray, group_b: np.ndarray) -> dict:
    """Runs Shapiro normality check followed by paired t-test and Wilcoxon signed rank."""
    diff = group_b - group_a
    n = len(diff)
    if n < 3:
        return {"t_stat": np.nan, "t_p": np.nan, "w_stat": np.nan, "w_p": np.nan, "normal": False}

    _, p_norm = sp_stats.shapiro(diff)
    t_stat, t_p = sp_stats.ttest_rel(group_b, group_a)
    try:
        w_stat, w_p = sp_stats.wilcoxon(group_b, group_a, alternative="two-sided")
    except Exception:
        w_stat, w_p = np.nan, np.nan

    return {
        "n": n,
        "mean_diff": float(np.mean(diff)),
        "std_diff": float(np.std(diff, ddof=1)),
        "shapiro_p": float(p_norm),
        "is_normal": bool(p_norm > 0.05),
        "paired_t_stat": float(t_stat),
        "paired_t_p": float(t_p),
        "wilcoxon_stat": float(w_stat),
        "wilcoxon_p": float(w_p),
        "preferred_p": float(t_p) if p_norm > 0.05 else float(w_p),
    }
