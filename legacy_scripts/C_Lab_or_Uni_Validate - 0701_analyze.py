# -*- coding: utf-8 -*-
"""
Exploratory before/after analysis: laser-Doppler flux + myoton stiffness across
the 9-coordinate foot grid, plus global thermal summary.
"""
import os, re, math
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = r"C:\Lab_or_Uni\Validate - 0701"
OUT  = os.path.join(ROOT, "analysis_out")
os.makedirs(OUT, exist_ok=True)

FS          = 40.0
STARTUP_GAP = 2.0
EDGE_TRIM   = 1.0
PATH        = [5, 2, 6, 8, 4, 3, 9, 7, 1]

SUBJECTS = {
    "bam": dict(dir="bam", myo="Myoton + Micro BAM.txt",
                before_micro="0701_Bam - Before.txt", after_micro="0701_Bam - After.txt",
                before_flir="FLIR0308.jpg", after_flir="FLIR0310.jpg"),
    "raihan": dict(dir="raihan", myo="Myoton + Micro RAIHAN.txt",
                before_micro="0701_Raihan - Before.txt", after_micro="0701_Raihan - After.txt",
                before_flir="FLIR0312.jpg", after_flir="FLIR0313.jpg"),
}

def parse_micro(path):
    vals = []
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            parts = line.replace(",", " ").split()
            nums = []; ok = True
            for p in parts:
                try:
                    nums.append(float(p))
                except ValueError:
                    ok = False; break
            if not ok or not nums:
                continue
            if len(nums) >= 2:
                c1, c2 = nums[0], nums[1]
                v = c1 if np.isfinite(c1) else c2
            else:
                v = nums[0]
            vals.append(v)
    return np.asarray(vals, float)

def parse_time(tok):
    a = tok.split(".")
    if len(a) == 3:
        return int(a[0]) * 60 + int(a[1]) + int(a[2]) / 100.0
    if len(a) == 2:
        return int(a[0]) + int(a[1]) / 100.0
    return float(tok)

def parse_myoton_file(path):
    lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    myo_lines = [l for l in lines if re.search(r"\d+\s*-\s*\d+", l)]
    ints = lambda l: [int(x) for x in re.findall(r"\d+", l)]
    myo_before = ints(myo_lines[0])[:9]
    myo_after  = ints(myo_lines[1])[:9]
    ts_rows = []
    for l in lines:
        m = re.match(r"\s*(\d+)\s+(\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+)\s*$", l)
        if m:
            ts_rows.append(parse_time(m.group(2)))
    return dict(myo_before=myo_before, myo_after=myo_after,
                ts_before=ts_rows[0:9], ts_after=ts_rows[9:18])

def window_flux(flux, ts_cum):
    n = len(flux); t = np.arange(n) / FS
    starts = [0.0] + list(ts_cum[:-1]); ends = list(ts_cum)
    out = []
    for m in range(9):
        s, e = starts[m], ends[m]
        if m == 0:
            s = max(s, STARTUP_GAP)
        s2 = s + EDGE_TRIM
        if s2 >= e:
            s2 = s
        seg = flux[(t >= s2) & (t < e)]
        if seg.size == 0:
            out.append(dict(n=0, median=np.nan, tmean=np.nan))
        else:
            out.append(dict(n=int(seg.size), median=float(np.median(seg)),
                            tmean=float(stats.trim_mean(seg, 0.1))))
    return out

def find_temp_csv(sdir, flir):
    stem = os.path.splitext(flir)[0]
    cand = os.path.join(ROOT, sdir, flir + "_analysis", stem + "_temp.csv")
    return cand if os.path.exists(cand) else None

def load_temp(sdir, flir):
    csvp = find_temp_csv(sdir, flir)
    if csvp:
        return np.loadtxt(csvp, delimiter=","), "temp.csv"
    try:
        import flyr
        return flyr.unpack(os.path.join(ROOT, sdir, flir)).celsius.astype(float), "flyr"
    except Exception as e:
        return None, "unavailable(%s)" % type(e).__name__

