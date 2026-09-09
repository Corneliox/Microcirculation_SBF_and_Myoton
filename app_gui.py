"""
Unified Biomedical Microcirculation & Myotonometer Desktop Application.
Supports:
  - Protocol A: Skin Blood Flow (SBF) frequency dynamics (50 Hz vs 100 Hz)
  - Protocol B: Multimodal 9-point plantar foot grid (Laser-Doppler flux + Myoton stiffness)
  - Protocol C: Statistical simulation & leave-one-out subject robustness testing
"""
import os, sys
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import numpy as np
import pandas as pd

# Add workspace directory to path
APP_DIR = Path(__file__).resolve().parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import customtkinter as ctk
import matplotlib
matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure

from core.sbf_core import SBFConfig, filter_signal
from core.sbf_horizontal import analyse_horizontal_file
from core.sbf_txt import analyse_txt_directory
from core.sbf_multimodal import process_multimodal_subject
from core.sbf_statistics import run_leave_one_out_simulation
from core.sbf_viz import (
    plot_group_curves_fig,
    plot_group_comparison_fig,
    plot_foot_grid_heatmap_fig,
    plot_multimodal_trace_qc_fig
)

# CustomTkinter setup
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")


class MicrocirculationApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Biomedical Microcirculation & Myotonometer Platform")
        self.geometry("1280x820")
        self.minsize(1100, 720)

        # Application state
        self.sbf_result = None
        self.multimodal_result = None
        self.mock_dir = APP_DIR / "mock_data"

        self._build_header()
        self._build_tabs()
        self._build_footer()

    # ──────────────────────────────────────────────────────────────────────────
    # UI Layout: Header & Tabs
    # ──────────────────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = ctk.CTkFrame(self, height=60, corner_radius=0)
        hdr.pack(fill="x", padx=0, pady=0)

        title_frame = ctk.CTkFrame(hdr, fg_color="transparent")
        title_frame.pack(side="left", padx=20, pady=10)

        lbl_title = ctk.CTkLabel(
            title_frame,
            text="🔬 Microcirculation & Tissue Biomechanics Analyzer",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        lbl_title.pack(anchor="w")

        lbl_sub = ctk.CTkLabel(
            title_frame,
            text="Laser-Doppler SBF Signal Processing • Myotonometer Stiffness • Plantar 9-Site Mapping",
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        lbl_sub.pack(anchor="w")

        # Theme toggle
        theme_frame = ctk.CTkFrame(hdr, fg_color="transparent")
        theme_frame.pack(side="right", padx=20, pady=10)

        self.theme_switch = ctk.CTkSwitch(
            theme_frame,
            text="Dark Mode",
            command=self._toggle_theme,
            onvalue="Dark", offvalue="Light"
        )
        self.theme_switch.select()
        self.theme_switch.pack()

    def _toggle_theme(self):
        mode = self.theme_switch.get()
        ctk.set_appearance_mode(mode)

    def _build_tabs(self):
        self.tabview = ctk.CTkTabview(self, corner_radius=8)
        self.tabview.pack(fill="both", expand=True, padx=15, pady=(10, 5))

        self.tab_sbf = self.tabview.add("📊 Protocol A: SBF Frequency Dynamics")
        self.tab_multi = self.tabview.add("🦶 Protocol B: Plantar Multimodal Grid")
        self.tab_stats = self.tabview.add("🧪 Protocol C: Robustness & Diagnostics")

        self._build_tab_sbf()
        self._build_tab_multimodal()
        self._build_tab_statistics()

    def _build_footer(self):
        ftr = ctk.CTkFrame(self, height=28, corner_radius=0)
        ftr.pack(fill="x", side="bottom")

        self.status_lbl = ctk.CTkLabel(
            ftr,
            text="Ready. Choose a protocol tab or load demo datasets to begin.",
            font=ctk.CTkFont(size=11),
            text_color="#8AB4F8"
        )
        self.status_lbl.pack(side="left", padx=20, pady=4)

    # ──────────────────────────────────────────────────────────────────────────
    # TAB 1: SBF Frequency Dynamics
    # ──────────────────────────────────────────────────────────────────────────
    def _build_tab_sbf(self):
        panes = ctk.CTkFrame(self.tab_sbf, fg_color="transparent")
        panes.pack(fill="both", expand=True, padx=5, pady=5)

        # Left control panel
        ctrl = ctk.CTkScrollableFrame(panes, width=360, corner_radius=8)
        ctrl.pack(side="left", fill="y", padx=(0, 10), pady=0)

        ctk.CTkLabel(ctrl, text="📁 Data Source", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", pady=(5, 5))

        self.sbf_input_path = ctk.StringVar(value="")
        entry_sbf = ctk.CTkEntry(ctrl, textvariable=self.sbf_input_path, placeholder_text="Path to Excel (.xlsx) or TXT folder")
        entry_sbf.pack(fill="x", pady=(0, 5))

        btn_row1 = ctk.CTkFrame(ctrl, fg_color="transparent")
        btn_row1.pack(fill="x", pady=2)
        ctk.CTkButton(btn_row1, text="Browse Excel", width=110, command=self._browse_sbf_excel).pack(side="left", padx=(0, 5))
        ctk.CTkButton(btn_row1, text="Browse TXT Dir", width=110, command=self._browse_sbf_txt).pack(side="left")

        ctk.CTkButton(
            ctrl,
            text="⚡ Load Demo Excel Dataset",
            fg_color="#2E7D32", hover_color="#1B5E20",
            command=self._load_demo_sbf_excel
        ).pack(fill="x", pady=(8, 15))

        # Parameters
        ctk.CTkLabel(ctrl, text="⚙️ DSP & Bucketing Settings", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", pady=(5, 5))

        p_frame = ctk.CTkFrame(ctrl)
        p_frame.pack(fill="x", pady=5, padx=0)

        # Sampling rate
        ctk.CTkLabel(p_frame, text="Sampling Rate (Hz):").grid(row=0, column=0, sticky="w", padx=10, pady=4)
        self.var_fs = ctk.StringVar(value="40.0")
        ctk.CTkEntry(p_frame, textvariable=self.var_fs, width=70).grid(row=0, column=1, sticky="e", padx=10, pady=4)

        # Bucket seconds
        ctk.CTkLabel(p_frame, text="Bucket Duration (s):").grid(row=1, column=0, sticky="w", padx=10, pady=4)
        self.var_bucket_sec = ctk.StringVar(value="30.0")
        ctk.CTkEntry(p_frame, textvariable=self.var_bucket_sec, width=70).grid(row=1, column=1, sticky="e", padx=10, pady=4)

        # Max buckets
        ctk.CTkLabel(p_frame, text="Max Buckets (e.g. 10 = 5min):").grid(row=2, column=0, sticky="w", padx=10, pady=4)
        self.var_max_buckets = ctk.StringVar(value="10")
        ctk.CTkEntry(p_frame, textvariable=self.var_max_buckets, width=70).grid(row=2, column=1, sticky="e", padx=10, pady=4)

        # Filter checkboxes
        self.var_hampel = ctk.BooleanVar(value=True)
        ctk.CTkCheckBox(ctrl, text="Use Hampel Filter (3σ Outliers)", variable=self.var_hampel).pack(anchor="w", pady=(8, 2))

        self.var_savgol = ctk.BooleanVar(value=True)
        ctk.CTkCheckBox(ctrl, text="Use Savitzky-Golay Smoothing", variable=self.var_savgol).pack(anchor="w", pady=2)

        self.var_lowpass = ctk.BooleanVar(value=False)
        ctk.CTkCheckBox(ctrl, text="Use Butterworth Lowpass (2.0 Hz)", variable=self.var_lowpass).pack(anchor="w", pady=2)

        # Execution buttons
        ctk.CTkButton(
            ctrl,
            text="▶ Run SBF Analysis",
            font=ctk.CTkFont(size=14, weight="bold"),
            height=38,
            command=self._run_sbf_analysis
        ).pack(fill="x", pady=(20, 8))

        ctk.CTkButton(
            ctrl,
            text="💾 Export Results to Excel",
            fg_color="#37474F", hover_color="#263238",
            command=self._export_sbf_excel
        ).pack(fill="x", pady=2)

        # Right display panel
        disp = ctk.CTkFrame(panes, corner_radius=8)
        disp.pack(side="right", fill="both", expand=True)

        disp_bar = ctk.CTkFrame(disp, height=40, fg_color="transparent")
        disp_bar.pack(fill="x", padx=10, pady=5)

        self.sbf_view_mode = ctk.CTkSegmentedButton(
            disp_bar,
            values=["Group Curves (50 vs 100 Hz)", "Paired Difference (p-values)", "Summary Data Table"],
            command=self._update_sbf_view
        )
        self.sbf_view_mode.set("Group Curves (50 vs 100 Hz)")
        self.sbf_view_mode.pack(side="left")

        self.sbf_plot_container = ctk.CTkFrame(disp)
        self.sbf_plot_container.pack(fill="both", expand=True, padx=10, pady=(0, 10))

    def _browse_sbf_excel(self):
        f = filedialog.askopenfilename(
            title="Select Microcirculation Excel File",
            filetypes=[("Excel Files", "*.xlsx *.xls"), ("All Files", "*.*")]
        )
        if f:
            self.sbf_input_path.set(f)

    def _browse_sbf_txt(self):
        d = filedialog.askdirectory(title="Select Folder with Raw SBF .txt Files")
        if d:
            self.sbf_input_path.set(d)

    def _load_demo_sbf_excel(self):
        p = self.mock_dir / "synthetic_horizontal_sbf.xlsx"
        if p.exists():
            self.sbf_input_path.set(str(p))
            self._run_sbf_analysis()
        else:
            messagebox.showwarning("Demo Data", "Demo file not found in mock_data/")

    def _run_sbf_analysis(self):
        path = self.sbf_input_path.get().strip()
        if not path or not os.path.exists(path):
            messagebox.showwarning("Input Error", "Please provide a valid Excel file or TXT directory.")
            return

        try:
            cfg = SBFConfig(
                sampling_rate_hz=float(self.var_fs.get()),
                bucket_seconds=float(self.var_bucket_sec.get()),
                use_hampel=self.var_hampel.get(),
                use_savgol=self.var_savgol.get(),
                use_lowpass=self.var_lowpass.get(),
            )
            max_b = int(self.var_max_buckets.get())

            self.status_lbl.configure(text=f"Analyzing {os.path.basename(path)}...", text_color="#FBC02D")
            self.update_idletasks()

            if os.path.isfile(path) and path.lower().endswith((".xlsx", ".xls")):
                self.sbf_result = analyse_horizontal_file(path, cfg=cfg, max_buckets=max_b)
            elif os.path.isdir(path):
                self.sbf_result = analyse_txt_directory(path, cfg=cfg, max_buckets=max_b)
            else:
                messagebox.showerror("Error", "Unsupported file format. Please choose an Excel workbook or directory.")
                return

            n_subj = len(self.sbf_result["persons"])
            self.status_lbl.configure(
                text=f"Analysis Complete! Parsed {n_subj} subjects, {len(self.sbf_result['per_cond'])} conditions.",
                text_color="#81C784"
            )
            self._update_sbf_view()

        except Exception as e:
            messagebox.showerror("Analysis Error", f"An error occurred during analysis:\n{str(e)}")
            self.status_lbl.configure(text=f"Error: {str(e)}", text_color="#E57373")

    def _update_sbf_view(self, choice=None):
        if not self.sbf_result:
            return

        for child in self.sbf_plot_container.winfo_children():
            child.destroy()

        mode = self.sbf_view_mode.get()
        if mode == "Group Curves (50 vs 100 Hz)":
            fig = plot_group_curves_fig(self.sbf_result["group_50"], self.sbf_result["group_100"])
            self._render_canvas(fig, self.sbf_plot_container)
        elif mode == "Paired Difference (p-values)":
            fig = plot_group_comparison_fig(self.sbf_result["comparison"])
            self._render_canvas(fig, self.sbf_plot_container)
        elif mode == "Summary Data Table":
            self._render_table_view(self.sbf_result["comparison"], self.sbf_plot_container)

    def _render_canvas(self, fig: Figure, container):
        canvas = FigureCanvasTkAgg(fig, master=container)
        canvas.draw()
        toolbar = NavigationToolbar2Tk(canvas, container)
        toolbar.update()
        canvas.get_tk_widget().pack(fill="both", expand=True)

    def _render_table_view(self, df: pd.DataFrame, container):
        frame = ctk.CTkFrame(container)
        frame.pack(fill="both", expand=True, padx=5, pady=5)

        cols = list(df.columns)
        tree = ttk.Treeview(frame, columns=cols, show="headings")
        for col in cols:
            tree.heading(col, text=col)
            tree.column(col, width=110, anchor="center")

        for _, row in df.iterrows():
            vals = [f"{v:.3f}" if isinstance(v, float) else str(v) for v in row]
            tree.insert("", "end", values=vals)

        vsb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

    def _export_sbf_excel(self):
        if not self.sbf_result:
            messagebox.showinfo("Export", "Please run analysis first.")
            return
        out_f = filedialog.asksaveasfilename(
            title="Save Results Excel File",
            defaultextension=".xlsx",
            filetypes=[("Excel Files", "*.xlsx")]
        )
        if out_f:
            with pd.ExcelWriter(out_f, engine="openpyxl") as writer:
                self.sbf_result["group_50"].to_excel(writer, sheet_name="Group_50Hz", index=False)
                self.sbf_result["group_100"].to_excel(writer, sheet_name="Group_100Hz", index=False)
                self.sbf_result["comparison"].to_excel(writer, sheet_name="Comparison_50vs100", index=False)
            messagebox.showinfo("Saved", f"Results successfully exported to:\n{out_f}")

    # ──────────────────────────────────────────────────────────────────────────
    # TAB 2: Multimodal Plantar Grid (Protocol B)
    # ──────────────────────────────────────────────────────────────────────────
    def _build_tab_multimodal(self):
        panes = ctk.CTkFrame(self.tab_multi, fg_color="transparent")
        panes.pack(fill="both", expand=True, padx=5, pady=5)

        ctrl = ctk.CTkScrollableFrame(panes, width=380, corner_radius=8)
        ctrl.pack(side="left", fill="y", padx=(0, 10), pady=0)

        ctk.CTkLabel(ctrl, text="👤 Patient / Subject Info", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", pady=(5, 5))
        self.var_multi_subject = ctk.StringVar(value="patient_01")
        ctk.CTkEntry(ctrl, textvariable=self.var_multi_subject).pack(fill="x", pady=(0, 10))

        ctk.CTkLabel(ctrl, text="📁 Raw Signal Files (9 Plantar Dwells)", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", pady=(5, 5))

        # Flux Before
        self.var_fb = ctk.StringVar(value="")
        ctk.CTkLabel(ctrl, text="Flux BEFORE txt:").pack(anchor="w")
        r1 = ctk.CTkFrame(ctrl, fg_color="transparent")
        r1.pack(fill="x", pady=2)
        ctk.CTkEntry(r1, textvariable=self.var_fb).pack(side="left", fill="x", expand=True, padx=(0, 5))
        ctk.CTkButton(r1, text="Browse", width=60, command=lambda: self._browse_file(self.var_fb)).pack(side="right")

        # Flux After
        self.var_fa = ctk.StringVar(value="")
        ctk.CTkLabel(ctrl, text="Flux AFTER txt:").pack(anchor="w", pady=(5, 0))
        r2 = ctk.CTkFrame(ctrl, fg_color="transparent")
        r2.pack(fill="x", pady=2)
        ctk.CTkEntry(r2, textvariable=self.var_fa).pack(side="left", fill="x", expand=True, padx=(0, 5))
        ctk.CTkButton(r2, text="Browse", width=60, command=lambda: self._browse_file(self.var_fa)).pack(side="right")

        # Myoton
        self.var_myo = ctk.StringVar(value="")
        ctk.CTkLabel(ctrl, text="Myoton Recording (Timestamps + Stiffness):").pack(anchor="w", pady=(5, 0))
        r3 = ctk.CTkFrame(ctrl, fg_color="transparent")
        r3.pack(fill="x", pady=2)
        ctk.CTkEntry(r3, textvariable=self.var_myo).pack(side="left", fill="x", expand=True, padx=(0, 5))
        ctk.CTkButton(r3, text="Browse", width=60, command=lambda: self._browse_file(self.var_myo)).pack(side="right")

        ctk.CTkButton(
            ctrl,
            text="⚡ Load Demo Plantar Grid Data",
            fg_color="#2E7D32", hover_color="#1B5E20",
            command=self._load_demo_multimodal
        ).pack(fill="x", pady=(12, 15))

        # Estimator Settings
        ctk.CTkLabel(ctrl, text="⚙️ Dwell Perfusion Estimator", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", pady=(5, 5))
        self.var_estimator = ctk.StringVar(value="p25")
        ctk.CTkOptionMenu(
            ctrl,
            variable=self.var_estimator,
            values=["p25", "median", "stable2s"]
        ).pack(fill="x", pady=(0, 15))

        ctk.CTkButton(
            ctrl,
            text="▶ Analyze Multimodal Grid",
            font=ctk.CTkFont(size=14, weight="bold"),
            height=38,
            command=self._run_multimodal_analysis
        ).pack(fill="x", pady=(10, 8))

        ctk.CTkButton(
            ctrl,
            text="💾 Export Coordinate CSV",
            fg_color="#37474F", hover_color="#263238",
            command=self._export_multimodal_csv
        ).pack(fill="x", pady=2)

        # Right display panel
        disp = ctk.CTkFrame(panes, corner_radius=8)
        disp.pack(side="right", fill="both", expand=True)

        disp_bar = ctk.CTkFrame(disp, height=40, fg_color="transparent")
        disp_bar.pack(fill="x", padx=10, pady=5)

        self.multi_view_mode = ctk.CTkSegmentedButton(
            disp_bar,
            values=["3x3 Foot Grid Heatmap", "Trace QC & Dwell Windows", "Per-Coordinate Stats"],
            command=self._update_multi_view
        )
        self.multi_view_mode.set("3x3 Foot Grid Heatmap")
        self.multi_view_mode.pack(side="left")

        # Concordance badge
        self.lbl_concordance = ctk.CTkLabel(disp_bar, text="", font=ctk.CTkFont(weight="bold"))
        self.lbl_concordance.pack(side="right", padx=10)

        self.multi_plot_container = ctk.CTkFrame(disp)
        self.multi_plot_container.pack(fill="both", expand=True, padx=10, pady=(0, 10))

    def _browse_file(self, target_var):
        f = filedialog.askopenfilename(filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")])
        if f:
            target_var.set(f)

    def _load_demo_multimodal(self):
        grid_dir = self.mock_dir / "synthetic_plantar_grid"
        fb = grid_dir / "demo_patient_flux_before.txt"
        fa = grid_dir / "demo_patient_flux_after.txt"
        myo = grid_dir / "demo_patient_myoton.txt"
        if fb.exists() and fa.exists() and myo.exists():
            self.var_multi_subject.set("demo_patient")
            self.var_fb.set(str(fb))
            self.var_fa.set(str(fa))
            self.var_myo.set(str(myo))
            self._run_multimodal_analysis()
        else:
            messagebox.showwarning("Demo Data", "Demo multimodal files missing in mock_data/synthetic_plantar_grid")

    def _run_multimodal_analysis(self):
        fb = self.var_fb.get()
        fa = self.var_fa.get()
        myo = self.var_myo.get()
        subj = self.var_multi_subject.get() or "subject"

        if not (os.path.exists(fb) and os.path.exists(fa) and os.path.exists(myo)):
            messagebox.showwarning("File Error", "Please provide all 3 required files (Flux Before, Flux After, Myoton).")
            return

        try:
            est = self.var_estimator.get()
            self.multimodal_result = process_multimodal_subject(
                subject_name=subj,
                flux_before_path=fb,
                flux_after_path=fa,
                myoton_path=myo,
                fs=40.0,
                estimator=est
            )
            rho = self.multimodal_result["correlations"]["delta_spearman"]
            self.lbl_concordance.configure(
                text=f"Spatial Concordance (ΔFlux vs ΔStiffness): Spearman ρ = {rho:+.2f}",
                text_color="#81C784"
            )
            self._update_multi_view()
            self.status_lbl.configure(text=f"Multimodal Analysis Complete for {subj}!", text_color="#81C784")
        except Exception as e:
            messagebox.showerror("Analysis Error", f"Failed to process multimodal files:\n{str(e)}")

    def _update_multi_view(self, choice=None):
        if not self.multimodal_result:
            return

        for child in self.multi_plot_container.winfo_children():
            child.destroy()

        mode = self.multi_view_mode.get()
        if mode == "3x3 Foot Grid Heatmap":
            fig = plot_foot_grid_heatmap_fig(self.multimodal_result)
            self._render_canvas(fig, self.multi_plot_container)
        elif mode == "Trace QC & Dwell Windows":
            fig = plot_multimodal_trace_qc_fig(
                self.multimodal_result["flux_after_raw"],
                self.multimodal_result["myoton"]["ts_after"],
                self.multimodal_result["seg_after"],
                title=f"{self.multimodal_result['subject']} — Post-Intervention Flux QC Trace"
            )
            self._render_canvas(fig, self.multi_plot_container)
        elif mode == "Per-Coordinate Stats":
            self._render_table_view(self.multimodal_result["summary_df"], self.multi_plot_container)

    def _export_multimodal_csv(self):
        if not self.multimodal_result:
            messagebox.showinfo("Export", "Please run multimodal analysis first.")
            return
        out_f = filedialog.asksaveasfilename(
            title="Save Per-Coordinate CSV",
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv")]
        )
        if out_f:
            self.multimodal_result["summary_df"].to_csv(out_f, index=False)
            messagebox.showinfo("Saved", f"Coordinate CSV saved to:\n{out_f}")

    # ──────────────────────────────────────────────────────────────────────────
    # TAB 3: Robustness Simulation & Outlier Diagnostics (Protocol C)
    # ──────────────────────────────────────────────────────────────────────────
    def _build_tab_statistics(self):
        panes = ctk.CTkFrame(self.tab_stats, fg_color="transparent")
        panes.pack(fill="both", expand=True, padx=5, pady=5)

        ctrl = ctk.CTkFrame(panes, width=350, corner_radius=8)
        ctrl.pack(side="left", fill="y", padx=(0, 10), pady=0)

        ctk.CTkLabel(ctrl, text="🧪 Robustness & Sensitivity Testing", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=(15, 5))
        ctk.CTkLabel(ctrl, text="Evaluates whether group findings are biased by any individual outlier subject (Jackknife simulation).",
                     wraplength=310, text_color="gray").pack(anchor="w", padx=15, pady=(0, 15))

        ctk.CTkLabel(ctrl, text="Target Frequency:").pack(anchor="w", padx=15)
        self.var_sim_freq = ctk.IntVar(value=50)
        ctk.CTkSegmentedButton(ctrl, values=["50 Hz", "100 Hz"],
                               command=lambda v: self.var_sim_freq.set(50 if "50" in v else 100)).pack(fill="x", padx=15, pady=(2, 10))

        ctk.CTkLabel(ctrl, text="Time Bucket Index (1 = 0-30s):").pack(anchor="w", padx=15)
        self.var_sim_bucket = ctk.StringVar(value="1")
        ctk.CTkEntry(ctrl, textvariable=self.var_sim_bucket).pack(fill="x", padx=15, pady=(2, 15))

        ctk.CTkButton(
            ctrl,
            text="▶ Run Leave-One-Out Simulation",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self._run_sim
        ).pack(fill="x", padx=15, pady=(10, 8))

        disp = ctk.CTkFrame(panes, corner_radius=8)
        disp.pack(side="right", fill="both", expand=True)

        ctk.CTkLabel(disp, text="Simulation Results Table", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=15, pady=10)
        self.sim_container = ctk.CTkFrame(disp)
        self.sim_container.pack(fill="both", expand=True, padx=15, pady=(0, 15))

    def _run_sim(self):
        if not self.sbf_result:
            messagebox.showinfo("Protocol A Required", "Please run Protocol A SBF Analysis first (or load demo Excel) to generate subject conditions.")
            return

        freq = self.var_sim_freq.get()
        b_idx = int(self.var_sim_bucket.get())
        sim_df = run_leave_one_out_simulation(self.sbf_result["per_cond"], freq=freq, bucket_idx=b_idx)

        for child in self.sim_container.winfo_children():
            child.destroy()

        if len(sim_df) == 0:
            ctk.CTkLabel(self.sim_container, text="Not enough subjects for leave-one-out simulation (need ≥ 4).").pack(pady=20)
            return

        self._render_table_view(sim_df, self.sim_container)
        self.status_lbl.configure(text="Leave-one-out robustness simulation finished.", text_color="#81C784")


if __name__ == "__main__":
    app = MicrocirculationApp()
    app.mainloop()
