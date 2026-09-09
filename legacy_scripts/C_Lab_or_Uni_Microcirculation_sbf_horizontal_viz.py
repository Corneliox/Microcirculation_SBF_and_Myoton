"""Visualization + Excel export for the horizontal-format study."""
from __future__ import annotations
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, LineChart, Reference

from sbf_horizontal import ConditionResult, Recording


PALETTE = ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377",
           "#000000", "#882255", "#117733", "#999933", "#DDCC77", "#332288"]
JOURNAL_RC = {
    "figure.dpi": 110, "savefig.dpi": 250,
    "font.family": "DejaVu Sans", "font.size": 9,
    "axes.titlesize": 10, "axes.labelsize": 9,
    "xtick.labelsize": 8, "ytick.labelsize": 8, "legend.fontsize": 7,
    "axes.linewidth": 0.8, "lines.linewidth": 1.0,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.linestyle": ":", "grid.alpha": 0.4,
}


def plot_group_curves(group_50: pd.DataFrame, group_100: pd.DataFrame,
                      per_cond, output_path: str):
    """Per-person change% curves + group mean ± SD bands, side-by-side 50 vs 100 Hz."""
    plt.rcParams.update(JOURNAL_RC)
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), sharey=True)

    for ax, gdf, freq in [(axes[0], group_50, 50), (axes[1], group_100, 100)]:
        if gdf.empty:
            ax.set_title(f"{freq} Hz — no data"); continue
        x = np.arange(len(gdf))
        # Per-person lines
        records = [r for r in per_cond if r.freq_hz == freq]
        for i, r in enumerate(records):
            bdf = r.bucket_df.head(len(gdf))
            ax.plot(x, bdf["change_pct"], "o-",
                    color=PALETTE[i % len(PALETTE)], lw=0.8, ms=4, alpha=0.6,
                    label=r.person)
            flagged = bdf["is_outlier_bucket"].values
            if flagged.any():
                ax.scatter(x[flagged], bdf["change_pct"][flagged],
                           facecolors="none", edgecolors="#C62828", s=120, lw=1.6, zorder=5)
        # Group band — using SD across people
        ax.fill_between(x,
                        gdf["group_mean_change_pct"] - gdf["group_std_change_pct"],
                        gdf["group_mean_change_pct"] + gdf["group_std_change_pct"],
                        color="#37474F", alpha=0.15, label="Group ± SD")
        ax.plot(x, gdf["group_mean_change_pct"], color="#37474F", lw=2.2,
                marker="s", ms=6, label="Group mean")
        ax.axhline(0, color="black", lw=0.6)
        ax.set_xticks(x); ax.set_xticklabels(gdf["bucket"], rotation=0, fontsize=8)
        ax.set_xlabel("Bucket (min after stimulus)")
        ax.set_title(f"{freq} Hz vibration  (n = {gdf['n_people'].iloc[0]} people)",
                     loc="left")
        if freq == 50:
            ax.set_ylabel("Change % vs baseline (Eq. 1)")
        ax.legend(loc="upper right", ncol=2, fontsize=7)

    fig.suptitle("Recovery response per person — 50 Hz vs 100 Hz", fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(output_path, dpi=250, bbox_inches="tight")
    plt.close(fig)


def plot_group_comparison(group_50: pd.DataFrame, group_100: pd.DataFrame,
                          comparison: pd.DataFrame, output_path: str):
    """Group-level summary: mean ± SD for each freq overlaid, with significance bars."""
    plt.rcParams.update(JOURNAL_RC)
    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(group_50))
    w = 0.36
    ax.bar(x - w/2, group_50["group_mean_change_pct"], w,
           yerr=group_50["group_sem_change_pct"], capsize=4,
           color="#4477AA", edgecolor="black", lw=0.6, label="50 Hz")
    ax.bar(x + w/2, group_100["group_mean_change_pct"], w,
           yerr=group_100["group_sem_change_pct"], capsize=4,
           color="#EE6677", edgecolor="black", lw=0.6, label="100 Hz")
    ax.axhline(0, color="black", lw=0.6)
    ax.set_xticks(x); ax.set_xticklabels(group_50["bucket"], rotation=0)
    ax.set_xlabel("Bucket (min after stimulus)")
    ax.set_ylabel("Group mean change % ± SEM")
    ax.set_title("50 Hz vs 100 Hz  —  group mean (n = {} people)".format(
        int(group_50['n_people'].iloc[0])), loc="left")

    # Significance asterisks
    y_top = max(
        (group_50["group_mean_change_pct"] + group_50["group_sem_change_pct"]).max(),
        (group_100["group_mean_change_pct"] + group_100["group_sem_change_pct"]).max(),
    )
    y_top *= 1.08
    for i, row in comparison.iterrows():
        p = row["preferred_p"]
        sym = "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "ns"
        if sym != "ns":
            ax.text(i, y_top, sym, ha="center", va="bottom", fontsize=11, fontweight="bold")

    ax.legend()
    ax.text(0.99, -0.18, "Significance: *p<.05, **p<.01, ***p<.001 (paired t-test "
            "or Wilcoxon depending on normality)",
            transform=ax.transAxes, ha="right", va="top", fontsize=7, color="#444")
    fig.tight_layout()
    fig.savefig(output_path, dpi=250, bbox_inches="tight")
    plt.close(fig)


