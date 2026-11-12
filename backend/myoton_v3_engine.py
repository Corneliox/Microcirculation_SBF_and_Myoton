"""
Myoton Biomechanics v3.0 Core Engine
------------------------------------
Capabilities:
1. Multi-Subject ingestion & validation taxonomy.
2. 3x3 Plantar spatial matrix bicubic spline interpolation.
3. Spatial gradient magnitude & directional compass modus calculation.
4. Export to exact FormatOutput.xlsx specification (and tidy tabular CSV).
5. Publication-grade 3D Surface mesh generation with bottom contour projection and quiver arrows.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional, Union
from collections import Counter

import numpy as np
import scipy.interpolate as interp
import pandas as pd
import openpyxl
import io
import base64
import zipfile
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# 9-point Compass layout mapping
# Row 0: 1=NW, 2=N, 3=NE
# Row 1: 4=W,  5=C, 6=E
# Row 2: 7=SW, 8=S, 9=SE
COMPASS_POINTS = [
    {"id": 1, "name": "North-West (NW)", "code": "NW", "row": 0, "col": 0},
    {"id": 2, "name": "North (N)", "code": "N", "row": 0, "col": 1},
    {"id": 3, "name": "North-East (NE)", "code": "NE", "row": 0, "col": 2},
    {"id": 4, "name": "West (W)", "code": "W", "row": 1, "col": 0},
    {"id": 5, "name": "Center (C)", "code": "C", "row": 1, "col": 1},
    {"id": 6, "name": "East (E)", "code": "E", "row": 1, "col": 2},
    {"id": 7, "name": "South-West (SW)", "code": "SW", "row": 2, "col": 0},
    {"id": 8, "name": "South (S)", "code": "S", "row": 2, "col": 1},
    {"id": 9, "name": "South-East (SE)", "code": "SE", "row": 2, "col": 2},
]

COMPASS_SECTORS = [
    ("E", 337.5, 360.0), ("E", 0.0, 22.5),
    ("NE", 22.5, 67.5),
    ("N", 67.5, 112.5),
    ("NW", 112.5, 157.5),
    ("W", 157.5, 202.5),
    ("SW", 202.5, 247.5),
    ("S", 247.5, 292.5),
    ("SE", 292.5, 337.5),
]


def angle_to_compass(deg: float) -> str:
    """Quantize angle in [0, 360) degrees into 8 compass directions."""
    deg = (deg % 360.0 + 360.0) % 360.0
    for sector, low, high in COMPASS_SECTORS:
        if low <= deg < high:
            return sector
    return "E"


def validate_oct_workbook(df_raw: pd.DataFrame) -> Dict[str, Any]:
    """
    Evaluates format integrity against comprehensive error taxonomy.
    """
    issues = []
    status = "VALID"

    # 1. Header check
    first_cells = [str(df_raw.iloc[r, 0]) for r in range(min(12, len(df_raw))) if pd.notna(df_raw.iloc[r, 0])]
    has_oct = any("OCT FOOT MEASUREMENT" in c or "Participant" in c or "Protocol" in c for c in first_cells)
    if not has_oct:
        return {
            "status": "ERROR",
            "code": "ERR_NO_OCT_HEADER",
            "message": "Header 'OCT FOOT MEASUREMENT' not found in first 10 rows.",
            "recommendation": "Use the official NewFormat.xlsx template.",
            "issues": ["Missing OCT Foot Measurement Header"]
        }

    # 2. Count protocols
    proto_rows = []
    for r in range(len(df_raw)):
        c0 = str(df_raw.iloc[r, 0]) if pd.notna(df_raw.iloc[r, 0]) else ""
        if c0.strip().lower().startswith("protocol"):
            proto_rows.append((r, c0.strip()))

    if len(proto_rows) == 0:
        return {
            "status": "ERROR",
            "code": "ERR_NO_PROTOCOLS",
            "message": "No protocol sections found.",
            "recommendation": "Ensure rows starting with 'Protocol 1' to 'Protocol 6' exist.",
            "issues": ["0 protocols identified"]
        }

    if len(proto_rows) < 6:
        status = "WARNING"
        issues.append(f"Expected 6 protocols, found {len(proto_rows)}.")

    return {
        "status": status,
        "code": "OK" if status == "VALID" else "WARN_PARTIAL",
        "protocolCount": len(proto_rows),
        "issues": issues,
        "recommendation": "Data is ready for analysis." if status == "VALID" else "Review missing protocols before publication."
    }


def parse_oct_participant_file(file_path: str) -> Dict[str, Any]:
    """
    Parses a single participant OCT Excel file into 6 clinical protocols.
    Computes both Mean and Median for Before & After triplicates.
    """
    xls = pd.ExcelFile(file_path)
    target_sheet = None
    for s_name in xls.sheet_names:
        df_probe = pd.read_excel(xls, sheet_name=s_name, header=None)
        val = validate_oct_workbook(df_probe)
        if val["status"] in ("VALID", "WARNING"):
            target_sheet = s_name
            break

    if not target_sheet:
        target_sheet = xls.sheet_names[0]

    df = pd.read_excel(xls, sheet_name=target_sheet, header=None)
    validation = validate_oct_workbook(df)

    participant_name = Path(file_path).stem.replace(" OCT", "").replace(".xlsx", "").strip()
    # Check for cell with Participant: ...
    for r in range(min(10, len(df))):
        c0 = str(df.iloc[r, 0]) if pd.notna(df.iloc[r, 0]) else ""
        if "participant" in c0.lower():
            m_part = re.search(r"participant:\s*([^\r\n]+)", c0, re.I)
            if m_part:
                participant_name = m_part.group(1).strip()
            elif df.shape[1] > 1 and pd.notna(df.iloc[r, 1]):
                participant_name = str(df.iloc[r, 1]).strip()

    protocols = []
    current_date = None

    for r in range(len(df)):
        c0 = str(df.iloc[r, 0]) if pd.notna(df.iloc[r, 0]) else ""
        if "date:" in c0.lower() and not current_date:
            m_date = re.search(r"date:\s*([^\r\n]+)", c0, re.I)
            if m_date:
                current_date = m_date.group(1).strip()

        if c0.strip().lower().startswith("protocol"):
            m_proto = re.search(r"protocol\s*(\d+)", c0, re.I)
            proto_num = int(m_proto.group(1)) if m_proto else len(protocols) + 1

            m_freq = re.search(r"frequency:\s*([\d.]+)\s*hz", c0, re.I)
            freq_str = (m_freq.group(1) + "Hz") if m_freq else "Unknown"

            m_int = re.search(r"intensity:\s*([\d.]+)%?", c0, re.I)
            int_str = (m_int.group(1) + "%") if m_int else "Unknown"

            next_row = df.iloc[r + 1, 0] if r + 1 < len(df) and pd.notna(df.iloc[r + 1, 0]) else ""
            foot_str = str(next_row).strip() if next_row else "Unknown Foot"

            points = {}
            for p_idx in range(1, 10):
                data_r = r + 3 + p_idx
                if data_r >= len(df):
                    continue

                e1_be = float(df.iloc[data_r, 1]) if pd.notna(df.iloc[data_r, 1]) else 0.0
                e2_be = float(df.iloc[data_r, 2]) if pd.notna(df.iloc[data_r, 2]) else 0.0
                e3_be = float(df.iloc[data_r, 3]) if pd.notna(df.iloc[data_r, 3]) else 0.0

                e1_af = float(df.iloc[data_r, 5]) if pd.notna(df.iloc[data_r, 5]) else 0.0
                e2_af = float(df.iloc[data_r, 6]) if pd.notna(df.iloc[data_r, 6]) else 0.0
                e3_af = float(df.iloc[data_r, 7]) if pd.notna(df.iloc[data_r, 7]) else 0.0

                be_arr = [e1_be, e2_be, e3_be]
                af_arr = [e1_af, e2_af, e3_af]

                # Mean
                m_be = round((e1_be + e2_be + e3_be) / 3.0, 1)
                m_af = round((e1_af + e2_af + e3_af) / 3.0, 1)
                d_mean = round(m_af - m_be, 1)

                # Median
                med_be = round(float(np.median(be_arr)), 1)
                med_af = round(float(np.median(af_arr)), 1)
                d_med = round(med_af - med_be, 1)

                points[p_idx] = {
                    "pointId": p_idx,
                    "compassName": COMPASS_POINTS[p_idx - 1]["name"],
                    "compassCode": COMPASS_POINTS[p_idx - 1]["code"],
                    "gridRow": COMPASS_POINTS[p_idx - 1]["row"],
                    "gridCol": COMPASS_POINTS[p_idx - 1]["col"],
                    "before": m_be,
                    "after": m_af,
                    "delta": d_mean,
                    "meanBefore": m_be,
                    "meanAfter": m_af,
                    "meanDelta": d_mean,
                    "medianBefore": med_be,
                    "medianAfter": med_af,
                    "medianDelta": d_med,
                    "triplicatesBefore": be_arr,
                    "triplicatesAfter": af_arr,
                }

            protocols.append({
                "protocolNum": proto_num,
                "name": f"Protocol {proto_num}: {freq_str} {int_str} ({foot_str})",
                "frequency": freq_str,
                "intensity": int_str,
                "foot": foot_str,
                "date": current_date,
                "points": points
            })

    return {
        "participant": participant_name,
        "filePath": file_path,
        "validation": validation,
        "date": current_date,
        "protocols": protocols
    }


def points_to_3x3_matrix(points: Dict[int, Dict[str, Any]], key: str = "after") -> np.ndarray:
    """Converts 9-point dictionary to 3x3 spatial numpy array."""
    mat = np.zeros((3, 3), dtype=float)
    for p_idx in range(1, 10):
        cp = COMPASS_POINTS[p_idx - 1]
        val = points.get(p_idx, {}).get(key, 0.0)
        mat[cp["row"], cp["col"]] = float(val)
    return mat


def compute_stiffness_and_gradient_stats(grid_3x3: np.ndarray, dense_res: int = 50) -> Dict[str, Any]:
    """
    Interpolates 3x3 grid to dense mesh, computes spatial gradient magnitude,
    and quantizes gradient vectors to determine directional modus.
    """
    x_nodes = np.array([0.0, 5.0, 10.0])
    y_nodes = np.array([0.0, 7.5, 15.0])

    x_dense = np.linspace(0.0, 10.0, dense_res)
    y_dense = np.linspace(0.0, 15.0, dense_res)
    X, Y = np.meshgrid(x_dense, y_dense)

    # Spline interpolation
    spline = interp.RectBivariateSpline(y_nodes, x_nodes, grid_3x3, kx=2, ky=2)
    Z = spline(y_dense, x_dense)

    # Numerical spatial gradients
    dy = y_dense[1] - y_dense[0]
    dx = x_dense[1] - x_dense[0]
    gy, gx = np.gradient(Z, dy, dx)
    mag = np.sqrt(gx**2 + gy**2)

    # Direction angle in degrees
    angle_deg = (np.degrees(np.arctan2(gy, gx)) + 360.0) % 360.0

    # Classify directions for points with significant gradient
    mag_threshold = float(np.mean(mag) * 0.25)
    valid_dirs = []
    for r in range(dense_res):
        for c in range(dense_res):
            if mag[r, c] > mag_threshold:
                valid_dirs.append(angle_to_compass(angle_deg[r, c]))

    if valid_dirs:
        counts = Counter(valid_dirs)
        direction_modus = counts.most_common(1)[0][0]
    else:
        direction_modus = "Uniform"

    # Discrete 9-point statistics
    pts_vals = grid_3x3.flatten()
    stiff_max = float(np.max(pts_vals))
    stiff_min = float(np.min(pts_vals))
    stiff_mean = float(np.mean(pts_vals))
    stiff_median = float(np.median(pts_vals))

    # Dense gradient magnitude statistics
    grad_max = float(np.max(mag))
    grad_min = float(np.min(mag))
    grad_mean = float(np.mean(mag))
    grad_median = float(np.median(mag))

    return {
        "stiffness_max": round(stiff_max, 1),
        "stiffness_min": round(stiff_min, 1),
        "stiffness_mean": round(stiff_mean, 1),
        "stiffness_median": round(stiff_median, 1),
        "gradient_max": round(grad_max, 1),
        "gradient_min": round(grad_min, 1),
        "gradient_mean": round(grad_mean, 1),
        "gradient_median": round(grad_median, 1),
        "direction_modus": direction_modus,
        "dense_X": X,
        "dense_Y": Y,
        "dense_Z": Z,
        "dense_gx": gx,
        "dense_gy": gy,
        "dense_mag": mag
    }


def render_myoton_3d_surface(
    grid_3x3: np.ndarray,
    out_path: Optional[Union[str, Path]] = None,
    title: str = "Protocol 1",
    stage_label: str = "After Therapy",
    participant_name: str = "Subject",
    return_b64: bool = True
) -> Dict[str, Any]:
    """
    Renders publication-grade 3D surface mesh with bottom plane contour lines
    and quiver arrows showing gradient vector flow (identical to ThermalSight style).
    Returns dict with file path and base64 encoded data URI.
    """
    grid_3x3 = np.asarray(grid_3x3, dtype=float)
    stats = compute_stiffness_and_gradient_stats(grid_3x3, dense_res=50)
    X = stats["dense_X"]
    Y = stats["dense_Y"]
    Z = stats["dense_Z"]
    gx = stats["dense_gx"]
    gy = stats["dense_gy"]

    x_nodes = np.array([0.0, 5.0, 10.0])
    y_nodes = np.array([0.0, 7.5, 15.0])

    z_min = float(np.min(Z))
    z_max = float(np.max(Z))
    z_span = max(0.5, z_max - z_min)
    z_bottom = z_min - z_span * 0.40

    fig = plt.figure(figsize=(9.5, 8.0), dpi=150, facecolor="white")
    ax = fig.add_subplot(111, projection="3d")
    ax.set_facecolor("white")

    # 1. 3D Surface Mesh
    surf = ax.plot_surface(
        X, Y, Z,
        cmap="viridis",
        edgecolor="black",
        linewidth=0.2,
        alpha=0.88,
        rstride=1,
        cstride=1
    )

    # 2. Bottom Plane Contours
    ax.contour(X, Y, Z, zdir="z", offset=z_bottom, cmap="viridis", levels=10, linewidths=1.0)

    # 3. Bottom Plane Quiver Vector Field
    step = 5
    y_idxs, x_idxs = np.mgrid[step//2:50:step, step//2:50:step]
    x_q = X[y_idxs, x_idxs].flatten()
    y_q = Y[y_idxs, x_idxs].flatten()
    z_q = np.full_like(x_q, z_bottom)
    u_q = gx[y_idxs, x_idxs].flatten()
    v_q = gy[y_idxs, x_idxs].flatten()
    w_q = np.zeros_like(x_q)

    mag_q = np.sqrt(u_q**2 + v_q**2)
    max_q = np.max(mag_q) or 1.0
    norm_u = np.where(mag_q > 0.001, (u_q / max_q) * 1.0, 0)
    norm_v = np.where(mag_q > 0.001, (v_q / max_q) * 1.5, 0)

    ax.quiver(
        x_q, y_q, z_q,
        norm_u, norm_v, w_q,
        color="#0055ff",
        length=0.8,
        arrow_length_ratio=0.35,
        linewidth=0.9
    )

    # 4. 9 Anatomical Compass Nodes on Surface
    compass_labels = [
        ("NW (P1)", 0, 0), ("N (P2)", 0, 1), ("NE (P3)", 0, 2),
        ("W (P4)", 1, 0),  ("C (P5)", 1, 1), ("E (P6)", 1, 2),
        ("SW (P7)", 2, 0), ("S (P8)", 2, 1), ("SE (P9)", 2, 2)
    ]
    for lbl, r, c in compass_labels:
        xn = x_nodes[c]
        yn = y_nodes[r]
        zn = grid_3x3[r, c]
        ax.scatter([xn], [yn], [zn], color="red", s=36, edgecolor="black", zorder=10)
        ax.text(xn, yn, zn + z_span * 0.045, f"{lbl}\n{zn:.0f}", fontsize=7.5, fontweight="bold", ha="center")

    ax.set_zlim(z_bottom, z_max + z_span * 0.15)
    ax.set_title(
        f"{participant_name} • {title}\n3D Plantar Tissue Stiffness Surface ({stage_label})",
        fontsize=11.5,
        fontweight="bold",
        pad=14
    )
    ax.set_xlabel("Plantar Width (cm) [Lateral - Medial]", fontsize=9, labelpad=8)
    ax.set_ylabel("Plantar Length (cm) [Posterior - Anterior]", fontsize=9, labelpad=8)
    ax.set_zlabel("Dynamic Stiffness", fontsize=9, labelpad=8)

    ax.view_init(elev=28, azim=-55)

    cbar = fig.colorbar(surf, ax=ax, shrink=0.55, aspect=14, pad=0.08)
    cbar.set_label("Dynamic Stiffness", fontsize=9)

    plt.tight_layout()

    saved_path = None
    if out_path:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(str(out_path), bbox_inches="tight")
        saved_path = str(out_path)

    b64_str = ""
    if return_b64:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        b64_raw = base64.b64encode(buf.getvalue()).decode("utf-8")
        b64_str = f"data:image/png;base64,{b64_raw}"
        buf.close()

    plt.close(fig)

    return {
        "status": "ok",
        "filepath": saved_path,
        "image_base64": b64_str
    }


def generate_format_output_excel(
    participants_data: List[Dict[str, Any]],
    output_excel_path: str,
    template_path: Optional[str] = None,
    output_csv_path: Optional[str] = None
) -> str:
    """
    Populates FormatOutput.xlsx with multiple subjects across 6 protocols.
    Fills in:
    - Block 1 (Rows 2-18): Stiffness Max, Min, Mean, Median After Therapy
    - Block 2 (Rows 22-38): Stiffness Gradient Max, Min, Mean, Median After Therapy
    - Block 3 (Rows 42-58): Stiffness Direction Modus After Therapy
    Also writes tidy CSV for downstream analytics.
    """
    # Resolve template path
    if not template_path or not os.path.exists(template_path):
        candidates = [
            r"D:\Download Move1\FormatOutput.xlsx",
            os.path.join(os.path.dirname(__file__), "..", "output_v3_demo", "FormatOutput_KYLE.xlsx"),
            os.path.join(os.path.dirname(__file__), "FormatOutput.xlsx")
        ]
        found = False
        for c in candidates:
            if os.path.exists(c):
                template_path = c
                found = True
                break
        if not found:
            # Create a blank workbook with headers if template is missing
            wb_new = openpyxl.Workbook()
            ws_new = wb_new.active
            ws_new.title = "Sheet1"
            # Block 1 headers
            ws_new.cell(2, 3).value = "Stiffness Max After Therapy"
            ws_new.cell(2, 11).value = "Stiffness Min After Therapy"
            ws_new.cell(2, 19).value = "Stiffness Mean After Therapy"
            ws_new.cell(2, 27).value = "Stiffness Median After Therapy"
            proto_hdrs = ["Subject", "Protocol 1", "Protocol 2", "Protocol 3", "Protocol 4", "Protocol 5", "Protocol 6"]
            for b in range(4):
                col_start = 2 + b * 8
                for h_idx, h in enumerate(proto_hdrs):
                    ws_new.cell(3, col_start + h_idx).value = h
            # Block 2 headers
            ws_new.cell(22, 3).value = "Stiffness Gradient Max After Therapy"
            ws_new.cell(22, 11).value = "Stiffness Gradient Min After Therapy"
            ws_new.cell(22, 19).value = "Stiffness Gradient Mean After Therapy"
            ws_new.cell(22, 27).value = "Stiffness Gradient Median After Therapy"
            for b in range(4):
                col_start = 2 + b * 8
                for h_idx, h in enumerate(proto_hdrs):
                    ws_new.cell(23, col_start + h_idx).value = h
            # Block 3 header
            ws_new.cell(42, 3).value = "Stiffness Direction mmodus After Therapy"
            for h_idx, h in enumerate(proto_hdrs):
                ws_new.cell(43, 2 + h_idx).value = h
            wb_new.save(output_excel_path)
            template_path = output_excel_path
    wb = openpyxl.load_workbook(template_path)
    sheet = wb["Sheet1"]

    tidy_rows = []

    for s_idx, p_data in enumerate(participants_data, start=1):
        subj_row = 3 + s_idx  # row 4 is Subject 1, row 5 is Subject 2...
        if subj_row > 18:
            break

        p_name = p_data.get("name") or p_data.get("participant", f"Subject_{s_idx}")
        protocols = p_data.get("protocols", [])

        # Set subject label
        sheet.cell(subj_row, 2).value = p_name
        sheet.cell(subj_row, 10).value = p_name
        sheet.cell(subj_row, 18).value = p_name
        sheet.cell(subj_row, 26).value = p_name

        grad_row = 23 + s_idx
        sheet.cell(grad_row, 2).value = p_name
        sheet.cell(grad_row, 10).value = p_name
        sheet.cell(grad_row, 18).value = p_name
        sheet.cell(grad_row, 26).value = p_name

        dir_row = 43 + s_idx
        sheet.cell(dir_row, 2).value = p_name

        for p_idx in range(1, 7):
            proto = next((p for p in protocols if p["protocolNum"] == p_idx), None)
            if proto:
                grid_after = points_to_3x3_matrix(proto["points"], key="after")
                stats = compute_stiffness_and_gradient_stats(grid_after)

                # Block 1: Stiffness
                sheet.cell(subj_row, 2 + p_idx).value = stats["stiffness_max"]
                sheet.cell(subj_row, 10 + p_idx).value = stats["stiffness_min"]
                sheet.cell(subj_row, 18 + p_idx).value = stats["stiffness_mean"]
                sheet.cell(subj_row, 26 + p_idx).value = stats["stiffness_median"]

                # Block 2: Gradient
                sheet.cell(grad_row, 2 + p_idx).value = stats["gradient_max"]
                sheet.cell(grad_row, 10 + p_idx).value = stats["gradient_min"]
                sheet.cell(grad_row, 18 + p_idx).value = stats["gradient_mean"]
                sheet.cell(grad_row, 26 + p_idx).value = stats["gradient_median"]

                # Block 3: Direction Modus
                sheet.cell(dir_row, 2 + p_idx).value = stats["direction_modus"]

                tidy_rows.append({
                    "Subject": p_name,
                    "ProtocolNum": p_idx,
                    "ProtocolName": proto.get("name", f"Protocol {p_idx}"),
                    "Frequency": proto.get("frequency", "Unknown"),
                    "Intensity": proto.get("intensity", "Unknown"),
                    "Foot": proto.get("foot", "Unknown"),
                    "Stiff_Max_After": stats["stiffness_max"],
                    "Stiff_Min_After": stats["stiffness_min"],
                    "Stiff_Mean_After": stats["stiffness_mean"],
                    "Stiff_Median_After": stats["stiffness_median"],
                    "Grad_Max_After": stats["gradient_max"],
                    "Grad_Min_After": stats["gradient_min"],
                    "Grad_Mean_After": stats["gradient_mean"],
                    "Grad_Median_After": stats["gradient_median"],
                    "Direction_Modus_After": stats["direction_modus"]
                })

    out_p = Path(output_excel_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(out_p))

    if output_csv_path and tidy_rows:
        df_tidy = pd.DataFrame(tidy_rows)
        csv_p = Path(output_csv_path)
        csv_p.parent.mkdir(parents=True, exist_ok=True)
        df_tidy.to_csv(str(csv_p), index=False)

    return str(out_p)
