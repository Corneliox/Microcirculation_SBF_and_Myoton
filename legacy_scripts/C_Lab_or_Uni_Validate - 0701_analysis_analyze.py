"""
Exploratory before/after analysis — foot thermal / microcirculation / myoton.

Fully data-driven for FLUX and MYOTON (9 sites each, before & after).
TEMPERATURE enters only as a global / warm-region summary for now
(per-coordinate temp needs the 9 pixel locations = the grid-click step).

Run:  python analysis/analyze.py
Out:  analysis/out/*.csv , analysis/out/*.png , console summary
"""
import os, re, math, sys, csv
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    sys.stdout.reconfigure(encoding="utf-8")   # Windows console: allow ρ, Δ, °
except Exception:
    pass

ROOT = r"C:\Lab_or_Uni\Validate - 0701"
os.chdir(ROOT)
OUT = os.path.join(ROOT, "analysis", "out")
os.makedirs(OUT, exist_ok=True)

FS = 40.0                                  # microcirculation sample rate (Hz)
PATH = [5, 2, 6, 8, 4, 3, 9, 7, 1]         # measurement order -> grid cell
STARTUP_GAP = 2.0                          # s discarded before first coordinate
SETTLE = 1.0                               # s trimmed at start of each window (probe-move spike)
END_TRIM = 0.5                             # s trimmed at end of each window

SUBJECTS = {
    "bam": {
        "micro_before": "bam/0701_Bam - Before.txt",
        "micro_after":  "bam/0701_Bam - After.txt",
        "myoton":       "bam/Myoton + Micro BAM.txt",
        "flir_before":  "bam/FLIR0308.jpg",
        "flir_after":   "bam/FLIR0310.jpg",
    },
    "raihan": {
        "micro_before": "raihan/0701_Raihan - Before.txt",
        "micro_after":  "raihan/0701_Raihan - After.txt",
        "myoton":       "raihan/Myoton + Micro RAIHAN.txt",
        "flir_before":  "raihan/FLIR0312.jpg",
        "flir_after":   "raihan/FLIR0313.jpg",
    },
}


# ─────────────────────────── parsing ───────────────────────────

def parse_flux(path):
    """Return 1-D array of Channel-1 flux (Ch1==Ch2; use Ch1, fallback Ch2)."""
    vals = []
    with open(path) as f:
        for ln in f:
            if any(ch.isalpha() for ch in ln):   # header ("Channel 1 …") / labels
                continue
            parts = ln.replace(",", " ").split()
            nums = []
            for p in parts:
                try:
                    nums.append(float(p))
                except ValueError:
                    pass
            if not nums:              # header / blank
                continue
            vals.append(nums[0])
    return np.asarray(vals, dtype=float)


TS_RE = re.compile(r'^\s*(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})\s*$')

def _to_sec(mm, ss, hh):
    return int(mm) * 60 + int(ss) + int(hh) / 100.0

def parse_myoton_file(path):
    """Return (myo_before[9], myo_after[9], ts_before[9], ts_after[9]).
    Values/timestamps are in measurement order (idx 01 = grid cell 5)."""
    lines = open(path).read().splitlines()

    # timestamp rows, in file order
    ts = []
    first_ts_line = None
    for i, ln in enumerate(lines):
        m = TS_RE.match(ln)
        if m:
            if first_ts_line is None:
                first_ts_line = i
            ts.append((int(m.group(1)),
                       _to_sec(m.group(2), m.group(3), m.group(4)),   # cumulative
                       _to_sec(m.group(5), m.group(6), m.group(7))))  # delta
    assert len(ts) >= 18, f"{path}: expected >=18 timestamp rows, got {len(ts)}"
    ts_before, ts_after = ts[:9], ts[9:18]

    # myoton value lines: dash-joined ints appearing before the timestamp block
    my_i = next(i for i, l in enumerate(lines) if l.strip().lower() == "myoton")
    cand = [l for l in lines[my_i + 1: first_ts_line]
            if "-" in l and len(re.findall(r"\d+", l)) >= 5]
    assert len(cand) >= 2, f"{path}: could not find 2 myoton value lines"
    myo_before = [int(x) for x in re.findall(r"\d+", cand[0])]
    myo_after  = [int(x) for x in re.findall(r"\d+", cand[1])]
    assert len(myo_before) == 9 and len(myo_after) == 9, \
        f"{path}: myoton not 9 values ({len(myo_before)}/{len(myo_after)})"
    return myo_before, myo_after, ts_before, ts_after


