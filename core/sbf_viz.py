"""
Publication-ready visualization routines for SBF and Multimodal Plantar Grid.
All functions return matplotlib.figure.Figure instances suitable for both
embedding into GUI canvas (FigureCanvasTkAgg) and direct file export.
"""
from __future__ import annotations
from typing import Optional
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import matplotlib.patches as patches

# Clean biomedical publication palette
COLOR_50 = "#1F77B4"    # Deep Blue
COLOR_100 = "#D62728"   # Brick Red
COLOR_DIFF = "#2CA02C"  # Muted Green
GRID_COLOR = "#E0E0E0"


def plot_group_curves_fig(group_50: pd.DataFrame, group_100: pd.DataFrame,
                          title: str = "Microcirculation Response: 50 Hz vs 100 Hz",
                          figsize: tuple[float, float] = (8.0, 4.5)) -> Figure:
    """
    Renders group mean change % curves across time buckets with ± SEM error bands.
    """
    fig = Figure(figsize=figsize, dpi=100)
    ax = fig.add_subplot(111)

    has_50 = len(group_50) > 0 and "group_mean_change_pct" in group_50
    has_100 = len(group_100) > 0 and "group_mean_change_pct" in group_100

    if not (has_50 or has_100):
        ax.text(0.5, 0.5, "No group data available", ha="center", va="center")
        return fig

    ref_df = group_50 if has_50 else group_100
    x_indices = np.arange(len(ref_df))
    x_labels = ref_df["bucket"].tolist()

    # Baseline reference line
    ax.axhline(0, color="gray", linestyle="--", linewidth=1.0, alpha=0.7, label="Baseline (0%)")

    if has_50:
        y50 = group_50["group_mean_change_pct"].values
        sem50 = group_50["group_sem_change_pct"].values if "group_sem_change_pct" in group_50 else np.zeros_like(y50)
        ax.plot(x_indices, y50, marker="o", color=COLOR_50, linewidth=2.0, label="50 Hz Group Mean")
        ax.fill_between(x_indices, y50 - sem50, y50 + sem50, color=COLOR_50, alpha=0.2)

    if has_100:
        y100 = group_100["group_mean_change_pct"].values
        sem100 = group_100["group_sem_change_pct"].values if "group_sem_change_pct" in group_100 else np.zeros_like(y100)
        ax.plot(x_indices, y100, marker="s", color=COLOR_100, linewidth=2.0, label="100 Hz Group Mean")
        ax.fill_between(x_indices, y100 - sem100, y100 + sem100, color=COLOR_100, alpha=0.2)

    ax.set_xticks(x_indices)
    ax.set_xticklabels(x_labels, rotation=35, ha="right", fontsize=9)
    ax.set_xlabel("Time Bucket (Post-Stimulation)", fontsize=10, fontweight="medium")
    ax.set_ylabel("Mean Change from Baseline (%)", fontsize=10, fontweight="medium")
    ax.set_title(title, fontsize=12, fontweight="bold", pad=12)
    ax.legend(frameon=True, facecolor="white", framealpha=0.9, loc="best")
    ax.grid(True, linestyle=":", alpha=0.6, color=GRID_COLOR)
    fig.tight_layout()
    return fig


def plot_group_comparison_fig(comp_df: pd.DataFrame,
                             title: str = "Paired Difference (100 Hz - 50 Hz)",
                             figsize: tuple[float, float] = (8.0, 4.0)) -> Figure:
    """
    Renders bar chart of paired difference between 100 Hz and 50 Hz with significance markers.
    """
    fig = Figure(figsize=figsize, dpi=100)
    ax = fig.add_subplot(111)

    if len(comp_df) == 0 or "mean_diff_100minus50" not in comp_df:
        ax.text(0.5, 0.5, "No paired comparison data available", ha="center", va="center")
        return fig

    x_indices = np.arange(len(comp_df))
    diffs = comp_df["mean_diff_100minus50"].values
    p_vals = comp_df["preferred_p"].values if "preferred_p" in comp_df else np.ones_like(diffs)

    colors = [COLOR_100 if d >= 0 else COLOR_50 for d in diffs]
    bars = ax.bar(x_indices, diffs, color=colors, alpha=0.85, width=0.55, edgecolor="black", linewidth=0.5)
    ax.axhline(0, color="black", linewidth=1.0)

    # Annotate significance
    for i, (b, p) in enumerate(zip(bars, p_vals)):
        h = b.get_height()
        star = ""
        if not np.isnan(p):
            if p < 0.001:
                star = "***"
            elif p < 0.01:
                star = "**"
            elif p < 0.05:
                star = "*"
        if star:
            offset = 1.0 if h >= 0 else -2.5
            ax.text(b.get_x() + b.get_width() / 2.0, h + offset, star,
                    ha="center", va="bottom" if h >= 0 else "top",
                    fontweight="bold", color="darkred", fontsize=11)

    ax.set_xticks(x_indices)
    ax.set_xticklabels(comp_df["bucket"].tolist(), rotation=35, ha="right", fontsize=9)
    ax.set_xlabel("Time Bucket", fontsize=10)
    ax.set_ylabel("Δ Change % (100 Hz − 50 Hz)", fontsize=10)
    ax.set_title(title, fontsize=12, fontweight="bold", pad=12)
    ax.grid(True, linestyle=":", alpha=0.5, axis="y")
    fig.tight_layout()
    return fig


