"""
Core configuration, data containers, and signal processing routines for SBF.
Includes Hampel filter, Savitzky-Golay, Butterworth lowpass, and bucket statistical aggregation.
"""
from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np
import pandas as pd
from scipy.signal import savgol_filter, butter, filtfilt
from scipy import stats as sp_stats


@dataclass
class SBFConfig:
    """Configuration for Skin Blood Flow (SBF) signal conditioning & analysis."""
    sampling_rate_hz: float = 40.0
    bucket_seconds: float = 30.0
    use_hampel: bool = True
    hampel_window: int = 21
    hampel_n_sigmas: float = 3.0
    use_savgol: bool = True
    savgol_window: int = 41
    savgol_polyorder: int = 3
    use_lowpass: bool = False
    lowpass_cutoff_hz: float = 2.0
    lowpass_order: int = 4


@dataclass
class Recording:
    """Individual phase recording container."""
    person: str
    freq_hz: int
    phase: str  # 'be' (baseline/before) or 'af' (after/post-stimulus)
    signal_raw: np.ndarray
    signal_filt: np.ndarray
    outlier_mask: np.ndarray


@dataclass
class ConditionResult:
    """Summary of one subject at one stimulation frequency."""
    person: str
    freq_hz: int
    baseline_mean: float
    baseline_std: float
    n_baseline_samples: int
    af_n_samples: int
    af_outliers_removed: int
    af_outlier_pct: float
    bucket_df: pd.DataFrame


def hampel_filter(signal: np.ndarray, window_size: int = 21,
                  n_sigmas: float = 3.0) -> tuple[np.ndarray, np.ndarray]:
    """
    Hampel filter for robust outlier detection using median absolute deviation (MAD).
    Replaces detected outliers with the local window median.
    """
    sig = np.array(signal, dtype=float, copy=True)
    n = len(sig)
    mask = np.zeros(n, dtype=bool)
    if n == 0:
        return sig, mask

    k = 1.4826  # Scale factor for normal distribution
    half = window_size // 2

    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        window = sig[lo:hi]
        med = float(np.median(window))
        mad = k * float(np.median(np.abs(window - med)))
        if mad < 1e-12:
            mad = 1e-12
        if np.abs(sig[i] - med) > n_sigmas * mad:
            mask[i] = True
            sig[i] = med

    return sig, mask


def _savitzky_golay(signal: np.ndarray, window: int, polyorder: int) -> np.ndarray:
    """Savitzky-Golay polynomial smoothing filter."""
    if len(signal) <= window:
        return signal.copy()
    if window % 2 == 0:
        window += 1
    if polyorder >= window:
        polyorder = window - 1
    return savgol_filter(signal, window_length=window, polyorder=polyorder)


def _butter_lowpass(signal: np.ndarray, fs: float, cutoff: float,
                    order: int) -> np.ndarray:
    """Zero-phase Butterworth lowpass filter."""
    if len(signal) <= 3 * order:
        return signal.copy()
    nyq = 0.5 * fs
    normal_cutoff = min(cutoff / nyq, 0.99)
    b, a = butter(order, normal_cutoff, btype="low")
    return filtfilt(b, a, signal)


def filter_signal(raw: np.ndarray, cfg: SBFConfig) -> tuple[np.ndarray, np.ndarray]:
    """Applies the configured DSP pipeline: Hampel -> Lowpass -> Savitzky-Golay."""
    sig = np.array(raw, dtype=float, copy=True)
    mask = np.zeros(len(sig), dtype=bool)
    if len(sig) == 0:
        return sig, mask

    if cfg.use_hampel:
        sig, mask = hampel_filter(sig, cfg.hampel_window, cfg.hampel_n_sigmas)

    if cfg.use_lowpass and cfg.lowpass_cutoff_hz > 0:
        sig = _butter_lowpass(sig, cfg.sampling_rate_hz,
                              cfg.lowpass_cutoff_hz, cfg.lowpass_order)

    if cfg.use_savgol and len(sig) > cfg.savgol_window:
        sig = _savitzky_golay(sig, cfg.savgol_window, cfg.savgol_polyorder)

    return sig, mask


def flag_bucket_outliers(means: np.ndarray) -> np.ndarray:
    """
    Identifies outlier buckets using median absolute deviation.
    Flags buckets exceeding 3.5 * MAD and >15% relative deviation from median.
    """
    if len(means) == 0:
        return np.zeros(0, dtype=bool)
    med = float(np.median(means))
    mad = 1.4826 * float(np.median(np.abs(means - med)))
    if mad < 1e-12:
        return np.zeros(len(means), dtype=bool)
    stat_flag = np.abs(means - med) > 3.5 * mad
    rel_flag = (np.abs(means - med) / max(abs(med), 1e-12)) > 0.15
    return stat_flag & rel_flag


def buckets_for_recording(af_filt: np.ndarray, baseline_mean: float,
                          cfg: SBFConfig, max_buckets: int | None = None) -> pd.DataFrame:
    """
    Segments the post-stimulus ('af') signal into fixed-duration time buckets (default 30s)
    and computes mean, std, relative change %, and linear regression kinetics.
    """
    fs = cfg.sampling_rate_hz
    bucket_n = int(round(cfg.bucket_seconds * fs))
    rows = []
    start = 0
    bucket_count = 0
    safe_baseline = baseline_mean if abs(baseline_mean) > 1e-6 else 1.0

    while start + bucket_n <= len(af_filt):
        if max_buckets is not None and bucket_count >= max_buckets:
            break
        seg = af_filt[start:start + bucket_n]
        t0 = start / fs
        t1 = t0 + cfg.bucket_seconds
        smean = float(np.mean(seg))
        sstd = float(np.std(seg, ddof=1)) if len(seg) > 1 else 0.0
        change_pct = 100.0 * (smean - safe_baseline) / safe_baseline
        change_ratio = (smean - safe_baseline) / safe_baseline

        t_axis = np.arange(len(seg)) / fs
        if len(seg) >= 3 and not np.all(seg == seg[0]):
            slope, _, rval, pval, _ = sp_stats.linregress(
                t_axis, (seg - safe_baseline) / safe_baseline)
            r2 = float(rval**2)
        else:
            slope, r2, pval = 0.0, 0.0, 1.0

        rows.append({
            "bucket_idx": bucket_count + 1,
            "bucket": f"{t0/60:g}-{t1/60:g} min",
            "t_start_s": t0,
            "t_end_s": t1,
            "n_samples": len(seg),
            "mean_SBF": smean,
            "std_SBF": sstd,
            "change_pct": change_pct,
            "change_ratio": change_ratio,
            "slope_per_s": float(slope),
            "regression_R2": r2,
            "regression_p": float(pval),
        })
        start += bucket_n
        bucket_count += 1

    df = pd.DataFrame(rows)
    if len(df) > 0:
        df["is_outlier_bucket"] = flag_bucket_outliers(df["mean_SBF"].values)
    return df
