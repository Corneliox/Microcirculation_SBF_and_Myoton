"""
Segment microcirculation (laser-Doppler flux, ~40 Hz) into the 9 measurement
windows using the per-coordinate timestamp block, join with myoton stiffness,
and report per-coordinate BEFORE/AFTER values + spatial concordance.

Temperature is intentionally left out here (needs the grid pixel location on the
thermal image); this handles the two index-based signals that need no user input.

Pure stdlib. Run:  python analysis/parse_micro_myoton.py
"""

import re, csv, statistics as st
from pathlib import Path

FS = 40.0                       # nominal sample rate (Hz)
PATH = [5, 2, 6, 8, 4, 3, 9, 7, 1]   # measurement order -> grid cell
PCTILE  = 25     # per-coordinate perfusion = 25th-pctile of the dwell.
                 # Motion/probe-move spikes are always UPWARD and land at either
                 # edge of the window (start for Raihan, end for Bam), so a low
                 # percentile robustly tracks the settled resting plateau while a
                 # median gets dragged up by the spike. Spike position varies by
                 # subject, so head-guard / tail-only slicing is not reliable.
MIN_WIN_N = 20   # need at least this many samples to estimate a coordinate

ROOT = Path(__file__).resolve().parent.parent

SUBJECTS = {
    "bam": {
        "micro_before": "bam/0701_Bam - Before.txt",
        "micro_after":  "bam/0701_Bam - After.txt",
        "myoton":       "bam/Myoton + Micro BAM.txt",
    },
    "raihan": {
        "micro_before": "raihan/0701_Raihan - Before.txt",
        "micro_after":  "raihan/0701_Raihan - After.txt",
        "myoton":       "raihan/Myoton + Micro RAIHAN.txt",
    },
}


# ── parsing ──────────────────────────────────────────────────────────────────
def read_flux(path):
    """Return list of flux values (channel 1; channels are duplicated)."""
    vals = []
    for line in Path(path).read_text(errors="ignore").splitlines():
        tok = line.replace(",", " ").split()
        if not tok:
            continue
        try:
            vals.append(float(tok[0]))
        except ValueError:
            continue                      # header / label line
    return vals


def parse_myoton_file(path):
    """
    Return dict with:
      stiff_before, stiff_after : 9 ints in PATH order (measurement order)
      ts_before, ts_after       : list of cumulative seconds per coordinate (len 9)
    """
    text = Path(path).read_text(errors="ignore")

    # dash-separated stiffness rows (the '|' is cosmetic); first two = before, after
    dash = re.findall(r"\d+(?:\s*[-|]\s*\d+){4,}", text)
    def to_ints(s):
        return [int(x) for x in re.findall(r"\d+", s)]
    stiff_before = to_ints(dash[0])
    stiff_after  = to_ints(dash[1])

    # timestamp rows:  NN   MM.SS.hh   MM.SS.hh   (first 9 = before, next 9 = after)
    rows = re.findall(r"^\s*(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})",
                      text, re.M)
    cums = []
    for _idx, cm, cs, ch, _dm, _ds, _dh in rows:
        cums.append(int(cm) * 60 + int(cs) + int(ch) / 100.0)
    ts_before, ts_after = cums[:9], cums[9:18]

    assert len(stiff_before) == 9 and len(stiff_after) == 9, "myoton != 9 values"
    assert len(ts_before) == 9 and len(ts_after) == 9, "timestamps != 9+9"
    return dict(stiff_before=stiff_before, stiff_after=stiff_after,
                ts_before=ts_before, ts_after=ts_after)


def segment_flux(flux, cum_times):
    """
    cum_times: cumulative end-time (s) of each of the 9 coordinate windows.
    Returns list of dicts per measurement index with robust flux stats.
    """
    out = []
    prev = 0.0
    for m, cum in enumerate(cum_times, start=1):
        s0 = int(round(prev * FS))
        s1 = min(int(round(cum * FS)), len(flux))
        seg = flux[s0:s1]
        prev = cum
        if len(seg) < MIN_WIN_N:
            out.append(dict(m=m, n=len(seg), flux=None, median_full=None, iqr=None))
            continue
        q  = st.quantiles(seg, n=4)                   # q[0]=p25, q[1]=median, q[2]=p75
        pv = st.quantiles(seg, n=100)[PCTILE - 1]     # low percentile = settled resting plateau
        out.append(dict(
            m=m, n=len(seg),
            flux=round(pv, 1),                        # primary per-coordinate perfusion (spike-robust)
            median_full=round(q[1], 1),               # QC: spike-inflated whole-window median
            iqr=round(q[2] - q[0], 2),
        ))
    return out


