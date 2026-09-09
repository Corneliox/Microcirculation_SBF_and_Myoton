"""
Driver: full analysis of a horizontal-format xlsx file.

USAGE:
    python3 run_horizontal.py
        --input  Microcirculation_raw_data.xlsx
        --fs     40
        --max-buckets 10
        --out-prefix /path/to/output/study

Auto-detects person blocks, filters every column, computes per-person
baselines from 'be' columns, bucketises 'af' columns, runs group stats
and 50 vs 100 Hz paired comparison, writes Excel + PNG outputs.
"""
from __future__ import annotations
import argparse, os
import numpy as np

from sbf_analysis import SBFConfig
from sbf_horizontal import analyse_horizontal
from sbf_horizontal_viz import (export_horizontal_excel,
                                plot_group_curves, plot_group_comparison,
                                plot_baseline_distribution, plot_signals_grid)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--sheet", default=0)
    p.add_argument("--fs", type=float, default=40.0)
    p.add_argument("--bucket-seconds", type=float, default=30.0)
    p.add_argument("--max-buckets", type=int, default=10,
                   help="Truncate bucket analysis to this many. Default 10 = 5 min.")
    p.add_argument("--hampel-window", type=int, default=21)
    p.add_argument("--hampel-sigmas", type=float, default=3.0)
    p.add_argument("--savgol-window", type=int, default=41)
    p.add_argument("--no-hampel", action="store_true")
    p.add_argument("--no-savgol", action="store_true")
    p.add_argument("--out-prefix", default="/home/claude/output_horiz/study")
    p.add_argument("--plot-signals", action="store_true",
                   help="Also dump signal grids per (freq, phase). Slower.")
    args = p.parse_args()

    cfg = SBFConfig(
        sampling_rate_hz=args.fs, bucket_seconds=args.bucket_seconds,
        use_hampel=not args.no_hampel, use_savgol=not args.no_savgol,
        hampel_window=args.hampel_window, hampel_n_sigmas=args.hampel_sigmas,
        savgol_window=args.savgol_window,
    )

    try:
        sheet_arg = int(args.sheet)
    except (ValueError, TypeError):
        sheet_arg = args.sheet

    print(f"Loading and analysing {args.input} ...")
    result = analyse_horizontal(args.input, cfg, sheet=sheet_arg,
                                max_buckets=args.max_buckets)

    per_cond = result["per_cond"]
    print(f"\nParsed {len(result['persons'])} people, {len(per_cond)} (person × frequency) conditions.")
    print(f"\nPer-person baselines:")
    print(f"  {'Person':<14} {'be 50Hz':>10} {'± SD':>8} {'be 100Hz':>10} {'± SD':>8} "
          f"{'af out 50':>10} {'af out 100':>11}")
    by_p = {}
    for r in per_cond:
        by_p.setdefault(r.person, {})[r.freq_hz] = r
    for name, conds in by_p.items():
        b50 = conds.get(50); b100 = conds.get(100)
        print(f"  {name:<14} "
              f"{b50.baseline_mean if b50 else float('nan'):>10.3f} "
              f"{b50.baseline_std  if b50 else float('nan'):>8.3f} "
              f"{b100.baseline_mean if b100 else float('nan'):>10.3f} "
              f"{b100.baseline_std  if b100 else float('nan'):>8.3f} "
              f"{(b50.af_outlier_pct if b50 else float('nan')):>9.2f}% "
              f"{(b100.af_outlier_pct if b100 else float('nan')):>10.2f}%")

    g50, g100 = result["group_50"], result["group_100"]
    print(f"\n=== Group means (change %), 50 Hz ===")
    print(g50[["bucket", "n_people", "n_flagged_excluded",
               "group_mean_change_pct", "group_std_change_pct"]].to_string(
        index=False, formatters={
            "group_mean_change_pct": "{:+.2f}".format,
            "group_std_change_pct":  "{:.2f}".format,
        }))
    print(f"\n=== Group means (change %), 100 Hz ===")
    print(g100[["bucket", "n_people", "n_flagged_excluded",
                "group_mean_change_pct", "group_std_change_pct"]].to_string(
        index=False, formatters={
            "group_mean_change_pct": "{:+.2f}".format,
            "group_std_change_pct":  "{:.2f}".format,
        }))
    print(f"\n=== Paired 50 vs 100 Hz comparison ===")
    comp = result["comparison"]
    print(comp[["bucket", "n_paired", "mean_50hz", "mean_100hz",
                "mean_diff_100minus50", "paired_t_p", "wilcoxon_p",
                "preferred_p"]].to_string(index=False, formatters={
                    "mean_50hz": "{:+.2f}".format,
                    "mean_100hz": "{:+.2f}".format,
                    "mean_diff_100minus50": "{:+.2f}".format,
                    "paired_t_p": "{:.4f}".format,
                    "wilcoxon_p": "{:.4f}".format,
                    "preferred_p": "{:.4f}".format,
                }))

    os.makedirs(os.path.dirname(args.out_prefix), exist_ok=True)
    xlsx_out = args.out_prefix + "_results.xlsx"
    export_horizontal_excel(result, xlsx_out)

    plot_group_curves(g50, g100, per_cond, args.out_prefix + "_01_group_curves.png")
    plot_group_comparison(g50, g100, comp,  args.out_prefix + "_02_freq_comparison.png")
    plot_baseline_distribution(per_cond,     args.out_prefix + "_03_baselines.png")

    if args.plot_signals:
        for freq in [50, 100]:
            for phase in ["be", "af"]:
                plot_signals_grid(result["recordings_full"],
                                  args.out_prefix + f"_signals_{freq}hz_{phase}.png",
                                  freq=freq, phase=phase)

    print(f"\nWrote:")
    print(f"  {xlsx_out}")
    print(f"  {args.out_prefix}_01_group_curves.png")
    print(f"  {args.out_prefix}_02_freq_comparison.png")
    print(f"  {args.out_prefix}_03_baselines.png")


if __name__ == "__main__":
    main()
