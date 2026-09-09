from pathlib import Path
import statistics as st

ROOT = Path(__file__).resolve().parent.parent
p = ROOT / "raihan" / "0701_Raihan - Before.txt"
vals = []
for ln in p.read_text(errors="ignore").splitlines():
    t = ln.split()
    try:
        vals.append(float(t[0]))
    except (ValueError, IndexError):
        pass

FS = 40.0
cum = [7.17, 12.28, 17.71, 22.80, 27.90, 32.90, 37.93, 43.09, 48.15]
cells = [5, 2, 6, 8, 4, 3, 9, 7, 1]
print("total samples:", len(vals))
prev = 0.0
for m, c in enumerate(cum, 1):
    s0 = int(round(prev * FS)); s1 = int(round(c * FS)); seg = vals[s0:s1]; prev = c
    print(f"win{m} (cell {cells[m-1]}) samp[{s0}:{s1}] n={len(seg)} "
          f"min={min(seg):.0f} med={st.median(seg):.0f} max={max(seg):.0f}")

s0 = int(round(12.28 * FS)); s1 = int(round(17.71 * FS))
print("\nwindow3 raw every 8th sample:", [round(x) for x in vals[s0:s1:8]])
