"""
Horizontal-format SBF parser.

Input: a single xlsx/csv where each person occupies a 7-column block:
    [name] [50hz_label] [be] [af] [100hz_label] [be] [af]

Parses the header row, extracts every person's four recordings (be_50, af_50,
be_100, af_100), filters them, computes per-person baselines from the "be"
columns, bucketizes the "af" columns, and aggregates across people per
frequency. Also runs a paired 50 vs 100 Hz comparison per bucket.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
import pandas as pd
from scipy import stats as sps_stats
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from sbf_analysis import SBFConfig, hampel_filter, savitzky_golay, butter_lowpass
from sbf_multi import flag_bucket_outliers


# ──────────────────────────────────────────────────────────────────────────
# 1. Parser
# ──────────────────────────────────────────────────────────────────────────
FREQ_LABEL_RE = re.compile(r"^\s*(\d+)\s*hz\s*$", re.IGNORECASE)
BE_TOKENS = {"be", "before", "BEFORE", "pre", "Be", "BE"}
AF_TOKENS = {"af", "after", "AFTER", "post", "Af", "AF"}


def _is_freq_label(v) -> Optional[int]:
    """Returns the int Hz value if cell is a frequency label like '50hz', else None."""
    if not isinstance(v, str): return None
    m = FREQ_LABEL_RE.match(v.strip())
    return int(m.group(1)) if m else None


def _norm_token(v) -> str:
    return str(v).strip().lower() if v is not None else ""


@dataclass
class Recording:
    person: str
    freq_hz: int
    phase: str                  # "be" or "af"
    column_letter: str
    signal_raw: np.ndarray      # unfiltered
    signal_filt: np.ndarray     # after Hampel + Sav-Gol
    outlier_mask: np.ndarray    # which samples Hampel replaced


def parse_horizontal_xlsx(path: str, sheet=0) -> list[dict]:
    """
    Parses the header row and returns a list of person-blocks:
        [{name, blocks: {50: {'be':col, 'af':col}, 100: {'be':col, 'af':col}}}, ...]
    Each col is an int 1-based column index.
    """
    wb = load_workbook(path, data_only=True)
    if isinstance(sheet, int):
        ws = wb.worksheets[sheet]
    else:
        ws = wb[sheet]

    header = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]
    persons = []

    c = 0
    while c < len(header):
        h = header[c]
        if h is None or _is_freq_label(h) is not None or _norm_token(h) in BE_TOKENS | AF_TOKENS:
            c += 1; continue
        # h is a person name
        name = str(h).strip()
        # Expect: [name] [freqA] [be] [af] [freqB] [be] [af]
        freq_a = _is_freq_label(header[c+1]) if c+1 < len(header) else None
        if freq_a is None:
            c += 1; continue   # not a valid block start

        be_a_col, af_a_col = c+2+1, c+3+1   # +1 for 1-based
        freq_b = _is_freq_label(header[c+4]) if c+4 < len(header) else None
        be_b_col = af_b_col = None
        if freq_b is not None:
            be_b_col, af_b_col = c+5+1, c+6+1

        # Verify labels
        ok_a = (_norm_token(header[c+2]) in BE_TOKENS and
                _norm_token(header[c+3]) in AF_TOKENS)
        ok_b = freq_b is None or (_norm_token(header[c+5]) in BE_TOKENS and
                                  _norm_token(header[c+6]) in AF_TOKENS)
        if not (ok_a and ok_b):
            c += 1; continue

        block = {"name": name, "blocks": {freq_a: {"be": be_a_col, "af": af_a_col}}}
        if freq_b is not None:
            block["blocks"][freq_b] = {"be": be_b_col, "af": af_b_col}
        persons.append(block)
        c += 7 if freq_b is not None else 4

    return persons, ws


def _load_column(ws, col_idx: int) -> np.ndarray:
    vals = []
    for r in range(2, ws.max_row + 1):
        v = ws.cell(r, col_idx).value
        if isinstance(v, (int, float)):
            vals.append(float(v))
    return np.array(vals, dtype=float)


# ──────────────────────────────────────────────────────────────────────────
# 2. Per-recording filter
# ──────────────────────────────────────────────────────────────────────────
def filter_signal(raw: np.ndarray, cfg: SBFConfig) -> tuple[np.ndarray, np.ndarray]:
    sig = raw.copy()
    mask = np.zeros_like(raw, dtype=bool)
    if cfg.use_hampel:
        sig, mask = hampel_filter(sig, cfg.hampel_window, cfg.hampel_n_sigmas)
    if cfg.use_lowpass:
        sig = butter_lowpass(sig, cfg.sampling_rate_hz, cfg.lowpass_cutoff_hz, cfg.lowpass_order)
    if cfg.use_savgol and len(sig) > cfg.savgol_window:
        sig = savitzky_golay(sig, cfg.savgol_window, cfg.savgol_polyorder)
    return sig, mask


# ──────────────────────────────────────────────────────────────────────────
# 3. Bucket the "af" signal using baseline from "be"
# ──────────────────────────────────────────────────────────────────────────
def buckets_for_recording(af_filt: np.ndarray, baseline_mean: float,
                          cfg: SBFConfig) -> pd.DataFrame:
    fs = cfg.sampling_rate_hz
    bucket_n = int(round(cfg.bucket_seconds * fs))
    rows = []
    start = 0
    while start + bucket_n <= len(af_filt):
        seg = af_filt[start:start + bucket_n]
        t0 = start / fs; t1 = t0 + cfg.bucket_seconds
        smean = float(seg.mean()); sstd = float(seg.std(ddof=1))
        change_pct   = 100.0 * (smean - baseline_mean) / baseline_mean
        change_ratio = (smean - baseline_mean) / baseline_mean
        slope, _, rval, pval, _ = sps_stats.linregress(
            np.arange(len(seg)) / fs, (seg - baseline_mean) / baseline_mean)
        rows.append({
            "bucket": f"{t0/60:g}-{t1/60:g}",
            "t_start_s": t0, "t_end_s": t1,
            "n_samples": len(seg),
            "mean_SBF": smean, "std_SBF": sstd,
            "change_pct": change_pct, "change_ratio": change_ratio,
            "slope_per_s": slope, "regression_R2": rval**2, "regression_p": pval,
        })
        start += bucket_n
    df = pd.DataFrame(rows)
    if len(df):
        df["is_outlier_bucket"] = flag_bucket_outliers(df["mean_SBF"].values)
    return df


# ──────────────────────────────────────────────────────────────────────────
# 4. Top-level driver
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class ConditionResult:
    """One (person, frequency) result — the after-buckets normalised by the before-baseline."""
    person: str
    freq_hz: int
    baseline_mean: float
    baseline_std: float
    n_baseline_samples: int
    af_n_samples: int
    af_outliers_removed: int
    af_outlier_pct: float
    bucket_df: pd.DataFrame


def analyse_horizontal(path: str, cfg: SBFConfig, sheet=0,
                       max_buckets: int | None = 10) -> dict:
    """
    Full pipeline. Returns dict with:
        persons   – list of block dicts as parsed
        per_cond  – list[ConditionResult]
        recordings_full – list[Recording] with filtered signals (for plotting)
        group_50  – pd.DataFrame, group stats per bucket at 50 Hz
        group_100 – pd.DataFrame, group stats per bucket at 100 Hz
        comparison – pd.DataFrame, paired 50 vs 100 Hz per bucket (t-test + Wilcoxon)
    """
    persons, ws = parse_horizontal_xlsx(path, sheet=sheet)
    per_cond: list[ConditionResult] = []
    recordings_full: list[Recording] = []

    for block in persons:
        name = block["name"]
        for freq, cols in block["blocks"].items():
            be_raw = _load_column(ws, cols["be"])
            af_raw = _load_column(ws, cols["af"])
            be_filt, be_mask = filter_signal(be_raw, cfg)
            af_filt, af_mask = filter_signal(af_raw, cfg)

            # Baseline from cleaned "be" — full mean
            baseline_mean = float(be_filt.mean()) if len(be_filt) else np.nan
            baseline_std  = float(be_filt.std(ddof=1)) if len(be_filt) > 1 else 0.0

            bucket_df = buckets_for_recording(af_filt, baseline_mean, cfg)
            if max_buckets:
                bucket_df = bucket_df.head(max_buckets).reset_index(drop=True)

            per_cond.append(ConditionResult(
                person=name, freq_hz=freq,
                baseline_mean=baseline_mean, baseline_std=baseline_std,
                n_baseline_samples=len(be_filt), af_n_samples=len(af_filt),
                af_outliers_removed=int(af_mask.sum()),
                af_outlier_pct=100.0 * af_mask.sum() / max(len(af_raw), 1),
                bucket_df=bucket_df,
            ))
            for phase, raw, filt, mask in [
                ("be", be_raw, be_filt, be_mask),
                ("af", af_raw, af_filt, af_mask),
            ]:
                recordings_full.append(Recording(
                    person=name, freq_hz=freq, phase=phase,
                    column_letter=get_column_letter(cols[phase]),
                    signal_raw=raw, signal_filt=filt, outlier_mask=mask,
                ))

    group_50  = _aggregate_group(per_cond, 50,  max_buckets)
    group_100 = _aggregate_group(per_cond, 100, max_buckets)
    comparison = _compare_freqs(per_cond, max_buckets)

    return {
        "persons": persons, "per_cond": per_cond,
        "recordings_full": recordings_full,
        "group_50": group_50, "group_100": group_100,
        "comparison": comparison,
        "config": cfg,
    }


def _aggregate_group(per_cond: list[ConditionResult], freq: int,
                     max_buckets: int | None) -> pd.DataFrame:
    rows_by_freq = [r for r in per_cond if r.freq_hz == freq]
    if not rows_by_freq:
        return pd.DataFrame()
    n_buckets = min(len(r.bucket_df) for r in rows_by_freq)
    if max_buckets: n_buckets = min(n_buckets, max_buckets)

    out = []
    for k in range(n_buckets):
        ref = rows_by_freq[0].bucket_df.iloc[k]
        means    = np.array([r.bucket_df.iloc[k]["mean_SBF"]    for r in rows_by_freq])
        changes  = np.array([r.bucket_df.iloc[k]["change_pct"]  for r in rows_by_freq])
        flagged  = np.array([bool(r.bucket_df.iloc[k]["is_outlier_bucket"]) for r in rows_by_freq])
        keep = ~flagged

        row = {
            "bucket": ref["bucket"],
            "t_start_s": ref["t_start_s"], "t_end_s": ref["t_end_s"],
            "n_people": len(rows_by_freq),
            "n_flagged_excluded": int(flagged.sum()),
            "group_mean_change_pct":          float(np.mean(changes)),
            "group_std_change_pct":           float(np.std(changes, ddof=1)) if len(changes) > 1 else 0.0,
            "group_sem_change_pct":           float(np.std(changes, ddof=1) / np.sqrt(len(changes))) if len(changes) > 1 else 0.0,
            "group_mean_change_pct_clean":    float(np.mean(changes[keep])) if keep.sum() else np.nan,
            "group_std_change_pct_clean":     float(np.std(changes[keep], ddof=1)) if keep.sum() > 1 else 0.0,
            "group_mean_SBF":                 float(np.mean(means)),
            "group_std_SBF_across_people":    float(np.std(means, ddof=1)) if len(means) > 1 else 0.0,
        }
        out.append(row)
    return pd.DataFrame(out)


def _compare_freqs(per_cond: list[ConditionResult], max_buckets: int | None) -> pd.DataFrame:
    """For each bucket, paired test 50 vs 100 Hz per person (matched within-subject)."""
    # Group by person
    by_person: dict[str, dict[int, pd.DataFrame]] = {}
    for r in per_cond:
        by_person.setdefault(r.person, {})[r.freq_hz] = r.bucket_df

    paired_people = [p for p, d in by_person.items() if 50 in d and 100 in d]
    if not paired_people: return pd.DataFrame()

    min_buckets = min(min(len(by_person[p][50]), len(by_person[p][100])) for p in paired_people)
    if max_buckets: min_buckets = min(min_buckets, max_buckets)

    out = []
    for k in range(min_buckets):
        v50  = np.array([by_person[p][50].iloc[k]["change_pct"]  for p in paired_people])
        v100 = np.array([by_person[p][100].iloc[k]["change_pct"] for p in paired_people])
        diff = v100 - v50

        # Tests — use normality test to choose
        if len(diff) >= 3:
            try:
                _, p_normal = sps_stats.shapiro(diff)
            except Exception:
                p_normal = 1.0
            t_stat, t_p = sps_stats.ttest_rel(v100, v50, nan_policy='omit')
            try:
                w_stat, w_p = sps_stats.wilcoxon(v100, v50, zero_method='wilcox',
                                                 alternative='two-sided',
                                                 nan_policy='omit')
            except Exception:
                w_stat, w_p = np.nan, np.nan
        else:
            t_stat = t_p = w_stat = w_p = p_normal = np.nan

        out.append({
            "bucket": by_person[paired_people[0]][50].iloc[k]["bucket"],
            "n_paired": len(paired_people),
            "mean_50hz":  float(v50.mean()),  "sd_50hz":  float(v50.std(ddof=1)),
            "mean_100hz": float(v100.mean()), "sd_100hz": float(v100.std(ddof=1)),
            "mean_diff_100minus50": float(diff.mean()),
            "shapiro_p_on_diff":  float(p_normal),
            "paired_t_p":         float(t_p),
            "wilcoxon_p":         float(w_p),
            "preferred_p": float(t_p) if p_normal > 0.05 else float(w_p),
        })
    return pd.DataFrame(out)
