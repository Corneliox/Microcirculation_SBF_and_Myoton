"""
TXT batch parser and aggregator for microcirculation raw signal files.
Discovers and matches files named like:
    0701 PersonName 50Hz A.txt (Phase A = baseline)
    0701 PersonName 50Hz B.txt (Phase B = after)
"""
from __future__ import annotations
import os, glob, re
from pathlib import Path
from typing import Optional, Union
import numpy as np
import pandas as pd

from .sbf_core import (
    SBFConfig, Recording, ConditionResult,
    filter_signal, buckets_for_recording
)
from .sbf_horizontal import aggregate_group, compare_frequencies

FILE_RE = re.compile(
    r"^(\d{4})?\s*([A-Za-z0-9_-]+)\s+(\d+)\s*Hz\b.*([AB])\.txt$", re.IGNORECASE
)


def load_channel1(filepath: Union[str, Path]) -> Optional[np.ndarray]:
    """Reads a microcirculation .txt file, skips header row, returns channel 1 as float array."""
    vals = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                if i == 0 and any(c.isalpha() for c in line):
                    continue  # skip header
                toks = line.replace(",", " ").split()
                if not toks:
                    continue
                try:
                    vals.append(float(toks[0]))
                except ValueError:
                    continue
    except Exception:
        return None

    if len(vals) < 10:
        return None
    return np.array(vals, dtype=float)


def discover_txt_files(directory: Union[str, Path]) -> dict[str, dict[int, dict[str, str]]]:
    """
    Scans directory for .txt files matching subject pattern.
    Returns: {person: {freq_hz: {'A': path, 'B': path}}}
    """
    result: dict[str, dict[int, dict[str, str]]] = {}
    for path in glob.glob(os.path.join(str(directory), "*.txt")):
        base = os.path.basename(path)
        m = FILE_RE.match(base)
        if not m:
            continue
        _date, person, freq_str, phase = m.groups()
        freq = int(freq_str)
        phase = phase.upper()
        result.setdefault(person, {}).setdefault(freq, {})[phase] = path
    return result


def analyse_txt_directory(directory: Union[str, Path], cfg: SBFConfig,
                          max_buckets: int = 10) -> dict:
    """
    Executes complete analysis across discovered .txt files in a directory.
    """
    file_map = discover_txt_files(directory)
    per_cond: list[ConditionResult] = []
    recordings_full: list[Recording] = []

    for person, freqs in sorted(file_map.items()):
        for freq, phases in sorted(freqs.items()):
            path_a = phases.get("A")
            path_b = phases.get("B")
            if not path_a or not path_b:
                continue

            sig_a = load_channel1(path_a)
            sig_b = load_channel1(path_b)
            if sig_a is None or sig_b is None:
                continue

            filt_a, mask_a = filter_signal(sig_a, cfg)
            filt_b, mask_b = filter_signal(sig_b, cfg)

            recordings_full.append(Recording(person=person, freq_hz=freq, phase="be",
                                             signal_raw=sig_a, signal_filt=filt_a,
                                             outlier_mask=mask_a))
            recordings_full.append(Recording(person=person, freq_hz=freq, phase="af",
                                             signal_raw=sig_b, signal_filt=filt_b,
                                             outlier_mask=mask_b))

            b_mean = float(np.mean(filt_a)) if len(filt_a) > 0 else 0.0
            b_std = float(np.std(filt_a, ddof=1)) if len(filt_a) > 1 else 0.0
            b_df = buckets_for_recording(filt_b, b_mean, cfg, max_buckets=max_buckets)

            cond = ConditionResult(
                person=person, freq_hz=freq,
                baseline_mean=b_mean, baseline_std=b_std,
                n_baseline_samples=len(filt_a),
                af_n_samples=len(filt_b),
                af_outliers_removed=int(mask_b.sum()),
                af_outlier_pct=100.0 * float(mask_b.sum()) / max(len(mask_b), 1),
                bucket_df=b_df,
            )
            per_cond.append(cond)

    group_50 = aggregate_group(per_cond, 50, max_buckets)
    group_100 = aggregate_group(per_cond, 100, max_buckets)
    comparison = compare_frequencies(per_cond, max_buckets)

    return {
        "persons": sorted(file_map.keys()),
        "per_cond": per_cond,
        "recordings": recordings_full,
        "group_50": group_50,
        "group_100": group_100,
        "comparison": comparison,
        "config": cfg,
    }
