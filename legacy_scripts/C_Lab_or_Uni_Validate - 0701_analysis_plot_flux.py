"""
Visual QC of the laser-Doppler flux traces. For each subject/condition, plot the
full trace with coordinate-window boundaries and three candidate per-coordinate
estimators, so we can pick one that resists the motion-artifact spikes:
  - median          (current pipeline choice)
  - p25             (low-side; true resting perfusion tends to the lower envelope)
  - stable2s        (mean of the lowest-variance 2 s sub-window = 'probe held still')
Saves one PNG per subject.
"""
import re
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FS = 40.0
PATH = [5, 2, 6, 8, 4, 3, 9, 7, 1]
WIN2S = int(2 * FS)

SUBJECTS = {
    "bam":    ("bam/0701_Bam - Before.txt",       "bam/0701_Bam - After.txt",       "bam/Myoton + Micro BAM.txt"),
    "raihan": ("raihan/0701_Raihan - Before.txt", "raihan/0701_Raihan - After.txt", "raihan/Myoton + Micro RAIHAN.txt"),
}


def read_flux(p):
    out = []
    for ln in Path(p).read_text(errors="ignore").splitlines():
        t = ln.split()
        try:
            out.append(float(t[0]))
        except (ValueError, IndexError):
            pass
    return np.array(out)


def cums(myoton_path, block):
    rows = re.findall(r"^\s*\d{2}\s+(\d{2})\.(\d{2})\.(\d{2})", Path(myoton_path).read_text(), re.M)
    c = [int(a) * 60 + int(b) + int(cc) / 100 for a, b, cc in rows]
    return c[block * 9:(block + 1) * 9]


def estimators(seg):
    if len(seg) < 5:
        return dict(median=np.nan, p25=np.nan, stable2s=np.nan)
    # min-variance 2 s sub-window
    if len(seg) >= WIN2S:
        best_i, best_v = 0, np.inf
        for i in range(0, len(seg) - WIN2S + 1, 4):
            v = seg[i:i + WIN2S].var()
            if v < best_v:
                best_v, best_i = v, i
        stable = seg[best_i:best_i + WIN2S].mean()
    else:
        stable = seg.mean()
    return dict(median=np.median(seg), p25=np.percentile(seg, 25), stable2s=stable)


def plot_condition(ax, flux, cum, title):
    t = np.arange(len(flux)) / FS
    ax.plot(t, flux, lw=0.5, color="#444", alpha=0.9)
    prev = 0.0
    rows = []
    for m, c in enumerate(cum, 1):
        s0, s1 = int(round(prev * FS)), int(round(c * FS))
        seg = flux[s0:s1]
        est = estimators(seg)
        cell = PATH[m - 1]
        # boundary + label
        ax.axvline(c, color="#bbb", ls=":", lw=0.8)
        ax.text((prev + c) / 2, ax.get_ylim()[1] * 0.96 if False else flux.max() * 0.97,
                f"c{cell}", ha="center", va="top", fontsize=8, color="#0066cc")
        # estimator bars within window
        ax.hlines(est["median"], prev, c, color="crimson", lw=1.6)
        ax.hlines(est["p25"], prev, c, color="green", lw=1.4)
        ax.hlines(est["stable2s"], prev, c, color="orange", lw=1.6)
        prev = c
        rows.append((cell, m, est))
    ax.set_title(title, fontsize=10)
    ax.set_ylabel("flux (PU)")
    ax.set_xlim(0, len(flux) / FS)
    return rows


fig_rows = {}
for name, (bf, af, myo) in SUBJECTS.items():
    fb, fa = read_flux(ROOT / bf), read_flux(ROOT / af)
    cb, ca = cums(ROOT / myo, 0), cums(ROOT / myo, 1)
    fig, axes = plt.subplots(2, 1, figsize=(13, 7), sharex=False)
    rb = plot_condition(axes[0], fb, cb, f"{name.upper()} — BEFORE")
    ra = plot_condition(axes[1], fa, ca, f"{name.upper()} — AFTER")
    axes[1].set_xlabel("time (s)")
    # legend
    from matplotlib.lines import Line2D
    axes[0].legend(handles=[
        Line2D([], [], color="crimson", label="median"),
        Line2D([], [], color="green", label="p25"),
        Line2D([], [], color="orange", label="stable 2s"),
    ], fontsize=8, loc="upper right")
    fig.suptitle(f"Laser-Doppler flux trace QC — {name.upper()}", fontsize=12, fontweight="bold")
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    out = ROOT / "analysis" / f"{name}_flux_trace.png"
    fig.savefig(out, dpi=110)
    plt.close(fig)
    print("wrote", out.name)
    fig_rows[name] = (rb, ra)

# print estimator comparison table per subject
for name, (rb, ra) in fig_rows.items():
    print(f"\n=== {name.upper()} per-coordinate flux estimators (cell: median / p25 / stable2s) ===")
    print("        BEFORE                         AFTER")
    bb = {c: e for c, m, e in rb}
    aa = {c: e for c, m, e in ra}
    for cell in range(1, 10):
        b, a = bb[cell], aa[cell]
        print(f"  cell{cell}:  {b['median']:6.0f} {b['p25']:6.0f} {b['stable2s']:6.0f}   |  "
              f"{a['median']:6.0f} {a['p25']:6.0f} {a['stable2s']:6.0f}")
