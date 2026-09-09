"""Characterize the Raihan before-flux cell-6 outlier: is it a plateau, a spike,
or a window-alignment artifact? Also detect the actual probe-move jumps and
compare them to the timestamp boundaries (validates the 40 Hz / t=0 assumption)."""
import statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FS = 40.0
PATH = [5, 2, 6, 8, 4, 3, 9, 7, 1]


def read_flux(p):
    out = []
    for ln in Path(p).read_text(errors="ignore").splitlines():
        t = ln.split()
        try:
            out.append(float(t[0]))
        except (ValueError, IndexError):
            pass
    return out


def cum_from_myoton(p, block):  # block 0=before,1=after
    import re
    rows = re.findall(r"^\s*\d{2}\s+(\d{2})\.(\d{2})\.(\d{2})", Path(p).read_text(), re.M)
    cums = [int(a) * 60 + int(b) + int(c) / 100 for a, b, c in rows]
    return cums[block * 9:(block + 1) * 9]


vals = read_flux(ROOT / "raihan/0701_Raihan - Before.txt")
cum = cum_from_myoton(ROOT / "raihan/Myoton + Micro RAIHAN.txt", 0)
print("total samples:", len(vals), " implied rec seconds:", round(len(vals) / FS, 1))
print("last coordinate ends at:", cum[-1], "s\n")

prev = 0.0
for m, c in enumerate(cum, 1):
    s0, s1 = int(round(prev * FS)), int(round(c * FS))
    seg = vals[s0:s1]
    prev = c
    print(f"win{m} cell{PATH[m-1]} [{s0}:{s1}] n={len(seg)} "
          f"min={min(seg):.0f} med={st.median(seg):.0f} max={max(seg):.0f}")

# raw trace of window 3 (the 450 plateau) every 6th sample
s0, s1 = int(round(cum[1] * FS)), int(round(cum[2] * FS))
print("\nwin3 raw (every 6th):", [round(x) for x in vals[s0:s1:6]])

# detect big jumps (probe moves): |Δ| over rolling to see where transitions are
print("\n-- large sample-to-sample jumps (|Δ|>40) with time(s) --")
jumps = [(round(i / FS, 2), round(vals[i] - vals[i-1]))
         for i in range(1, len(vals)) if abs(vals[i] - vals[i-1]) > 40]
print(f"count={len(jumps)} (expect ~8 coordinate moves)")
print("timestamp boundaries(s):", [round(x, 1) for x in cum[:-1]])
print("jump times(s):", [t for t, _ in jumps][:40])