def temp_stats(T):
    f = T[np.isfinite(T)]; p90 = np.percentile(f, 90)
    return dict(min=float(f.min()), p50=float(np.median(f)), mean=float(f.mean()),
                p90=float(p90), warm_mean=float(f[f >= p90].mean()), max=float(f.max()))

def sample_grid(T, cx, cy, px_per_cm, rot_deg=0.0):
    h, w = T.shape
    def bilin(x, y):
        x = min(max(x, 0), w - 1); y = min(max(y, 0), h - 1)
        x0, y0 = int(x), int(y); x1, y1 = min(x0 + 1, w - 1), min(y0 + 1, h - 1)
        fx, fy = x - x0, y - y0
        return (T[y0, x0]*(1-fx)*(1-fy) + T[y0, x1]*fx*(1-fy) +
                T[y1, x0]*(1-fx)*fy + T[y1, x1]*fx*fy)
    r = math.radians(rot_deg)
    layout = {1:(-1,-1),2:(0,-1),3:(1,-1),4:(-1,0),5:(0,0),6:(1,0),7:(-1,1),8:(0,1),9:(1,1)}
    res = {}
    for cell,(gx,gy) in layout.items():
        dx, dy = gx*px_per_cm, gy*px_per_cm
        rx = dx*math.cos(r) - dy*math.sin(r); ry = dx*math.sin(r) + dy*math.cos(r)
        res[cell] = float(bilin(cx+rx, cy+ry))
    return res

rows = []; temp_summary = []
for subj, cfg in SUBJECTS.items():
    myo = parse_myoton_file(os.path.join(ROOT, cfg["dir"], cfg["myo"]))
    for cond, mkey, tskey, mykey, flir in [
        ("before", "before_micro", "ts_before", "myo_before", "before_flir"),
        ("after",  "after_micro",  "ts_after",  "myo_after",  "after_flir")]:
        flux = parse_micro(os.path.join(ROOT, cfg["dir"], cfg[mkey]))
        win  = window_flux(flux, myo[tskey]); myov = myo[mykey]
        for m in range(9):
            rows.append(dict(subject=subj, condition=cond, cell=PATH[m], meas_order=m+1,
                             flux_median=win[m]["median"], flux_tmean=win[m]["tmean"],
                             flux_n=win[m]["n"], myoton_Nm=myov[m]))
        T, src = load_temp(cfg["dir"], cfg[flir])
        rec = dict(subject=subj, condition=cond, flir=flir, source=src)
        if T is not None:
            rec.update(temp_stats(T)); rec["shape"] = "x".join(map(str, T.shape))
        temp_summary.append(rec)

df = pd.DataFrame(rows).sort_values(["subject", "condition", "cell"])
df.to_csv(os.path.join(OUT, "per_coordinate.csv"), index=False)
tdf = pd.DataFrame(temp_summary)
tdf.to_csv(os.path.join(OUT, "temperature_global.csv"), index=False)