# ─────────────────────── flux segmentation ───────────────────────

def summarize(seg):
    seg = np.asarray(seg, float)
    if seg.size == 0:
        return dict(n=0, median=np.nan, mean=np.nan, tmean=np.nan, std=np.nan)
    return dict(
        n=seg.size,
        median=float(np.median(seg)),
        mean=float(np.mean(seg)),
        tmean=float(stats.trim_mean(seg, 0.1)),   # 10% trimmed mean
        std=float(np.std(seg, ddof=1)) if seg.size > 1 else 0.0,
    )

def window_flux(flux, ts_block):
    """Map each coordinate window -> robust flux stats, keyed by grid cell."""
    out, prev_end = {}, 0.0
    diag = []
    for k, (idx, cum, dl) in enumerate(ts_block):
        w_start, w_end = prev_end, cum
        s = w_start + (STARTUP_GAP if k == 0 else SETTLE)
        e = w_end - END_TRIM
        if e <= s:                       # window too short after trims -> keep raw
            s, e = w_start, w_end
        i0 = int(math.ceil(s * FS))
        i1 = min(int(math.floor(e * FS)), flux.size - 1)
        seg = flux[i0:i1 + 1] if i1 >= i0 else np.array([])
        cell = PATH[k]
        st = summarize(seg)
        out[cell] = st
        diag.append((cell, round(w_start, 2), round(w_end, 2), st["n"]))
        prev_end = w_end
    return out, diag


# ─────────────────────────── temperature ───────────────────────────

def load_temp(jpg):
    """°C array from FLIR jpg via flyr; else existing *_temp.csv; else None."""
    try:
        import flyr
        return flyr.unpack(jpg).celsius.astype(np.float32), "flyr"
    except Exception:
        pass
    stem = os.path.splitext(os.path.basename(jpg))[0]
    folder = os.path.dirname(jpg)
    csvp = os.path.join(folder, f"{os.path.basename(jpg)}_analysis", f"{stem}_temp.csv")
    if os.path.exists(csvp):
        return np.loadtxt(csvp, delimiter=","), "csv"
    return None, "missing"

def temp_stats(temp):
    if temp is None:
        return None
    t = temp[np.isfinite(temp)]
    warm = t[t >= np.percentile(t, 60)]         # crude foot / warm-region proxy
    return dict(
        whole_mean=float(t.mean()),
        warm_mean=float(warm.mean()),
        p90=float(np.percentile(t, 90)),
        p95=float(np.percentile(t, 95)),
        max=float(t.max()),
    )


# ─────────────────────────── plotting ───────────────────────────

