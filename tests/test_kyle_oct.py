"""
Unit test for KYLE OCT.xlsx Multi-Protocol Format Adapter
"""

import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.analyzer_cli import parse_myoton_excel

class TestKyleOCTAdapter(unittest.TestCase):

    def setUp(self):
        self.kyle_file = ROOT_DIR / "Example" / "Input_26_11_9" / "KYLE OCT.xlsx"
        self.old_file = ROOT_DIR / "Example" / "Input_Real_ICha" / "OCT_Myoton(R_R)(2).xlsx"

    def test_kyle_file_exists(self):
        self.assertTrue(self.kyle_file.exists(), f"KYLE OCT.xlsx missing at {self.kyle_file}")

    def test_parse_kyle_format(self):
        data = parse_myoton_excel(str(self.kyle_file))
        self.assertIn("KYLE", data)
        self.assertIn("ALL", data)
        kyle = data["KYLE"]

        self.assertTrue(kyle.get("isProtocolFormat"), "isProtocolFormat flag not set")
        self.assertEqual(len(kyle["protocols"]), 6, "Expected 6 protocols in KYLE OCT.xlsx")

        # Verify Protocol 1 (1 Hz, 30%, LEFT FOOT)
        p1 = kyle["protocols"][0]
        self.assertEqual(p1["protocolNum"], 1)
        self.assertEqual(p1["frequency"], "1Hz")
        self.assertEqual(p1["intensity"], "30%")
        self.assertIn("LEFT", p1["foot"].upper())

        # Verify Point 1 values for Protocol 1:
        # Before: [816, 814, 796] -> mean = 808.7, median (middle) = 814.0
        # After: [793, 826, 850] -> mean = 823.0, median (middle) = 826.0
        # Mean Delta = 823.0 - 808.7 = 14.3
        # Median Delta = 826.0 - 814.0 = 12.0
        pt1 = p1["points"][1]
        self.assertAlmostEqual(pt1["before"], 808.7, places=1)
        self.assertAlmostEqual(pt1["after"], 823.0, places=1)
        self.assertAlmostEqual(pt1["delta"], 14.3, places=1)
        self.assertAlmostEqual(pt1["meanBefore"], 808.7, places=1)
        self.assertAlmostEqual(pt1["meanAfter"], 823.0, places=1)
        self.assertAlmostEqual(pt1["medianBefore"], 814.0, places=1)
        self.assertAlmostEqual(pt1["medianAfter"], 826.0, places=1)
        self.assertAlmostEqual(pt1["medianDelta"], 12.0, places=1)
        self.assertEqual(pt1["triplicatesBefore"], [816.0, 814.0, 796.0])
        self.assertEqual(pt1["triplicatesAfter"], [793.0, 826.0, 850.0])

        # Verify standard points mapping has 9 compass points
        self.assertEqual(len(kyle["points"]), 9)
        for i in range(1, 10):
            self.assertIn(i, kyle["points"])
            self.assertIn("1Hz", kyle["points"][i]["frequencies"])
            self.assertIn("50Hz", kyle["points"][i]["frequencies"])

    def test_backward_compatibility_old_file(self):
        if self.old_file.exists():
            data = parse_myoton_excel(str(self.old_file))
            self.assertIn("Bas", data)
            self.assertIn("Cornel", data)
            self.assertIn("Reuben", data)
            self.assertEqual(len(data["Bas"]["points"]), 9)


if __name__ == "__main__":
    unittest.main()