def grid3(d):
    g = np.full((3, 3), np.nan)
    for c, v in d.items():
        g[(c-1)//3, (c-1)%3] = v
    return g

print("="*70); print("PER-SUBJECT SUMMARY (means across the 9 sites)"); print("="*70)
summary_rows = []; corr_rows = []
for subj in SUBJECTS:
    for cond in ["before", "after"]:
        sub = df[(df.subject==subj)&(df.condition==cond)]
        fx = sub.set_index("cell")["flux_median"]; my = sub.set_index("cell")["myoton_Nm"]
        summary_rows.append(dict(subject=subj, condition=cond, flux_mean=fx.mean(),
                                 flux_sd=fx.std(), myoton_mean=my.mean(), myoton_sd=my.std()))
    b = df[(df.subject==subj)&(df.condition=="before")].set_index("cell")
    a = df[(df.subject==subj)&(df.condition=="after")].set_index("cell")
    print("\n%-7s flux %.1f -> %.1f (d %+.1f PU) | myoton %.0f -> %.0f (d %+.0f N/m)"
          % (subj.upper(), b["flux_median"].mean(), a["flux_median"].mean(),
             (a["flux_median"]-b["flux_median"]).mean(),
             b["myoton_Nm"].mean(), a["myoton_Nm"].mean(),
             (a["myoton_Nm"]-b["myoton_Nm"]).mean()))
    for cond, d in [("before", b), ("after", a)]:
        rho, p = stats.spearmanr(d["flux_median"], d["myoton_Nm"])
        dd = d.reset_index()
        drho, dp = stats.spearmanr(dd["flux_median"], dd["meas_order"])
        corr_rows.append(dict(subject=subj, condition=cond,
                              spearman_flux_myoton=round(rho,3), p_flux_myoton=round(p,3),
                              spearman_flux_measorder=round(drho,3), p_measorder=round(dp,3)))
        print("   %-6s flux~myoton rho=%+.2f (p=%.2f)   flux~meas-order rho=%+.2f (p=%.2f)"
              % (cond, rho, p, drho, dp))

pd.DataFrame(summary_rows).to_csv(os.path.join(OUT, "summary_global.csv"), index=False)
pd.DataFrame(corr_rows).to_csv(os.path.join(OUT, "correlations.csv"), index=False)

print("\n"+"="*70); print("THERMAL (global; per-coordinate needs a center click)"); print("="*70)
if len(tdf):
    show = ["subject","condition","flir","source"] + [c for c in ["warm_mean","p50","max"] if c in tdf.columns]
    print(tdf[show].to_string(index=False))

for subj in SUBJECTS:
    fig, axes = plt.subplots(2, 3, figsize=(13, 8))
    fig.suptitle("%s  flux (PU) & myoton (N/m) across the 9-site grid" % subj.upper(), fontweight="bold")
    b = df[(df.subject==subj)&(df.condition=="before")].set_index("cell")
    a = df[(df.subject==subj)&(df.condition=="after")].set_index("cell")
    panels = [("flux before", grid3(b["flux_median"].to_dict()), "inferno"),
              ("flux after",  grid3(a["flux_median"].to_dict()), "inferno"),
              ("flux delta",  grid3((a["flux_median"]-b["flux_median"]).to_dict()), "coolwarm"),
              ("myoton before", grid3(b["myoton_Nm"].to_dict()), "viridis"),
              ("myoton after",  grid3(a["myoton_Nm"].to_dict()), "viridis"),
              ("myoton delta",  grid3((a["myoton_Nm"]-b["myoton_Nm"]).to_dict()), "coolwarm")]
    for ax, (title, g, cmap) in zip(axes.flatten(), panels):
        im = ax.imshow(g, cmap=cmap); ax.set_title(title, fontsize=10)
        for (i, j), val in np.ndenumerate(g):
            if np.isfinite(val):
                ax.text(j, i, "%d\n%.0f" % (i*3+j+1, val), ha="center", va="center",
                        fontsize=8, color="white")
        ax.set_xticks([]); ax.set_yticks([]); fig.colorbar(im, ax=ax, fraction=0.046)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    fig.savefig(os.path.join(OUT, "grid_%s.png" % subj), dpi=130); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 5))
    for cond, mk in [("before","o"), ("after","s")]:
        d = df[(df.subject==subj)&(df.condition==cond)]
        ax.scatter(d["myoton_Nm"], d["flux_median"], marker=mk, s=70, label=cond)
        for _, r in d.iterrows():
            ax.annotate(int(r["cell"]), (r["myoton_Nm"], r["flux_median"]), fontsize=8)
    ax.set_xlabel("myoton stiffness (N/m)"); ax.set_ylabel("flux median (PU)")
    ax.set_title("%s  flux vs stiffness (9 sites)" % subj.upper()); ax.legend()
    plt.tight_layout(); fig.savefig(os.path.join(OUT, "scatter_%s.png" % subj), dpi=130); plt.close(fig)

print("\nOutputs:", OUT); print("Files:", ", ".join(sorted(os.listdir(OUT))))