def to_grid(cell_map, key="median"):
    """9 per-cell values -> 3x3 matrix (cell g at row (g-1)//3, col (g-1)%3)."""
    g = np.full((3, 3), np.nan)
    for cell, st in cell_map.items():
        v = st[key] if isinstance(st, dict) else st
        g[(cell - 1) // 3, (cell - 1) % 3] = v
    return g

def heat(ax, mat, title, cmap):
    im = ax.imshow(mat, cmap=cmap)
    for r in range(3):
        for c in range(3):
            if np.isfinite(mat[r, c]):
                ax.text(c, r, f"{mat[r,c]:.0f}\n#{r*3+c+1}",
                        ha="center", va="center", fontsize=8,
                        color="white", fontweight="bold")
    ax.set_title(title, fontsize=9)
    ax.set_xticks([]); ax.set_yticks([])
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

def subject_figure(name, df, corr_txt):
    fig, ax = plt.subplots(2, 3, figsize=(14, 9))
    heat(ax[0, 0], df["flux_grid_before"], f"{name}  FLUX before (median PU)", "inferno")
    heat(ax[0, 1], df["flux_grid_after"],  f"{name}  FLUX after (median PU)",  "inferno")
    heat(ax[0, 2], df["flux_grid_after"] - df["flux_grid_before"], f"{name}  Δ FLUX (after-before)", "coolwarm")
    heat(ax[1, 0], df["myo_grid_before"],  f"{name}  MYOTON before (N/m)", "viridis")
    heat(ax[1, 1], df["myo_grid_after"],   f"{name}  MYOTON after (N/m)",  "viridis")
    heat(ax[1, 2], df["myo_grid_after"] - df["myo_grid_before"], f"{name}  Δ MYOTON (after-before)", "coolwarm")
    fig.suptitle(f"{name} — 9-site flux & myoton (grid layout 1-9)\n{corr_txt}",
                 fontsize=11, fontweight="bold")
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    p = os.path.join(OUT, f"{name}_grids.png")
    fig.savefig(p, dpi=140); plt.close(fig)
    return p

def scatter_figure(name, per):
    fig, ax = plt.subplots(1, 2, figsize=(11, 4.5))
    for a, cond in zip(ax, ["before", "after"]):
        x = per[f"flux_{cond}_median"]; y = per[f"myo_{cond}"]
        a.scatter(x, y, c=per["cell"], cmap="tab10", s=90, edgecolor="k", zorder=3)
        for _, row in per.iterrows():
            a.annotate(int(row["cell"]), (row[f"flux_{cond}_median"], row[f"myo_{cond}"]),
                       fontsize=8, ha="center", va="center", color="white", zorder=4)
        rho, p = stats.spearmanr(x, y)
        a.set_title(f"{name} {cond}: flux vs myoton  (Spearman ρ={rho:.2f}, p={p:.2f})", fontsize=9)
        a.set_xlabel("flux median (PU)"); a.set_ylabel("myoton (N/m)")
        a.grid(alpha=0.3)
    plt.tight_layout()
    p = os.path.join(OUT, f"{name}_flux_vs_myoton.png")
    fig.savefig(p, dpi=140); plt.close(fig)
    return p


# ─────────────────────────── main ───────────────────────────

def spearman_line(tag, x, y):
    rho, p = stats.spearmanr(x, y)
    pr, pp = stats.pearsonr(x, y)
    return f"{tag}: Spearman ρ={rho:+.2f} (p={p:.2f}) | Pearson r={pr:+.2f} (p={pp:.2f})"

def _resid(y, x):
    """Residuals of y regressed linearly on x."""
    x = np.asarray(x, float); y = np.asarray(y, float)
    A = np.vstack([x, np.ones_like(x)]).T
    coef, *_ = np.linalg.lstsq(A, y, rcond=None)
    return y - A @ coef

def partial_spearman(a, b, ctrl):
    """Partial Spearman of a,b controlling for ctrl (rank-residual Pearson)."""
    ra, rb, rc = (stats.rankdata(v) for v in (a, b, ctrl))
    return stats.pearsonr(_resid(ra, rc), _resid(rb, rc))

def main():
    all_per = []
    summary_rows = []
    print("=" * 78)
    for name, F in SUBJECTS.items():
        print(f"\n########## {name.upper()} ##########")

        myo_b, myo_a, ts_b, ts_a = parse_myoton_file(F["myoton"])
        flux_b = parse_flux(F["micro_before"])
        flux_a = parse_flux(F["micro_after"])
        print(f"flux samples: before={flux_b.size} (~{flux_b.size/FS:.1f}s), "
              f"after={flux_a.size} (~{flux_a.size/FS:.1f}s)")
        print(f"timestamp span: before={ts_b[-1][1]:.1f}s  after={ts_a[-1][1]:.1f}s")

        fb, diagb = window_flux(flux_b, ts_b)
        fa, diaga = window_flux(flux_a, ts_a)
        print("  per-window sample counts (cell,start,end,n):")
        print("   before:", diagb)
        print("   after :", diaga)

        # per-coordinate table (grid cell order 1..9)
        rows = []
        for k in range(9):
            cell = PATH[k]
            rows.append(dict(
                subject=name, cell=cell,
                flux_before_median=fb[cell]["median"], flux_before_mean=fb[cell]["mean"],
                flux_after_median=fa[cell]["median"],  flux_after_mean=fa[cell]["mean"],
                myo_before=myo_b[k], myo_after=myo_a[k],
            ))
        per = pd.DataFrame(rows).sort_values("cell").reset_index(drop=True)
        per["flux_delta_median"] = per["flux_after_median"] - per["flux_before_median"]
        per["myo_delta"] = per["myo_after"] - per["myo_before"]
        order_of = {PATH[k]: k for k in range(9)}      # grid cell -> measurement order 0..8
        per["order"] = per["cell"].map(order_of)
        all_per.append(per)

        # global flux up/down after the walk+heat
        gb, ga = per["flux_before_median"].mean(), per["flux_after_median"].mean()
        print(f"  global flux (mean of 9 sites): before={gb:.1f}  after={ga:.1f}  Δ={ga-gb:+.1f} PU")

        # correlations across the 9 sites
        print("  --- spatial correlations across 9 sites ---")
        c1 = spearman_line("  flux vs myoton  (before)", per["flux_before_median"], per["myo_before"])
        c2 = spearman_line("  flux vs myoton  (after) ", per["flux_after_median"],  per["myo_after"])
        c3 = spearman_line("  Δflux vs Δmyoton        ", per["flux_delta_median"],  per["myo_delta"])
        for c in (c1, c2, c3):
            print(c)
        corr_txt = c1.strip() + "   |   " + c2.strip()

        # measurement-order (time-decay) confound check
        print("  --- measurement-order confound (5-2-6-8-4-3-9-7-1) ---")
        print(spearman_line("  flux(before) vs order  ", per["flux_before_median"], per["order"]))
        print(spearman_line("  flux(after)  vs order  ", per["flux_after_median"],  per["order"]))
        print(spearman_line("  myoton(before) vs order", per["myo_before"], per["order"]))
        print(spearman_line("  myoton(after)  vs order", per["myo_after"],  per["order"]))
        prb, ppb = partial_spearman(per["flux_before_median"], per["myo_before"], per["order"])
        pra, ppa = partial_spearman(per["flux_after_median"],  per["myo_after"],  per["order"])
        print(f"  PARTIAL flux~myoton | order (before): ρ={prb:+.2f} (p={ppb:.2f})")
        print(f"  PARTIAL flux~myoton | order (after) : ρ={pra:+.2f} (p={ppa:.2f})")

        # temperature (global)
        tb = temp_stats(load_temp(F["flir_before"])[0])
        ta_arr, src = load_temp(F["flir_after"])
        ta = temp_stats(ta_arr)
        print(f"  --- temperature global (after source: {src}) ---")
        if tb and ta:
            for kk in ("whole_mean", "warm_mean", "p90", "p95", "max"):
                print(f"    {kk:11s}: before={tb[kk]:6.2f}  after={ta[kk]:6.2f}  Δ={ta[kk]-tb[kk]:+.2f} °C")
        else:
            print("    temperature arrays unavailable (flyr not installed and no _temp.csv)")

        # figures
        grids = dict(
            flux_grid_before=to_grid(fb, "median"),
            flux_grid_after=to_grid(fa, "median"),
            myo_grid_before=to_grid({PATH[k]: {"median": myo_b[k]} for k in range(9)}, "median"),
            myo_grid_after=to_grid({PATH[k]: {"median": myo_a[k]} for k in range(9)}, "median"),
        )
        p1 = subject_figure(name, grids, corr_txt)
        p2 = scatter_figure(name, per)
        print(f"  figures: {os.path.basename(p1)}, {os.path.basename(p2)}")

        # summary row
        srow = dict(subject=name,
                    flux_before_mean=per["flux_before_median"].mean(),
                    flux_after_mean=per["flux_after_median"].mean(),
                    myo_before_mean=per["myo_before"].mean(),
                    myo_after_mean=per["myo_after"].mean())
        if tb and ta:
            srow.update(temp_warm_before=tb["warm_mean"], temp_warm_after=ta["warm_mean"],
                        temp_p95_before=tb["p95"], temp_p95_after=ta["p95"])
        summary_rows.append(srow)

    per_all = pd.concat(all_per, ignore_index=True)
    per_all.to_csv(os.path.join(OUT, "per_coordinate.csv"), index=False)
    pd.DataFrame(summary_rows).to_csv(os.path.join(OUT, "summary.csv"), index=False)
    print("\nWrote analysis/out/per_coordinate.csv, summary.csv, and PNGs.")
    print("=" * 78)

if __name__ == "__main__":
    main()
