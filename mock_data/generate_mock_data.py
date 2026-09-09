"""
Synthetic data generator for Microcirculation (SBF) & Myoton analysis.
Produces realistic datasets mimicking actual clinical acquisitions:
1. Horizontal Excel file with 50 Hz and 100 Hz Before/After recordings.
2. Multimodal Plantar Grid text files (Laser-Doppler flux + Myoton timestamps and stiffness).
"""
import os
from pathlib import Path
import numpy as np
import pandas as pd
from openpyxl import Workbook

MOCK_DIR = Path(__file__).resolve().parent
MOCK_DIR.mkdir(parents=True, exist_ok=True)


def generate_sbf_signal(duration_s: float = 300.0, fs: float = 40.0,
                        base_flux: float = 180.0, response_ratio: float = 0.35,
                        noise_std: float = 8.0, n_spikes: int = 5) -> np.ndarray:
    """Generates synthetic Laser-Doppler microcirculation signal with pulse wave & spikes."""
    n_samples = int(duration_s * fs)
    t = np.arange(n_samples) / fs

    # Vasodilation response curve (exponential rise to plateau)
    response = base_flux * (1.0 + response_ratio * (1.0 - np.exp(-t / 45.0)))

    # Cardiac pulsatile component (~1.1 Hz heart rate) + vasomotion (~0.1 Hz)
    pulsatile = 10.0 * np.sin(2 * np.pi * 1.1 * t) + 5.0 * np.sin(2 * np.pi * 0.1 * t)

    # Sensor noise
    noise = np.random.normal(0, noise_std, n_samples)
    sig = response + pulsatile + noise

    # Add occasional motion artifact spikes (probe movement)
    if n_spikes > 0:
        spike_indices = np.random.choice(np.arange(100, n_samples - 100), size=n_spikes, replace=False)
        for idx in spike_indices:
            sig[idx:idx + 3] += np.random.uniform(50.0, 120.0)

    return np.clip(sig, 10.0, None)


def create_mock_horizontal_excel(filename: str = "synthetic_horizontal_sbf.xlsx",
                                 n_subjects: int = 6,
                                 be_sec: float = 60.0,
                                 af_sec: float = 300.0,
                                 fs: float = 40.0):
    """Generates a horizontal-format Excel file with multiple subjects."""
    target_path = MOCK_DIR / filename
    wb = Workbook()
    ws = wb.active
    ws.title = "SBF_Study"

    # Row 1: Header
    # Structure: [Name] [50Hz] [be] [af] [100Hz] [be] [af] ...
    col_ptr = 1
    subject_names = [f"Subj_{i+1:02d}" for i in range(n_subjects)]

    for name in subject_names:
        ws.cell(row=1, column=col_ptr, value=name)
        ws.cell(row=1, column=col_ptr + 1, value="50Hz")
        ws.cell(row=1, column=col_ptr + 2, value="be")
        ws.cell(row=1, column=col_ptr + 3, value="af")
        ws.cell(row=1, column=col_ptr + 4, value="100Hz")
        ws.cell(row=1, column=col_ptr + 5, value="be")
        ws.cell(row=1, column=col_ptr + 6, value="af")

        # Generate signals
        base_level = np.random.uniform(160.0, 210.0)

        be_50 = generate_sbf_signal(duration_s=be_sec, fs=fs, base_flux=base_level, response_ratio=0.0, n_spikes=1)
        af_50 = generate_sbf_signal(duration_s=af_sec, fs=fs, base_flux=base_level, response_ratio=0.28, n_spikes=3)

        be_100 = generate_sbf_signal(duration_s=be_sec, fs=fs, base_flux=base_level, response_ratio=0.0, n_spikes=1)
        af_100 = generate_sbf_signal(duration_s=af_sec, fs=fs, base_flux=base_level, response_ratio=0.52, n_spikes=4)

        max_rows = max(len(be_50), len(af_50), len(be_100), len(af_100))
        for r in range(max_rows):
            excel_row = r + 2
            if r < len(be_50):
                ws.cell(row=excel_row, column=col_ptr + 2, value=round(float(be_50[r]), 2))
            if r < len(af_50):
                ws.cell(row=excel_row, column=col_ptr + 3, value=round(float(af_50[r]), 2))
            if r < len(be_100):
                ws.cell(row=excel_row, column=col_ptr + 5, value=round(float(be_100[r]), 2))
            if r < len(af_100):
                ws.cell(row=excel_row, column=col_ptr + 6, value=round(float(af_100[r]), 2))

        col_ptr += 7

    wb.save(target_path)
    print(f"Created synthetic horizontal Excel: {target_path}")
    return target_path


