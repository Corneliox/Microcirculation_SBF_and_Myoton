import JSZip from 'jszip';
/**
 * Excel Template Generator for Microcirculation (SBF) and Myoton 9-Point Grid.
 * Enables one-click downloading of standardized, publication-grade Excel templates
 * that support single-subject or multi-subject batch analysis.
 */

import * as XLSX from 'xlsx';
import { COMPASS_POINTS } from './excelParser.js';

/**
 * Creates standardized Microcirculation SBF workbook with sample data and instructions
 */
export function createMicrocirculationWorkbook(subjectNames = ['Subject_A', 'Subject_B']) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Data: SBF_Signal_Data
  const row0 = []; // Subject names
  const row1 = []; // Frequencies
  const row2 = []; // Phase
  const row3 = []; // Channel

  const freqDefs = [
    { code: '1_30', name: '30Hz' },
    { code: '1_50', name: '50Hz' },
    { code: '1_100', name: '100Hz' }
  ];

  subjectNames.forEach((sName) => {
    // Each subject has 12 columns: 3 freq x 2 phase x 2 channels
    row0.push(sName);
    for (let i = 1; i < 12; i++) row0.push('');

    freqDefs.forEach((f) => {
      row1.push(f.code, '', '', '');
      row2.push('before', '', 'after', '');
      row3.push('Channel 1', 'Channel 2', 'Channel 1', 'Channel 2');
    });
  });

  const allRows = [row0, row1, row2, row3];

  // Generate 2670 realistic signal samples (~66.75s @ 40Hz)
  for (let r = 0; r < 2670; r++) {
    const row = [];
    const t = r / 40.0;
    subjectNames.forEach((_, sIdx) => {
      freqDefs.forEach((_, fIdx) => {
        // Before phase (baseline flux ~ 220-250 PU)
        const beVal = Number((230 + 15 * Math.sin(t * 0.8) + (Math.random() * 8 - 4) + sIdx * 5).toFixed(2));
        // After phase (stimulated flux ~ 130-180 PU)
        const afVal = Number((160 + 20 * Math.sin(t * 0.5) + (Math.random() * 8 - 4) - fIdx * 10).toFixed(2));
        row.push(beVal, beVal, afVal, afVal);
      });
    });
    allRows.push(row);
  }

  const wsData = XLSX.utils.aoa_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'SBF_Signal_Data');

  // 2. Guide Sheet / Instructions
  const guideRows = [
    ['STANDARDIZED MICROCIRCULATION (SBF) DATASET FORMAT GUIDE'],
    ['========================================================='],
    ['1. Column Structure per Subject (12 Columns per Subject):'],
    ['   - Columns 1-4: Frequency 30 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    ['   - Columns 5-8: Frequency 50 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    ['   - Columns 9-12: Frequency 100 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    [''],
    ['2. Signal Parameters:'],
    ['   - Default Sampling Frequency: 40 Hz (1 sample = 0.025 seconds / 25 milliseconds).'],
    ['   - Standard Sample Count: ~2670 rows per phase (~66.8 seconds total recording).'],
    ['   - Row 1: Subject Name (Fill in the first column of each 12-column block).'],
    ['   - Row 2: Frequency Codes (1_30, 1_50, 1_100).'],
    ['   - Row 3: Stimulation Phase (before, after).'],
    ['   - Row 4: Optical Channel (Channel 1, Channel 2).'],
    ['   - Row 5+: Numeric Perfusion Units (PU).'],
    [''],
    ['3. Adding Subjects (Single or Multiple Subjects Simultaneously):'],
    ['   - For 1 subject only: Use columns A through L (first 12 columns).'],
    ['   - For multiple subjects: Append subsequent 12-column blocks to the right (columns M, Y, etc.).'],
    ['   - The platform dynamically detects unlimited subjects and supports group-pooled ensemble analysis!']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Format_Guide');

  return wb;
}

/**
 * Creates standardized Myoton workbook in the new OCT Foot Measurement Record format
 * (matching NewFormat.xlsx / KYLE OCT.xlsx) with 6 clinical protocols and triplicate measurements.
 */
export function createMyotonWorkbook(participantInput = ['KYLE'], includeSampleData = false) {
  const wb = XLSX.utils.book_new();

  const participants = Array.isArray(participantInput) ? participantInput : [participantInput];

  // Benchmark template data based on KYLE OCT.xlsx / NewFormat.xlsx
  const PROTOCOL_DEFS = [
    {
      num: 1,
      freq: '1 Hz',
      intensity: '30%',
      foot: 'LEFT FOOT',
      dateLabel: 'Date for Protocols 1 & 2:',
      dateVal: '2026-11-02',
      samples: [
        [1, 816, 814, 796, 1, 793, 826, 850],
        [2, 605, 622, 601, 2, 624, 621, 634],
        [3, 507, 516, 521, 3, 498, 512, 537],
        [4, 803, 820, 769, 4, 818, 796, 832],
        [5, 657, 685, 674, 5, 714, 675, 719],
        [6, 536, 550, 562, 6, 603, 569, 619],
        [7, 611, 616, 585, 7, 664, 613, 631],
        [8, 630, 616, 648, 8, 616, 623, 610],
        [9, 602, 596, 609, 9, 604, 597, 602]
      ]
    },
    {
      num: 2,
      freq: '1 Hz',
      intensity: '50%',
      foot: 'RIGHT FOOT',
      dateLabel: null,
      dateVal: null,
      samples: [
        [1, 855, 844, 850, 1, 946, 908, 966],
        [2, 936, 952, 962, 2, 928, 894, 998],
        [3, 848, 824, 809, 3, 822, 831, 809],
        [4, 637, 621, 645, 4, 758, 731, 706],
        [5, 927, 941, 937, 5, 936, 926, 953],
        [6, 795, 784, 801, 6, 851, 822, 825],
        [7, 550, 563, 566, 7, 561, 630, 606],
        [8, 555, 599, 543, 8, 575, 583, 588],
        [9, 508, 569, 582, 9, 590, 594, 662]
      ]
    },
    {
      num: 3,
      freq: '1 Hz',
      intensity: '80%',
      foot: 'LEFT FOOT',
      dateLabel: 'Date for Protocols 3 & 4:',
      dateVal: '2026-11-03',
      samples: [
        [1, 687, 737, 731, 1, 774, 753, 769],
        [2, 625, 610, 629, 2, 594, 611, 606],
        [3, 561, 559, 569, 3, 543, 558, 555],
        [4, 730, 753, 738, 4, 755, 745, 749],
        [5, 701, 659, 699, 5, 655, 674, 677],
        [6, 584, 589, 598, 6, 610, 576, 588],
        [7, 669, 650, 703, 7, 692, 670, 627],
        [8, 631, 651, 659, 8, 647, 642, 696],
        [9, 523, 518, 523, 9, 571, 600, 617]
      ]
    },
    {
      num: 4,
      freq: '50 Hz',
      intensity: '30%',
      foot: 'RIGHT FOOT',
      dateLabel: null,
      dateVal: null,
      samples: [
        [1, 761, 768, 742, 1, 776, 770, 803],
        [2, 792, 712, 679, 2, 727, 663, 751],
        [3, 784, 807, 818, 3, 839, 795, 793],
        [4, 843, 869, 858, 4, 931, 915, 877],
        [5, 944, 950, 959, 5, 963, 950, 969],
        [6, 839, 880, 900, 6, 915, 980, 914],
        [7, 634, 659, 665, 7, 638, 532, 651],
        [8, 715, 695, 754, 8, 692, 688, 735],
        [9, 708, 723, 753, 9, 742, 749, 734]
      ]
    },
    {
      num: 5,
      freq: '50 Hz',
      intensity: '50%',
      foot: 'LEFT FOOT',
      dateLabel: 'Date for Protocols 5 & 6:',
      dateVal: '2026-11-04',
      samples: [
        [1, 616, 568, 576, 1, 602, 581, 634],
        [2, 478, 464, 490, 2, 502, 502, 506],
        [3, 484, 483, 511, 3, 485, 488, 489],
        [4, 628, 650, 696, 4, 769, 692, 678],
        [5, 537, 543, 572, 5, 558, 578, 557],
        [6, 541, 523, 530, 6, 582, 600, 557],
        [7, 687, 660, 700, 7, 747, 777, 787],
        [8, 580, 532, 576, 8, 610, 654, 620],
        [9, 514, 529, 502, 9, 602, 560, 565]
      ]
    },
    {
      num: 6,
      freq: '50 Hz',
      intensity: '80%',
      foot: 'RIGHT FOOT',
      dateLabel: null,
      dateVal: null,
      samples: [
        [1, 876, 862, 835, 1, 973, 836, 860],
        [2, 931, 981, 968, 2, 946, 929, 875],
        [3, 792, 787, 781, 3, 836, 806, 796],
        [4, 826, 813, 751, 4, 917, 915, 866],
        [5, 982, 942, 955, 5, 969, 964, 980],
        [6, 838, 912, 854, 6, 892, 853, 924],
        [7, 553, 620, 622, 7, 601, 612, 644],
        [8, 653, 653, 685, 8, 644, 626, 632],
        [9, 687, 674, 725, 9, 697, 687, 616]
      ]
    }
  ];

  participants.forEach((pRawName, pIdx) => {
    const cleanName = String(pRawName || `Participant_${pIdx + 1}`).trim();
    const sheetRows = [
      ['OCT FOOT MEASUREMENT RECORD', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      [`Participant :${cleanName}`, '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '']
    ];

    PROTOCOL_DEFS.forEach((pDef) => {
      if (pDef.dateLabel) {
        sheetRows.push([pDef.dateLabel, includeSampleData ? pDef.dateVal : '', '', '', '', '', '', '']);
      }
      sheetRows.push([`Protocol ${pDef.num} \u2013 Frequency: ${pDef.freq} \u2013 Intensity: ${pDef.intensity}`, '', '', '', '', '', '', '']);
      sheetRows.push([pDef.foot, '', '', '', '', '', '', '']);
      sheetRows.push(['BEFORE', '', '', '', 'AFTER', '', '', '']);
      sheetRows.push(['Entry', 'E1', 'E2', 'E3', 'Entry', 'E1', 'E2', 'E3']);

      if (includeSampleData) {
        pDef.samples.forEach((row) => sheetRows.push(row));
      } else {
        // Generate blank entry rows 1 to 9 matching NewFormat.xlsx
        for (let pt = 1; pt <= 9; pt++) {
          sheetRows.push([pt, '', '', '', pt, '', '', '']);
        }
      }

      sheetRows.push(['', '', '', '', '', '', '', '']);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    const sName = participants.length === 1 ? 'Sheet1' : cleanName.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sName);
  });

  // Comprehensive Guide Sheet
  const guideRows = [
    ['OCT FOOT MEASUREMENT RECORD - STANDARDIZED TEMPLATE GUIDE (NewFormat.xlsx)'],
    ['========================================================================'],
    ['1. File & Header Structure:'],
    ['   - Row 1: "OCT FOOT MEASUREMENT RECORD"'],
    ['   - Row 3: "Participant :[Participant_Name]"'],
    [''],
    ['2. Standard Protocol Matrix (6 Standardized Protocols):'],
    ['   - Protocol 1: Frequency 1 Hz, Intensity 30%, LEFT FOOT'],
    ['   - Protocol 2: Frequency 1 Hz, Intensity 50%, RIGHT FOOT'],
    ['   - Protocol 3: Frequency 1 Hz, Intensity 80%, LEFT FOOT'],
    ['   - Protocol 4: Frequency 50 Hz, Intensity 30%, RIGHT FOOT'],
    ['   - Protocol 5: Frequency 50 Hz, Intensity 50%, LEFT FOOT'],
    ['   - Protocol 6: Frequency 50 Hz, Intensity 80%, RIGHT FOOT'],
    [''],
    ['3. Triplicate Measurements (E1, E2, E3):'],
    ['   - Each entry (Points 1 to 9) records 3 rapid consecutive oscillations.'],
    ['   - Platform automatically computes Mean, Delta (After - Before), SD, and CV%.'],
    [''],
    ['4. 9-Point Compass Snake Raster Mapping:'],
    ['   - Entry 1: North-West (NW) -> Grid [Row 0, Col 0]'],
    ['   - Entry 2: North (N)       -> Grid [Row 0, Col 1]'],
    ['   - Entry 3: North-East (NE) -> Grid [Row 0, Col 2]'],
    ['   - Entry 4: West (W)        -> Grid [Row 1, Col 0]'],
    ['   - Entry 5: Center (C)      -> Grid [Row 1, Col 1]'],
    ['   - Entry 6: East (E)        -> Grid [Row 1, Col 2]'],
    ['   - Entry 7: South-West (SW) -> Grid [Row 2, Col 0]'],
    ['   - Entry 8: South (S)       -> Grid [Row 2, Col 1]'],
    ['   - Entry 9: South-East (SE) -> Grid [Row 2, Col 2]'],
    [''],
    ['5. Metric Units: Dynamic Stiffness. Baseline typically ranges 450 - 950.']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Format_Guide');

  return wb;
}

/**
 * Creates a unified workbook containing BOTH Microcirculation and Myoton sheets
 */
export function createUnifiedWorkbook(subjectNames = ['KYLE', 'Subject_B']) {
  const wbMicro = createMicrocirculationWorkbook(subjectNames);
  const wbMyo = createMyotonWorkbook(subjectNames, false);

  const wbUnified = XLSX.utils.book_new();
  // Append SBF sheet
  XLSX.utils.book_append_sheet(wbUnified, wbMicro.Sheets['SBF_Signal_Data'], 'Microcirculation_SBF');
  // Append OCT Myoton Sheet (Blank NewFormat structure)
  const myoSheetKey = wbMyo.SheetNames.find(n => n !== 'Format_Guide') || wbMyo.SheetNames[0];
  XLSX.utils.book_append_sheet(wbUnified, wbMyo.Sheets[myoSheetKey], 'OCT_Foot_Measurement');
  // Append Format Guide
  XLSX.utils.book_append_sheet(wbUnified, wbMyo.Sheets['Format_Guide'] || wbMicro.Sheets['Format_Guide'], 'Format_Guide');

  return wbUnified;
}

/**
 * Triggers client-side browser file download for an XLSX workbook
 */
export function downloadWorkbook(workbook, filename = 'Standard_Dataset_Template.xlsx') {
  try {
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    console.warn('XLSX.writeFile failed, using Blob fallback:', err);
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}

export function downloadMicrocirculationTemplate() {
  const wb = createMicrocirculationWorkbook(['Subject_1', 'Subject_2', 'Subject_3']);
  downloadWorkbook(wb, 'Standard_Microcirculation_SBF_Template.xlsx');
}

/**
 * Directly downloads the official blank NewFormat.xlsx file for Myoton data entry.
 * Preserves the exact Excel file structure, formatting, column widths, and blank cells.
 */
export async function downloadMyotonTemplate() {
  try {
    const baseUrl = import.meta.env.BASE_URL || './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    const res = await fetch(`${cleanBase}data/NewFormat.xlsx`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NewFormat.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      return;
    }
  } catch (err) {
    console.warn('Direct fetch of NewFormat.xlsx failed, falling back to dynamic generator:', err);
  }

  // Fallback programmatic generation if direct fetch is unavailable
  const wb = createMyotonWorkbook(['KYLE'], false);
  downloadWorkbook(wb, 'NewFormat.xlsx');
}

export function downloadUnifiedTemplate() {
  const wb = createUnifiedWorkbook(['KYLE', 'Subject_B']);
  downloadWorkbook(wb, 'Standard_Unified_SBF_and_Myoton_Template.xlsx');
}


/**
 * Computes 9-point discrete stiffness & spatial gradient statistics for a protocol
 */
export function computeJsProtocolStats(points, key = 'after') {
  const vals = [];
  const grid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let pIdx = 1; pIdx <= 9; pIdx++) {
    const cp = COMPASS_POINTS.find(c => c.id === pIdx);
    const pt = points[pIdx] || {};
    const v = parseFloat(pt[key] ?? pt.before ?? 0) || 0;
    vals.push(v);
    if (cp) grid[cp.row][cp.col] = v;
  }

  const sMax = Math.max(...vals);
  const sMin = Math.min(...vals);
  const sMean = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  const sSorted = vals.slice().sort((a, b) => a - b);
  const sMedian = Number(sSorted[Math.floor(vals.length / 2)].toFixed(1));

  // Spatial finite differences on 3x3 grid
  const mags = [];
  const dirs = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const gx = c === 0 ? (grid[r][1] - grid[r][0]) : c === 2 ? (grid[r][2] - grid[r][1]) : (grid[r][2] - grid[r][0]) * 0.5;
      const gy = r === 0 ? (grid[1][c] - grid[0][c]) : r === 2 ? (grid[2][c] - grid[1][c]) : (grid[2][c] - grid[0][c]) * 0.5;
      const m = Math.sqrt(gx * gx + gy * gy);
      mags.push(m);
      if (m > 0.05) {
        const deg = ((Math.atan2(gy, gx) * 180 / Math.PI) + 360) % 360;
        let dir = 'E';
        if (deg >= 22.5 && deg < 67.5) dir = 'NE';
        else if (deg >= 67.5 && deg < 112.5) dir = 'N';
        else if (deg >= 112.5 && deg < 157.5) dir = 'NW';
        else if (deg >= 157.5 && deg < 202.5) dir = 'W';
        else if (deg >= 202.5 && deg < 247.5) dir = 'SW';
        else if (deg >= 247.5 && deg < 292.5) dir = 'S';
        else if (deg >= 292.5 && deg < 337.5) dir = 'SE';
        dirs.push(dir);
      }
    }
  }

  const gMax = Number(Math.max(...mags).toFixed(1));
  const gMin = Number(Math.min(...mags).toFixed(1));
  const gMean = Number((mags.reduce((a, b) => a + b, 0) / mags.length).toFixed(1));
  const gSorted = mags.slice().sort((a, b) => a - b);
  const gMedian = Number(gSorted[Math.floor(mags.length / 2)].toFixed(1));

  const dirCounts = {};
  dirs.forEach(d => { dirCounts[d] = (dirCounts[d] || 0) + 1; });
  let modus = 'Uniform';
  let maxCount = 0;
  for (const d in dirCounts) {
    if (dirCounts[d] > maxCount) {
      maxCount = dirCounts[d];
      modus = d;
    }
  }

  return {
    stiffMax: sMax,
    stiffMin: sMin,
    stiffMean: sMean,
    stiffMedian: sMedian,
    gradMax: gMax,
    gradMin: gMin,
    gradMean: gMean,
    gradMedian: gMedian,
    directionModus: modus
  };
}

/**
 * Exports multiple participants' data directly into the exact FormatOutput.xlsx specification.
 */
/**
 * Creates the exact FormatOutput.xlsx workbook object with 3 multi-block sections:
 * 1. Stiffness Max, Min, Mean, Median After Therapy
 * 2. Stiffness Gradient Max, Min, Mean, Median After Therapy
 * 3. Stiffness Direction Modus After Therapy
 */
export function createFormatOutputWorkbook(participants) {
  const wb = XLSX.utils.book_new();

  // Create 60 empty rows with 33 columns
  const rows = [];
  for (let r = 0; r < 60; r++) {
    rows.push(new Array(33).fill(''));
  }

  // Row 2 (Index 1): Block 1 Headers
  rows[1][2] = 'Stiffness Max After Therapy';
  rows[1][10] = 'Stiffness Min After Therapy';
  rows[1][18] = 'Stiffness Mean After Therapy';
  rows[1][26] = 'Stiffness Median After Therapy';

  // Row 3 (Index 2): Column Sub-headers
  const protoHeaders = ['Subject', 'Protocol 1', 'Protocol 2', 'Protocol 3', 'Protocol 4', 'Protocol 5', 'Protocol 6'];
  for (let b = 0; b < 4; b++) {
    const colStart = 1 + b * 8;
    protoHeaders.forEach((h, hIdx) => {
      rows[2][colStart + hIdx] = h;
    });
  }

  // Row 22 (Index 21): Block 2 Headers
  rows[21][2] = 'Stiffness Gradient Max After Therapy';
  rows[21][10] = 'Stiffness Gradient Min After Therapy';
  rows[21][18] = 'Stiffness Gradient Mean After Therapy';
  rows[21][26] = 'Stiffness Gradient Median After Therapy';

  // Row 23 (Index 22): Column Sub-headers
  for (let b = 0; b < 4; b++) {
    const colStart = 1 + b * 8;
    protoHeaders.forEach((h, hIdx) => {
      rows[22][colStart + hIdx] = h;
    });
  }

  // Row 42 (Index 41): Block 3 Header
  rows[41][2] = 'Stiffness Direction mmodus After Therapy';

  // Row 43 (Index 42): Column Sub-headers
  protoHeaders.forEach((h, hIdx) => {
    rows[42][1 + hIdx] = h;
  });

  // Populate Participant Rows (Up to 15 subjects)
  participants.slice(0, 15).forEach((p, sIdx) => {
    const r1 = 3 + sIdx;  // row 4 is index 3
    const r2 = 23 + sIdx; // row 24 is index 23
    const r3 = 43 + sIdx; // row 44 is index 43
    const pName = p.name || `Subject_${sIdx + 1}`;

    // Fill Subject labels across all blocks
    for (let b = 0; b < 4; b++) {
      rows[r1][1 + b * 8] = pName;
      rows[r2][1 + b * 8] = pName;
    }
    rows[r3][1] = pName;

    // Fill Protocols 1 to 6
    const protocols = p.protocols || [];
    for (let protoNum = 1; protoNum <= 6; protoNum++) {
      const proto = protocols.find(pr => pr.protocolNum === protoNum);
      if (proto && proto.points) {
        const stats = computeJsProtocolStats(proto.points, 'after');
        // Block 1: Max, Min, Mean, Median
        rows[r1][1 + protoNum] = stats.stiffMax;
        rows[r1][9 + protoNum] = stats.stiffMin;
        rows[r1][17 + protoNum] = stats.stiffMean;
        rows[r1][25 + protoNum] = stats.stiffMedian;

        // Block 2: Grad Max, Min, Mean, Median
        rows[r2][1 + protoNum] = stats.gradMax;
        rows[r2][9 + protoNum] = stats.gradMin;
        rows[r2][17 + protoNum] = stats.gradMean;
        rows[r2][25 + protoNum] = stats.gradMedian;

        // Block 3: Direction Modus
        rows[r3][1 + protoNum] = stats.directionModus;
      }
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

/**
 * Downloads FormatOutput.xlsx directly
 */
export function exportFormatOutputWorkbook(participants, filename = 'FormatOutput.xlsx') {
  const wb = createFormatOutputWorkbook(participants);
  downloadWorkbook(wb, filename);
}

/**
 * Viridis colormap approximation for offscreen canvas
 */
function viridisCss(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * (0.267 + t * (0.005 + t * (2.78 - t * 2.05))));
  const g = Math.round(255 * (0.004 + t * (1.42 + t * (-0.35 - t * 0.07))));
  const b = Math.round(255 * (0.329 + t * (1.33 + t * (-2.68 + t * 1.34))));
  return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
}

/**
 * Renders an authentic Matplotlib-styled 3D surface plot on an offscreen canvas
 * returning data URL (PNG)
 */
export function renderOffscreen3DSurface(grid3x3, participantName, title, stageLabel, width = 720, height = 560) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const W = width;
  const H = height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const N = 31;
  const vals = grid3x3.flat();
  const zMin = Math.min(...vals);
  const zMax = Math.max(...vals);
  const zSpan = Math.max(10, zMax - zMin);
  const zBottom = zMin - zSpan * 0.40;
  const zTop = zMax + zSpan * 0.15;

  const Z = [];
  const GX = [];
  const GY = [];

  for (let i = 0; i < N; i++) {
    Z[i] = [];
    GX[i] = [];
    GY[i] = [];
    const u = (i / (N - 1)) * 2.0;
    const r0 = Math.floor(u);
    const r1 = Math.min(2, r0 + 1);
    const fr = u - r0;
    const wr = 0.5 - 0.5 * Math.cos(fr * Math.PI);

    for (let j = 0; j < N; j++) {
      const v = (j / (N - 1)) * 2.0;
      const c0 = Math.floor(v);
      const c1 = Math.min(2, c0 + 1);
      const fc = v - c0;
      const wc = 0.5 - 0.5 * Math.cos(fc * Math.PI);

      const v00 = grid3x3[r0][c0];
      const v01 = grid3x3[r0][c1];
      const v10 = grid3x3[r1][c0];
      const v11 = grid3x3[r1][c1];

      const top = v00 * (1 - wc) + v01 * wc;
      const bot = v10 * (1 - wc) + v11 * wc;
      Z[i][j] = top * (1 - wr) + bot * wr;
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const gx = j === 0 ? (Z[i][1] - Z[i][0]) : j === N - 1 ? (Z[i][N - 1] - Z[i][N - 2]) : (Z[i][j + 1] - Z[i][j - 1]) * 0.5;
      const gy = i === 0 ? (Z[1][j] - Z[0][j]) : i === N - 1 ? (Z[N - 1][j] - Z[N - 2][j]) : (Z[i + 1][j] - Z[i - 1][j]) * 0.5;
      GX[i][j] = gx;
      GY[i][j] = gy;
    }
  }

  const elev = (28.0 * Math.PI) / 180.0;
  const azim = (-55.0 * Math.PI) / 180.0;
  const cosAzim = Math.cos(azim);
  const sinAzim = Math.sin(azim);
  const cosElev = Math.cos(elev);
  const sinElev = Math.sin(elev);

  const cx = W * 0.44;
  const cy = H * 0.54;
  const scaleBox = Math.min(W, H) * 0.40;

  function project3D(x_cm, y_cm, z_val) {
    const xc = (x_cm - 5.0) / 5.0;
    const yc = (y_cm - 7.5) / 7.5;
    const zc = (z_val - (zBottom + zTop) * 0.5) / ((zTop - zBottom) * 0.5 || 1);

    const x1 = xc * cosAzim - yc * sinAzim;
    const y1 = xc * sinAzim + yc * cosAzim;
    const z1 = zc;

    const x2 = x1;
    const y2 = y1 * cosElev - z1 * sinElev;
    const z2 = y1 * sinElev + z1 * cosElev;

    const sx = cx + x2 * scaleBox * 1.35;
    const sy = cy - z2 * scaleBox * 1.15;
    return { sx, sy, depth: y2 };
  }

  // Draw Box
  const f00 = project3D(0, 0, zBottom);
  const f10 = project3D(10, 0, zBottom);
  const f11 = project3D(10, 15, zBottom);
  const f01 = project3D(0, 15, zBottom);
  const c00 = project3D(0, 0, zTop);
  const c10 = project3D(10, 0, zTop);
  const c11 = project3D(10, 15, zTop);
  const c01 = project3D(0, 15, zTop);

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(f00.sx, f00.sy);
  ctx.lineTo(f10.sx, f10.sy);
  ctx.lineTo(f11.sx, f11.sy);
  ctx.lineTo(f01.sx, f01.sy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(f01.sx, f01.sy);
  ctx.lineTo(f11.sx, f11.sy);
  ctx.lineTo(c11.sx, c11.sy);
  ctx.lineTo(c01.sx, c01.sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(f00.sx, f00.sy);
  ctx.lineTo(f01.sx, f01.sy);
  ctx.lineTo(c01.sx, c01.sy);
  ctx.lineTo(c00.sx, c00.sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bottom Quiver
  const qStep = 4;
  let maxMag = 0;
  for (let i = 2; i < N - 2; i += qStep) {
    for (let j = 2; j < N - 2; j += qStep) {
      const m = Math.sqrt(GX[i][j] ** 2 + GY[i][j] ** 2);
      if (m > maxMag) maxMag = m;
    }
  }
  maxMag = maxMag || 1.0;

  for (let i = 2; i < N - 2; i += qStep) {
    for (let j = 2; j < N - 2; j += qStep) {
      const x_cm = (j / (N - 1)) * 10.0;
      const y_cm = (i / (N - 1)) * 15.0;
      const gx = GX[i][j];
      const gy = GY[i][j];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > maxMag * 0.12) {
        const normUx = (gx / maxMag) * 1.1;
        const normUy = (gy / maxMag) * 1.5;
        const p0 = project3D(x_cm, y_cm, zBottom);
        const p1 = project3D(x_cm + normUx, y_cm + normUy, zBottom);
        ctx.strokeStyle = '#0055ff';
        ctx.fillStyle = '#0055ff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
      }
    }
  }

  // 3D Surface Mesh
  const quads = [];
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const x0 = (j / (N - 1)) * 10.0;
      const x1 = ((j + 1) / (N - 1)) * 10.0;
      const y0 = (i / (N - 1)) * 15.0;
      const y1 = ((i + 1) / (N - 1)) * 15.0;

      const z00 = Z[i][j];
      const z01 = Z[i][j + 1];
      const z10 = Z[i + 1][j];
      const z11 = Z[i + 1][j + 1];

      const avgZ = (z00 + z01 + z10 + z11) * 0.25;
      const p00 = project3D(x0, y0, z00);
      const p01 = project3D(x1, y0, z01);
      const p11 = project3D(x1, y1, z11);
      const p10 = project3D(x0, y1, z10);
      const avgDepth = (p00.depth + p01.depth + p11.depth + p10.depth) * 0.25;

      quads.push({
        p00, p01, p11, p10,
        avgDepth,
        tNorm: (avgZ - zMin) / (zSpan || 1)
      });
    }
  }

  quads.sort((a, b) => b.avgDepth - a.avgDepth);

  quads.forEach((q) => {
    ctx.fillStyle = viridisCss(q.tNorm);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(q.p00.sx, q.p00.sy);
    ctx.lineTo(q.p01.sx, q.p01.sy);
    ctx.lineTo(q.p11.sx, q.p11.sy);
    ctx.lineTo(q.p10.sx, q.p10.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Colorbar
  const cbX = W - 55;
  const cbY = 90;
  const cbW = 14;
  const cbH = H - 180;
  for (let y = 0; y < cbH; y++) {
    const tNorm = 1.0 - y / cbH;
    ctx.fillStyle = viridisCss(tNorm);
    ctx.fillRect(cbX, cbY + y, cbW, 1);
  }
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(cbX, cbY, cbW, cbH);

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`${participantName} • ${title}`, W * 0.44, 28);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`3D Plantar Tissue Stiffness Surface (${stageLabel})`, W * 0.44, 46);

  return canvas.toDataURL('image/png');
}

/**
 * Exports Full ZIP bundle containing FormatOutput.xlsx and all 3D Surface PNG plots
 */
export async function exportAllBundleZip(participants, filename = 'Myoton_Biomechanics_v3_Full_Export.zip') {
  const zip = new JSZip();

  // 1. Generate FormatOutput.xlsx
  const wb = createFormatOutputWorkbook(participants);
  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  zip.file('FormatOutput.xlsx', wbArray);

  // 2. Generate 3D Surface PNGs for each participant and protocol
  const surfacesFolder = zip.folder('3D_Surfaces');

  for (const p of participants) {
    const pName = p.name || 'Subject';
    const pFolder = surfacesFolder.folder(pName);

    const protocols = p.protocols || [];
    for (const proto of protocols) {
      const pNum = proto.protocolNum || 1;
      const pTitle = proto.name || `Protocol ${pNum}`;
      const pts = proto.points || {};

      const gridBe = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const gridAf = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

      for (let pIdx = 1; pIdx <= 9; pIdx++) {
        const cp = COMPASS_POINTS.find(c => c.id === pIdx);
        const pt = pts[pIdx] || {};
        const vBe = pt.meanBefore ?? pt.before ?? 0;
        const vAf = pt.meanAfter ?? pt.after ?? 0;
        if (cp) {
          gridBe[cp.row][cp.col] = vBe;
          gridAf[cp.row][cp.col] = vAf;
        }
      }

      const pngBe = renderOffscreen3DSurface(gridBe, pName, pTitle, 'Before Therapy');
      const pngAf = renderOffscreen3DSurface(gridAf, pName, pTitle, 'After Therapy');

      const b64Be = pngBe.replace(/^data:image\/png;base64,/, '');
      const b64Af = pngAf.replace(/^data:image\/png;base64,/, '');

      pFolder.file(`${pName}_Protocol_${pNum}_Before_3d_surface.png`, b64Be, { base64: true });
      pFolder.file(`${pName}_Protocol_${pNum}_After_3d_surface.png`, b64Af, { base64: true });
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