def plot_foot_grid_heatmap_fig(multimodal_res: dict,
                               figsize: tuple[float, float] = (8.5, 4.2)) -> Figure:
    """
    Renders two 3x3 matrices representing ΔFlux and ΔStiffness across the 9 plantar sites.
    Layout: [1 2 3 / 4 5 6 / 7 8 9]
    """
    fig = Figure(figsize=figsize, dpi=100)
    ax1 = fig.add_subplot(121)
    ax2 = fig.add_subplot(122)

    rec = multimodal_res.get("grid_dict", {})
    if not rec:
        ax1.text(0.5, 0.5, "No grid data", ha="center", va="center")
        return fig

    # Convert to 3x3
    grid_flux = np.zeros((3, 3))
    grid_stiff = np.zeros((3, 3))

    for r in range(3):
        for c in range(3):
            cell = r * 3 + c + 1
            info = rec.get(cell, {})
            grid_flux[r, c] = info.get("flux_delta", np.nan)
            grid_stiff[r, c] = info.get("stiff_delta", np.nan)

    # Flux Heatmap
    im1 = ax1.imshow(grid_flux, cmap="coolwarm", aspect="equal")
    ax1.set_title("Δ Microcirculation Flux (PU)", fontsize=11, fontweight="bold")
    fig.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)

    # Stiffness Heatmap
    im2 = ax2.imshow(grid_stiff, cmap="RdYlBu_r", aspect="equal")
    ax2.set_title("Δ Tissue Stiffness (N/m)", fontsize=11, fontweight="bold")
    fig.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)

    # Add numeric cell labels
    for r in range(3):
        for c in range(3):
            cell = r * 3 + c + 1
            v1 = grid_flux[r, c]
            v2 = grid_stiff[r, c]
            txt1 = f"C{cell}\n{v1:+.1f}" if not np.isnan(v1) else f"C{cell}\nNaN"
            txt2 = f"C{cell}\n{v2:+.0f}" if not np.isnan(v2) else f"C{cell}\nNaN"
            ax1.text(c, r, txt1, ha="center", va="center", color="black", fontsize=9, fontweight="bold")
            ax2.text(c, r, txt2, ha="center", va="center", color="black", fontsize=9, fontweight="bold")

    for ax in (ax1, ax2):
        ax.set_xticks(range(3))
        ax.set_yticks(range(3))
        ax.set_xticklabels(["Col 1", "Col 2", "Col 3"], fontsize=8)
        ax.set_yticklabels(["Row 1", "Row 2", "Row 3"], fontsize=8)

    subj = multimodal_res.get("subject", "Subject")
    rho = multimodal_res.get("correlations", {}).get("delta_spearman", np.nan)
    fig.suptitle(f"Plantar Multimodal Grid — {subj.upper()} (Concordance ρ = {rho:+.2f})",
                 fontsize=12, fontweight="bold", y=0.98)
    fig.tight_layout(rect=[0, 0, 1, 0.95])
    return fig


def plot_multimodal_trace_qc_fig(flux_raw: np.ndarray, cum_times: list[float],
                                 seg_results: list[dict], fs: float = 40.0,
                                 title: str = "Laser-Doppler Flux QC Trace",
                                 figsize: tuple[float, float] = (8.5, 3.8)) -> Figure:
    """
    Renders continuous raw flux trace with coordinate window boundaries and dwell levels.
    """
    fig = Figure(figsize=figsize, dpi=100)
    ax = fig.add_subplot(111)

    t = np.arange(len(flux_raw)) / fs
    ax.plot(t, flux_raw, color="#4A90E2", linewidth=1.0, alpha=0.8, label="Raw Flux (40 Hz)")

    prev = 0.0
    for i, cum in enumerate(cum_times):
        ax.axvline(cum, color="red", linestyle="--", linewidth=1.0, alpha=0.7)
        if i < len(seg_results):
            f_est = seg_results[i].get("flux", np.nan)
            if not np.isnan(f_est):
                ax.hlines(f_est, prev, cum, color="darkgreen", linewidth=2.5,
                          label="Dwell Estimator" if i == 0 else "")
            cell = seg_results[i].get("m", i + 1)
            ax.text((prev + cum) / 2.0, np.nanmax(flux_raw) * 0.9, f"W{cell}",
                    ha="center", va="top", fontsize=8, color="darkred", fontweight="bold")
        prev = cum

    ax.set_xlabel("Time (seconds)", fontsize=10)
    ax.set_ylabel("Laser-Doppler Flux (PU)", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.legend(loc="upper right", framealpha=0.8)
    ax.grid(True, linestyle=":", alpha=0.5)
    fig.tight_layout()
    return fig