def plot_baseline_distribution(per_cond, output_path: str):
    """One panel per frequency: each person's baseline mean ± SD."""
    plt.rcParams.update(JOURNAL_RC)
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
    for ax, freq in zip(axes, [50, 100]):
        rows = [r for r in per_cond if r.freq_hz == freq]
        names = [r.person for r in rows]
        means = np.array([r.baseline_mean for r in rows])
        stds  = np.array([r.baseline_std  for r in rows])
        order = np.argsort(means)
        x = np.arange(len(rows))
        ax.bar(x, means[order], yerr=stds[order], capsize=3,
               color=PALETTE[0] if freq == 50 else PALETTE[1],
               edgecolor="black", lw=0.5)
        ax.set_xticks(x); ax.set_xticklabels([names[i] for i in order],
                                              rotation=35, ha="right", fontsize=8)
        ax.set_ylabel("Baseline mean SBF (± SD)")
        ax.set_title(f"{freq} Hz — per-person baseline (from filtered 'be' column)",
                     loc="left")
    fig.suptitle("Baseline SBF distributions", fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(output_path, dpi=250, bbox_inches="tight")
    plt.close(fig)


def plot_signals_grid(recordings, output_path: str, freq: int, phase: str):
    """A grid of all 12 people's signals for one (freq, phase) condition — raw vs filtered."""
    plt.rcParams.update(JOURNAL_RC)
    sel = [r for r in recordings if r.freq_hz == freq and r.phase == phase]
    n = len(sel)
    ncols = 3; nrows = (n + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(13, 2.5 * nrows), sharex=False)
    axes = np.array(axes).reshape(-1)
    for i, r in enumerate(sel):
        ax = axes[i]
        t = np.arange(len(r.signal_raw)) / 40.0   # assumed 40 Hz for the plot x-axis
        ax.plot(t, r.signal_raw,  color="#B0BEC5", lw=0.4, alpha=0.85)
        ax.plot(t, r.signal_filt, color=PALETTE[i % len(PALETTE)], lw=0.9)
        idx = np.where(r.outlier_mask)[0]
        if len(idx):
            ax.scatter(t[idx], r.signal_raw[idx], color="#C62828", s=3, alpha=0.6)
        n_art = int(r.outlier_mask.sum())
        ax.set_title(f"{r.person} — col {r.column_letter}  ({n_art} outliers)",
                     loc="left", fontsize=8)
        ax.tick_params(axis='both', labelsize=7)
    for j in range(len(sel), len(axes)):
        axes[j].axis("off")
    fig.suptitle(f"{freq} Hz — '{phase}' phase — raw (grey) vs filtered (color)",
                 fontsize=12)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(output_path, dpi=250, bbox_inches="tight")
    plt.close(fig)


# ──────────────────────────────────────────────────────────────────────────
# Excel export
# ──────────────────────────────────────────────────────────────────────────
def export_horizontal_excel(result: dict, output_path: str):
    cfg = result["config"]
    per_cond = result["per_cond"]
    g50 = result["group_50"]; g100 = result["group_100"]
    comp = result["comparison"]

    wb = Workbook()
    head_fill = PatternFill("solid", start_color="1565C0")
    head_font = Font(bold=True, color="FFFFFF", size=11)
    title_font = Font(bold=True, size=14, color="0D47A1")
    label_font = Font(bold=True)
    flag_fill = PatternFill("solid", start_color="FFEBEE")
    sig_fill  = PatternFill("solid", start_color="E8F5E9")
    thin = Side("thin", color="BBBBBB"); box = Border(thin, thin, thin, thin)

    def style_header_row(ws, row, n_cols):
        for c in range(1, n_cols + 1):
            cell = ws.cell(row, c)
            cell.fill = head_fill; cell.font = head_font
            cell.alignment = Alignment(horizontal="center", wrap_text=True)
        ws.row_dimensions[row].height = 30

    # ── Sheet 1: Summary ──
    ws = wb.active; ws.title = "Summary"
    ws["A1"] = "Microcirculation SBF analysis — 50 Hz vs 100 Hz vibration"
    ws["A1"].font = title_font; ws.merge_cells("A1:E1")

    n_people = len(set(r.person for r in per_cond))
    summary = [
        ("Parameter", "Value"),
        ("Sampling rate (Hz)", cfg.sampling_rate_hz),
        ("Bucket length (s)", cfg.bucket_seconds),
        ("Number of people analysed", n_people),
        ("Number of conditions (per person, freq)", len(per_cond)),
        ("Frequencies tested", "50 Hz, 100 Hz"),
        ("", ""),
        ("Filter — Hampel window (samples each side)", cfg.hampel_window),
        ("Filter — Hampel threshold (n × MAD)", cfg.hampel_n_sigmas),
        ("Filter — Savitzky-Golay window", cfg.savgol_window),
        ("Filter — Savitzky-Golay polyorder", cfg.savgol_polyorder),
        ("Baseline source", "Mean of filtered 'be' column per person × freq"),
        ("Buckets per group", len(g50)),
    ]
    for i, (k, v) in enumerate(summary, start=3):
        ws.cell(i, 1, k).font = label_font if i > 3 else head_font
        ws.cell(i, 2, v)
        if i == 3:
            ws.cell(i, 1).fill = head_fill; ws.cell(i, 2).fill = head_fill
            ws.cell(i, 1).font = head_font; ws.cell(i, 2).font = head_font
    ws.column_dimensions["A"].width = 48
    ws.column_dimensions["B"].width = 26

    # ── Sheet 2: Per-person baselines ──
    ws2 = wb.create_sheet("Baselines")
    headers = ["Person", "Freq Hz", "Baseline mean (filtered)", "Baseline SD (filtered)",
               "n_baseline_samples", "af samples", "af outliers removed", "af outliers %"]
    for c, h in enumerate(headers, start=1):
        ws2.cell(1, c, h)
    style_header_row(ws2, 1, len(headers))
    for r_i, r in enumerate(per_cond, start=2):
        ws2.cell(r_i, 1, r.person); ws2.cell(r_i, 1).font = label_font
        ws2.cell(r_i, 2, r.freq_hz)
        ws2.cell(r_i, 3, round(r.baseline_mean, 4))
        ws2.cell(r_i, 4, round(r.baseline_std, 4))
        ws2.cell(r_i, 5, r.n_baseline_samples)
        ws2.cell(r_i, 6, r.af_n_samples)
        ws2.cell(r_i, 7, r.af_outliers_removed)
        ws2.cell(r_i, 8, round(r.af_outlier_pct, 3))
        for c in range(1, len(headers)+1):
            ws2.cell(r_i, c).border = box
    for col, w in zip("ABCDEFGH", [16, 9, 22, 22, 18, 12, 20, 14]):
        ws2.column_dimensions[col].width = w

    # ── Sheet 3 & 4: Per-person bucket change% at 50 / 100 Hz ──
    def write_change_table(sheet_name, freq):
        wsX = wb.create_sheet(sheet_name)
        rows_by_freq = [r for r in per_cond if r.freq_hz == freq]
        n_buckets = min(len(r.bucket_df) for r in rows_by_freq) if rows_by_freq else 0
        bucket_labels = rows_by_freq[0].bucket_df["bucket"].tolist()[:n_buckets] if rows_by_freq else []

        wsX.cell(1, 1, "Person").font = head_font
        wsX.cell(1, 1).fill = head_fill
        for j, b in enumerate(bucket_labels):
            wsX.cell(1, 2 + j, b)
        style_header_row(wsX, 1, 1 + len(bucket_labels))
        for r_i, r in enumerate(rows_by_freq, start=2):
            wsX.cell(r_i, 1, r.person); wsX.cell(r_i, 1).font = label_font
            for j in range(n_buckets):
                val = r.bucket_df.iloc[j]["change_pct"]
                wsX.cell(r_i, 2 + j, round(float(val), 3))
                if bool(r.bucket_df.iloc[j]["is_outlier_bucket"]):
                    wsX.cell(r_i, 2 + j).fill = flag_fill
                wsX.cell(r_i, 2 + j).border = box
            wsX.cell(r_i, 1).border = box

        # Group mean & SD rows
        gdf = result["group_50"] if freq == 50 else result["group_100"]
        bottom = len(rows_by_freq) + 3
        wsX.cell(bottom, 1, "GROUP MEAN").font = label_font
        wsX.cell(bottom + 1, 1, "GROUP SD").font = label_font
        wsX.cell(bottom + 2, 1, "GROUP SEM").font = label_font
        wsX.cell(bottom + 3, 1, "GROUP MEAN (flagged excl.)").font = label_font
        for j in range(min(n_buckets, len(gdf))):
            wsX.cell(bottom,     2 + j, round(gdf.iloc[j]["group_mean_change_pct"], 3))
            wsX.cell(bottom + 1, 2 + j, round(gdf.iloc[j]["group_std_change_pct"], 3))
            wsX.cell(bottom + 2, 2 + j, round(gdf.iloc[j]["group_sem_change_pct"], 3))
            if not np.isnan(gdf.iloc[j]["group_mean_change_pct_clean"]):
                wsX.cell(bottom + 3, 2 + j,
                         round(gdf.iloc[j]["group_mean_change_pct_clean"], 3))

        wsX.column_dimensions["A"].width = 18
        for j in range(2, 2 + len(bucket_labels)):
            wsX.column_dimensions[chr(ord('A') + j - 1) if j <= 26 else 'AA'].width = 12

    write_change_table("Change% — 50 Hz", 50)
    write_change_table("Change% — 100 Hz", 100)

    # ── Sheet 5: Group stats merged ──
    ws5 = wb.create_sheet("Group Stats")
    hdrs = ["Bucket", "n_people",
            "50 Hz: mean Δ%", "50 Hz: SD Δ%", "50 Hz: SEM Δ%", "50 Hz: n flagged",
            "100 Hz: mean Δ%", "100 Hz: SD Δ%", "100 Hz: SEM Δ%", "100 Hz: n flagged"]
    for c, h in enumerate(hdrs, start=1):
        ws5.cell(1, c, h)
    style_header_row(ws5, 1, len(hdrs))
    for r_i in range(len(g50)):
        ws5.cell(r_i + 2, 1, g50.iloc[r_i]["bucket"]).font = label_font
        ws5.cell(r_i + 2, 2, g50.iloc[r_i]["n_people"])
        ws5.cell(r_i + 2, 3, round(g50.iloc[r_i]["group_mean_change_pct"], 3))
        ws5.cell(r_i + 2, 4, round(g50.iloc[r_i]["group_std_change_pct"], 3))
        ws5.cell(r_i + 2, 5, round(g50.iloc[r_i]["group_sem_change_pct"], 3))
        ws5.cell(r_i + 2, 6, int(g50.iloc[r_i]["n_flagged_excluded"]))
        if r_i < len(g100):
            ws5.cell(r_i + 2, 7, round(g100.iloc[r_i]["group_mean_change_pct"], 3))
            ws5.cell(r_i + 2, 8, round(g100.iloc[r_i]["group_std_change_pct"], 3))
            ws5.cell(r_i + 2, 9, round(g100.iloc[r_i]["group_sem_change_pct"], 3))
            ws5.cell(r_i + 2, 10, int(g100.iloc[r_i]["n_flagged_excluded"]))
        for c in range(1, len(hdrs)+1):
            ws5.cell(r_i + 2, c).border = box
    for col, w in zip("ABCDEFGHIJ", [10, 10, 14, 14, 14, 14, 14, 14, 14, 14]):
        ws5.column_dimensions[col].width = w

    # ── Sheets 6 & 7: Per-person bucket tables in classic format ──
    # Format matches the reference image:
    #   [bucket label] [mean change_ratio] [標準差 STDEV] [std of ratios]
    # One sheet per frequency, all 12 people side-by-side.
    def write_classic_tables(sheet_name, freq):
        wsT = wb.create_sheet(sheet_name)
        rows_by_freq = [r for r in per_cond if r.freq_hz == freq]
        if not rows_by_freq: return
        n_buckets = min(len(r.bucket_df) for r in rows_by_freq)
        bucket_labels = rows_by_freq[0].bucket_df["bucket"].tolist()[:n_buckets]

        # Each person occupies 4 cols + 1 spacer = 5 cols block
        BLOCK = 5
        title_fill = PatternFill("solid", start_color="FFE0B2")  # light orange
        bucket_fill = PatternFill("solid", start_color="FFF8E1")  # very light yellow
        std_fill = PatternFill("solid", start_color="FFCCBC")     # light salmon for std label

        for p_i, r in enumerate(rows_by_freq):
            c0 = 1 + p_i * BLOCK  # starting column for this person's block

            # Title row (row 1): "<name> — <freq> Hz af"
            title = f"{r.person} — {freq} Hz af"
            wsT.cell(1, c0, title).font = Font(bold=True, size=11, color="0D47A1")
            wsT.cell(1, c0).fill = title_fill
            wsT.cell(1, c0).alignment = Alignment(horizontal="center")
            wsT.merge_cells(start_row=1, start_column=c0,
                            end_row=1,   end_column=c0 + 3)

            # Sub-header (row 2): bucket | 平均 mean | 標準差 STDEV | std
            wsT.cell(2, c0,     "Bucket").font = head_font
            wsT.cell(2, c0+1,   "平均 mean").font = head_font
            wsT.cell(2, c0+2,   "標準差 STDEV").font = head_font
            wsT.cell(2, c0+3,   "std").font = head_font
            for cc in range(c0, c0+4):
                wsT.cell(2, cc).fill = head_fill
                wsT.cell(2, cc).alignment = Alignment(horizontal="center", wrap_text=True)

            # Data rows
            for j in range(n_buckets):
                b = r.bucket_df.iloc[j]
                mean_ratio = float(b["change_ratio"])
                std_ratio  = float(b["std_SBF"]) / r.baseline_mean \
                             if r.baseline_mean else float("nan")
                row_r = 3 + j
                wsT.cell(row_r, c0,     b["bucket"])
                wsT.cell(row_r, c0).fill = bucket_fill
                wsT.cell(row_r, c0).font = label_font
                wsT.cell(row_r, c0+1, round(mean_ratio, 6))
                wsT.cell(row_r, c0+2, "標準差 STDEV")
                wsT.cell(row_r, c0+2).fill = std_fill
                wsT.cell(row_r, c0+2).alignment = Alignment(horizontal="center")
                wsT.cell(row_r, c0+3, round(std_ratio, 6))
                # Apply borders
                for cc in range(c0, c0+4):
                    wsT.cell(row_r, cc).border = box
                # Flag highlight
                if bool(b["is_outlier_bucket"]):
                    for cc in range(c0, c0+4):
                        wsT.cell(row_r, cc).fill = flag_fill

            # Baseline footer 2 rows below the table
            foot_r = 3 + n_buckets + 1
            wsT.cell(foot_r,     c0, "Baseline mean").font = label_font
            wsT.cell(foot_r,     c0+1, round(r.baseline_mean, 4))
            wsT.cell(foot_r + 1, c0, "Baseline SD").font = label_font
            wsT.cell(foot_r + 1, c0+1, round(r.baseline_std, 4))
            wsT.cell(foot_r + 2, c0, "af outliers").font = label_font
            wsT.cell(foot_r + 2, c0+1, f"{r.af_outliers_removed} "
                     f"({r.af_outlier_pct:.1f}%)")

        # Column widths
        from openpyxl.utils import get_column_letter as _gcl
        for p_i in range(len(rows_by_freq)):
            c0 = 1 + p_i * BLOCK
            wsT.column_dimensions[_gcl(c0)].width   = 9
            wsT.column_dimensions[_gcl(c0+1)].width = 11
            wsT.column_dimensions[_gcl(c0+2)].width = 14
            wsT.column_dimensions[_gcl(c0+3)].width = 11
            wsT.column_dimensions[_gcl(c0+4)].width = 2

    write_classic_tables("Tables 50Hz (per person)",  50)
    write_classic_tables("Tables 100Hz (per person)", 100)

    # ── Sheet 6: 50 vs 100 comparison ──
    ws6 = wb.create_sheet("50 vs 100 Hz")
    hdrs = ["Bucket", "n_paired", "Mean 50 Hz", "SD 50 Hz",
            "Mean 100 Hz", "SD 100 Hz", "Diff (100−50)",
            "Shapiro p (on diff)", "Paired t-test p", "Wilcoxon p",
            "Preferred p", "Significance"]
    for c, h in enumerate(hdrs, start=1):
        ws6.cell(1, c, h)
    style_header_row(ws6, 1, len(hdrs))
    for r_i, row in enumerate(comp.itertuples(index=False), start=2):
        ws6.cell(r_i, 1, row.bucket).font = label_font
        ws6.cell(r_i, 2, row.n_paired)
        ws6.cell(r_i, 3, round(row.mean_50hz, 3))
        ws6.cell(r_i, 4, round(row.sd_50hz, 3))
        ws6.cell(r_i, 5, round(row.mean_100hz, 3))
        ws6.cell(r_i, 6, round(row.sd_100hz, 3))
        ws6.cell(r_i, 7, round(row.mean_diff_100minus50, 3))
        ws6.cell(r_i, 8, f"{row.shapiro_p_on_diff:.4f}")
        ws6.cell(r_i, 9, f"{row.paired_t_p:.4f}")
        ws6.cell(r_i, 10, f"{row.wilcoxon_p:.4f}")
        ws6.cell(r_i, 11, f"{row.preferred_p:.4f}")
        p = row.preferred_p
        sym = "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "ns"
        ws6.cell(r_i, 12, sym)
        if sym != "ns":
            for c in range(1, len(hdrs)+1):
                ws6.cell(r_i, c).fill = sig_fill
        for c in range(1, len(hdrs)+1):
            ws6.cell(r_i, c).border = box
    for col, w in zip("ABCDEFGHIJKL", [10, 10, 12, 11, 13, 12, 14, 18, 16, 13, 13, 12]):
        ws6.column_dimensions[col].width = w

    # ── Methodology sheet ──
    ws_m = wb.create_sheet("Methodology")
    notes = [
        "Microcirculation SBF analysis — 50 Hz vs 100 Hz vibration",
        "",
        "Input format:",
        "  Each person occupies 7 columns: [name] [50hz] [be] [af] [100hz] [be] [af].",
        "  'be' = baseline before vibration; 'af' = recovery after vibration.",
        "",
        "Per-recording processing (applied to BOTH 'be' and 'af' columns):",
        f"  1. Hampel filter (±{cfg.hampel_window} samples, threshold = "
            f"{cfg.hampel_n_sigmas} × MAD) — removes movement-artifact spikes.",
        f"  2. Savitzky-Golay smoother (window={cfg.savgol_window}, "
            f"order={cfg.savgol_polyorder}) — preserves slow physiological waves.",
        "",
        "Baseline (per person × frequency):",
        "  baseline_mean = mean of the FILTERED 'be' column.",
        "  (Filtering 'be' is essential — if you don't clean it, movement artifacts ",
        "   during the baseline period inflate it and bias every change% downward.)",
        "",
        "Bucket statistics (per person × frequency, 30-second windows of 'af'):",
        "  change_% = (mean_bucket − baseline_mean) / baseline_mean × 100",
        "",
        "Bucket-level outlier flagging (a second defense):",
        "  A bucket is flagged if its mean differs from neighbouring buckets by",
        "  both > 3.5 × MAD (statistical test) and > 15% (relative test).",
        "  Flagged buckets are kept in the per-person tables (light red shading)",
        "  but excluded from the 'clean' group statistics.",
        "",
        "Group aggregation (per frequency, across people):",
        "  group_mean = mean across people of per-person bucket change%",
        "  group_SD   = SD across people  (= between-subject variability)",
        "  group_SEM  = SD / sqrt(n)",
        "",
        "Paired 50 vs 100 Hz comparison (per bucket):",
        "  For each person and bucket, compute diff = change%_100hz − change%_50hz.",
        "  Shapiro-Wilk test on diff to check normality.",
        "  If normal (p ≥ .05) → paired t-test; else → Wilcoxon signed-rank.",
        "  Significance: * p < .05, ** p < .01, *** p < .001 (uncorrected).",
        "",
        "Note: with 12 people and 10 buckets, you should consider applying a multiple-",
        "comparison correction (Bonferroni × 10 or Benjamini-Hochberg FDR) before",
        "reporting significance in a paper. The raw p-values are provided so you can",
        "do this yourself depending on what the journal accepts.",
    ]
    for i, line in enumerate(notes, start=1):
        ws_m.cell(i, 1, line)
        if i == 1: ws_m.cell(i, 1).font = title_font
    ws_m.column_dimensions["A"].width = 110

    wb.save(output_path)