# ── stats helpers ────────────────────────────────────────────────────────────
def rankdata(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    ranks = [0.0] * len(xs)
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def pearson(a, b):
    n = len(a)
    ma, mb = st.fmean(a), st.fmean(b)
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((x - mb) ** 2 for x in b) ** 0.5
    return num / (da * db) if da and db else float("nan")


def spearman(a, b):
    return pearson(rankdata(a), rankdata(b))


def grid_str(vals_by_cell, fmt="{:6.1f}"):
    """vals_by_cell: dict cell->value. Render 3x3 with layout [1 2 3 / 4 5 6 / 7 8 9]."""
    lines = []
    for r in range(3):
        cells = []
        for c in range(3):
            cell = r * 3 + c + 1
            v = vals_by_cell.get(cell)
            cells.append(fmt.format(v) if v is not None else "   -- ")
        lines.append("  " + " ".join(cells))
    return "\n".join(lines)


# ── main ─────────────────────────────────────────────────────────────────────
def process(name, cfg):
    myo = parse_myoton_file(ROOT / cfg["myoton"])
    fb = read_flux(ROOT / cfg["micro_before"])
    fa = read_flux(ROOT / cfg["micro_after"])

    seg_b = segment_flux(fb, myo["ts_before"])
    seg_a = segment_flux(fa, myo["ts_after"])

    # assemble per grid-cell records
    rec = {}   # cell -> dict
    for i, cell in enumerate(PATH):
        rec[cell] = dict(
            cell=cell, path_index=i + 1,
            flux_before=seg_b[i]["flux"], flux_after=seg_a[i]["flux"],
            flux_n_before=seg_b[i]["n"], flux_n_after=seg_a[i]["n"],
            stiff_before=myo["stiff_before"][i], stiff_after=myo["stiff_after"][i],
        )
        rec[cell]["flux_delta"]  = (rec[cell]["flux_after"] - rec[cell]["flux_before"]
                                    if None not in (rec[cell]["flux_after"], rec[cell]["flux_before"]) else None)
        rec[cell]["stiff_delta"] = rec[cell]["stiff_after"] - rec[cell]["stiff_before"]

    cells = sorted(rec)
    fbv = [rec[c]["flux_before"] for c in cells]
    fav = [rec[c]["flux_after"] for c in cells]
    sbv = [rec[c]["stiff_before"] for c in cells]
    sav = [rec[c]["stiff_after"] for c in cells]
    fdv = [rec[c]["flux_delta"] for c in cells]
    sdv = [rec[c]["stiff_delta"] for c in cells]

    # ── print report ──
    print("=" * 70)
    print(f"SUBJECT: {name.upper()}")
    print("=" * 70)
    hdr = f"{'cell':>4} {'path#':>5} {'flux_bef':>9} {'flux_aft':>9} {'Δflux':>8} {'stiff_bef':>9} {'stiff_aft':>9} {'Δstiff':>7} {'nB':>4} {'nA':>4}"
    print(hdr)
    for c in cells:
        r = rec[c]
        print(f"{r['cell']:>4} {r['path_index']:>5} "
              f"{r['flux_before']:>9.1f} {r['flux_after']:>9.1f} {r['flux_delta']:>+8.1f} "
              f"{r['stiff_before']:>9} {r['stiff_after']:>9} {r['stiff_delta']:>+7} "
              f"{r['flux_n_before']:>4} {r['flux_n_after']:>4}")

    print("\n-- group means across 9 sites --")
    print(f"  flux  : before {st.fmean(fbv):7.1f}   after {st.fmean(fav):7.1f}   Δ {st.fmean(fav)-st.fmean(fbv):+7.1f}  ({100*(st.fmean(fav)-st.fmean(fbv))/st.fmean(fbv):+.1f}%)")
    print(f"  stiff : before {st.fmean(sbv):7.1f}   after {st.fmean(sav):7.1f}   Δ {st.fmean(sav)-st.fmean(sbv):+7.1f}  ({100*(st.fmean(sav)-st.fmean(sbv))/st.fmean(sbv):+.1f}%)   (N/m)")

    print("\n-- spatial concordance (Spearman across 9 sites) --")
    print(f"  flux vs stiff  BEFORE : rho = {spearman(fbv, sbv):+.2f}")
    print(f"  flux vs stiff  AFTER  : rho = {spearman(fav, sav):+.2f}")
    print(f"  Δflux vs Δstiff       : rho = {spearman(fdv, sdv):+.2f}")

    print("\n-- flux Δ map (after-before) --");  print(grid_str({c: rec[c]['flux_delta'] for c in cells}))
    print("\n-- stiffness Δ map (N/m) --");       print(grid_str({c: rec[c]['stiff_delta'] for c in cells}, "{:6.0f}"))
    print()

    # ── write tidy CSV ──
    out_csv = ROOT / "analysis" / f"{name}_per_coordinate.csv"
    with open(out_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["subject", "grid_cell", "path_index",
                    "flux_before", "flux_after", "flux_delta",
                    "stiff_before_Nm", "stiff_after_Nm", "stiff_delta_Nm",
                    "flux_n_before", "flux_n_after", "temp_before_C", "temp_after_C"])
        for c in cells:
            r = rec[c]
            w.writerow([name, r["cell"], r["path_index"],
                        f"{r['flux_before']:.2f}", f"{r['flux_after']:.2f}", f"{r['flux_delta']:.2f}",
                        r["stiff_before"], r["stiff_after"], r["stiff_delta"],
                        r["flux_n_before"], r["flux_n_after"], "", ""])
    print(f"  -> wrote {out_csv.name}  (temp columns left blank for later)\n")


if __name__ == "__main__":
    for nm, cfg in SUBJECTS.items():
        process(nm, cfg)
