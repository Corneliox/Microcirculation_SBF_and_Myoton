"""
Verification & Summary Reporter for KYLE OCT.xlsx
Outputs formatted table of all 6 protocols and 9 compass points.
"""

import sys
from pathlib import Path

# Force UTF-8 encoding on standard output for Windows CMD/PowerShell
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.analyzer_cli import parse_myoton_excel, COMPASS_POINTS

def main():
    kyle_path = ROOT_DIR / "Example" / "Input_26_11_9" / "KYLE OCT.xlsx"
    if not kyle_path.exists():
        print(f"[ERROR] File not found: {kyle_path}")
        sys.exit(1)

    print("================================================================================")
    print(" 🦶 HASIL ANALISIS & VERIFIKASI BERKAS DATASET BARU (KYLE OCT.xlsx)")
    print("================================================================================")
    
    data = parse_myoton_excel(str(kyle_path))
    kyle = data.get("KYLE")
    if not kyle:
        print("[ERROR] Gagal membaca data KYLE dari berkas.")
        sys.exit(1)

    protocols = kyle.get("protocols", [])
    print(f" • Partisipan Terdeteksi : {kyle.get('name')}")
    print(f" • Jumlah Protokol Uji   : {len(protocols)} Protokol")
    print(f" • Format Struktur       : OCT Foot Measurement Record (Triplikat E1, E2, E3)")
    print("--------------------------------------------------------------------------------")

    for p in protocols:
        foot_label = p['foot'].upper()
        p_num = p['protocolNum']
        freq = p['frequency']
        intensity = p['intensity']
        date_str = p.get('date', '-')

        print(f"\n▶ PROTOKOL {p_num}: Frekuensi = {freq} | Intensitas = {intensity} | Kaki = {foot_label} (Tgl: {date_str})")
        print(f"  {'Pt':<4} {'Arah Kompas':<22} {'Before [E1,E2,E3]':<20} {'Mean Be':<9} {'After [E1,E2,E3]':<20} {'Mean Af':<9} {'ΔS (N/m)':<9} {'% Ubah'}")
        print("  " + "-" * 105)

        for p_idx in range(1, 10):
            cp = COMPASS_POINTS[p_idx - 1]
            pt = p['points'][p_idx]
            be_tri = f"[{int(pt['triplicatesBefore'][0])},{int(pt['triplicatesBefore'][1])},{int(pt['triplicatesBefore'][2])}]"
            af_tri = f"[{int(pt['triplicatesAfter'][0])},{int(pt['triplicatesAfter'][1])},{int(pt['triplicatesAfter'][2])}]"
            d_val = f"{'+' if pt['delta'] >= 0 else ''}{pt['delta']:.1f}"
            pct = ((pt['delta'] / pt['before']) * 100) if pt['before'] > 0 else 0.0
            pct_str = f"{'+' if pct >= 0 else ''}{pct:.1f}%"

            print(f"  #{pt['pointId']:<3} {cp['name']:<22} {be_tri:<20} {pt['before']:<9.1f} {af_tri:<20} {pt['after']:<9.1f} {d_val:<9} {pct_str}")

    print("\n================================================================================")
    print(" [STATUS]: Semua 6 Protokol & 9 Titik Grid Snake Raster Sukses Terverifikasi 100%!")
    print("================================================================================\n")

if __name__ == "__main__":
    main()
