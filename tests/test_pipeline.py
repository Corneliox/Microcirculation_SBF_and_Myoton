import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import unittest
import numpy as np
import pandas as pd

from core.sbf_core import SBFConfig, hampel_filter, filter_signal, flag_bucket_outliers, buckets_for_recording
from core.sbf_horizontal import analyse_horizontal_file
from core.sbf_multimodal import process_multimodal_subject, parse_myoton_text, read_flux_series
from core.sbf_statistics import run_anova, run_leave_one_out_simulation, run_paired_comparison
from core.sbf_viz import plot_group_curves_fig, plot_group_comparison_fig, plot_foot_grid_heatmap_fig

MOCK_DIR = Path(__file__).resolve().parent.parent / "mock_data"


class TestSBFCore(unittest.TestCase):

    def test_hampel_filter_spike_removal(self):
        """Verify Hampel filter correctly detects and suppresses isolated spikes."""
        sig = np.ones(100) * 150.0
        sig[25] = 400.0  # Large positive spike
        sig[70] = 380.0  # Second spike

        cleaned, mask = hampel_filter(sig, window_size=21, n_sigmas=3.0)
        self.assertTrue(mask[25], "Hampel failed to detect spike at index 25")
        self.assertTrue(mask[70], "Hampel failed to detect spike at index 70")
        self.assertAlmostEqual(cleaned[25], 150.0, delta=1.0)
        self.assertAlmostEqual(cleaned[70], 150.0, delta=1.0)

    def test_buckets_for_recording(self):
        """Verify 30s bucket calculation at 40 Hz generates correct bucket count and metrics."""
        cfg = SBFConfig(sampling_rate_hz=40.0, bucket_seconds=30.0)
        # 120 seconds of signal = 4 full 30s buckets
        n_samples = int(120 * cfg.sampling_rate_hz)
        af_sig = np.ones(n_samples) * 200.0
        baseline_mean = 100.0

        b_df = buckets_for_recording(af_sig, baseline_mean=baseline_mean, cfg=cfg)
        self.assertEqual(len(b_df), 4)
        # Expected change % = (200 - 100)/100 * 100% = +100%
        for _, row in b_df.iterrows():
            self.assertAlmostEqual(row["change_pct"], 100.0, delta=0.01)
            self.assertEqual(row["n_samples"], 1200)


class TestSBFHorizontal(unittest.TestCase):

    def test_analyse_horizontal_file(self):
        """Verify horizontal Excel file parsing, filtering, and statistical comparison."""
        excel_path = MOCK_DIR / "synthetic_horizontal_sbf.xlsx"
        self.assertTrue(excel_path.exists(), f"Mock Excel missing at {excel_path}")

        cfg = SBFConfig(sampling_rate_hz=40.0, bucket_seconds=30.0)
        result = analyse_horizontal_file(excel_path, cfg=cfg, max_buckets=10)

        self.assertIn("per_cond", result)
        self.assertIn("group_50", result)
        self.assertIn("group_100", result)
        self.assertIn("comparison", result)

        self.assertEqual(len(result["persons"]), 6)
        self.assertEqual(len(result["per_cond"]), 12)  # 6 subjects x 2 freqs

        # Group 100 Hz should show higher vasodilation than 50 Hz in synthetic data
        g50 = result["group_50"]
        g100 = result["group_100"]
        self.assertGreater(g100["group_mean_change_pct"].iloc[-1], g50["group_mean_change_pct"].iloc[-1])


class TestSBFMultimodal(unittest.TestCase):

    def test_process_multimodal_subject(self):
        """Verify 9-point plantar foot grid segmentation and correlation."""
        grid_dir = MOCK_DIR / "synthetic_plantar_grid"
        fb_path = grid_dir / "demo_patient_flux_before.txt"
        fa_path = grid_dir / "demo_patient_flux_after.txt"
        myo_path = grid_dir / "demo_patient_myoton.txt"

        self.assertTrue(fb_path.exists())
        self.assertTrue(fa_path.exists())
        self.assertTrue(myo_path.exists())

        res = process_multimodal_subject("demo_patient", fb_path, fa_path, myo_path, fs=40.0)
        self.assertEqual(len(res["grid_dict"]), 9)
        self.assertIn("correlations", res)
        self.assertIn("group_means", res)

        # Verify all 9 cells have valid entries
        for cell_id in range(1, 10):
            self.assertIn(cell_id, res["grid_dict"])
            cell_data = res["grid_dict"][cell_id]
            self.assertFalse(np.isnan(cell_data["flux_before"]))
            self.assertFalse(np.isnan(cell_data["flux_after"]))


class TestSBFViz(unittest.TestCase):

    def test_figures_build_cleanly(self):
        """Verify figures instantiate properly without GUI dependencies."""
        excel_path = MOCK_DIR / "synthetic_horizontal_sbf.xlsx"
        cfg = SBFConfig(sampling_rate_hz=40.0, bucket_seconds=30.0)
        res_horiz = analyse_horizontal_file(excel_path, cfg=cfg, max_buckets=10)

        fig1 = plot_group_curves_fig(res_horiz["group_50"], res_horiz["group_100"])
        self.assertIsNotNone(fig1)

        fig2 = plot_group_comparison_fig(res_horiz["comparison"])
        self.assertIsNotNone(fig2)

        grid_dir = MOCK_DIR / "synthetic_plantar_grid"
        res_multi = process_multimodal_subject("demo_patient",
                                               grid_dir / "demo_patient_flux_before.txt",
                                               grid_dir / "demo_patient_flux_after.txt",
                                               grid_dir / "demo_patient_myoton.txt")
        fig3 = plot_foot_grid_heatmap_fig(res_multi)
        self.assertIsNotNone(fig3)


if __name__ == "__main__":
    unittest.main()