def create_mock_multimodal_dataset(subject_name: str = "demo_patient"):
    """Generates mock Before/After Laser-Doppler text files and Myoton timestamp file."""
    sub_dir = MOCK_DIR / "synthetic_plantar_grid"
    sub_dir.mkdir(parents=True, exist_ok=True)

    # 9 measurement dwells (~5.5s each, total ~50s)
    durations = [5.2, 5.5, 5.3, 5.1, 5.4, 5.6, 5.2, 5.3, 5.4]
    cums_bef = list(np.cumsum(durations))
    cums_aft = list(np.cumsum(durations))

    fs = 40.0
    total_samples = int(round((cums_bef[-1] + 2.0) * fs))

    # Base flux and stiffness for the 9 coordinates: [5, 2, 6, 8, 4, 3, 9, 7, 1]
    base_flux_per_site = [190, 150, 170, 220, 180, 160, 240, 210, 140]
    base_stiff_per_site = [380, 420, 390, 450, 410, 370, 480, 460, 350]

    # After intervention: flux increases (+20 to +60 PU), stiffness softens (-15 to -40 N/m)
    after_flux_per_site = [f + np.random.uniform(25, 60) for f in base_flux_per_site]
    after_stiff_per_site = [int(round(s - np.random.uniform(20, 45))) for s in base_stiff_per_site]

    # Generate flux traces
    flux_bef = []
    prev = 0.0
    for i, c in enumerate(cums_bef):
        n = int(round((c - prev) * fs))
        f_val = base_flux_per_site[i]
        seg = np.random.normal(f_val, 8.0, n)
        # Add probe placement spike at end
        if n > 5:
            seg[-3:] += np.random.uniform(60, 120)
        flux_bef.extend(seg)
        prev = c

    flux_aft = []
    prev = 0.0
    for i, c in enumerate(cums_aft):
        n = int(round((c - prev) * fs))
        f_val = after_flux_per_site[i]
        seg = np.random.normal(f_val, 9.0, n)
        if n > 5:
            seg[-3:] += np.random.uniform(60, 120)
        flux_aft.extend(seg)
        prev = c

    # Write Flux Before & After
    fb_path = sub_dir / f"{subject_name}_flux_before.txt"
    fa_path = sub_dir / f"{subject_name}_flux_after.txt"

    with open(fb_path, "w") as f:
        f.write("Time\tFlux_Ch1\n")
        for v in flux_bef:
            f.write(f"{v:.2f}\n")

    with open(fa_path, "w") as f:
        f.write("Time\tFlux_Ch1\n")
        for v in flux_aft:
            f.write(f"{v:.2f}\n")

    # Write Myoton file
    myo_path = sub_dir / f"{subject_name}_myoton.txt"
    with open(myo_path, "w") as f:
        f.write(f"# Myoton + Micro Recording for {subject_name}\n")
        f.write("Stiffness Before (N/m):\n")
        f.write(" - ".join(str(s) for s in base_stiff_per_site) + "\n")
        f.write("Stiffness After (N/m):\n")
        f.write(" - ".join(str(s) for s in after_stiff_per_site) + "\n\n")
        f.write("Timestamps (Before, then After):\n")
        # 9 before
        for idx, sec in enumerate(cums_bef, start=1):
            m = int(sec // 60)
            s = int(sec % 60)
            h = int(round((sec - int(sec)) * 100))
            f.write(f"  {idx:02d}   {m:02d}.{s:02d}.{h:02d}   00.00.00\n")
        # 9 after
        for idx, sec in enumerate(cums_aft, start=1):
            m = int(sec // 60)
            s = int(sec % 60)
            h = int(round((sec - int(sec)) * 100))
            f.write(f"  {idx:02d}   {m:02d}.{s:02d}.{h:02d}   00.00.00\n")

    print(f"Created synthetic multimodal files in: {sub_dir}")
    return fb_path, fa_path, myo_path


if __name__ == "__main__":
    create_mock_horizontal_excel()
    create_mock_multimodal_dataset()
