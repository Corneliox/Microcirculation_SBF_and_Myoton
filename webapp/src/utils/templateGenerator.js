/**
 * Excel Template Generator for Microcirculation (SBF) and Myoton 9-Point Grid.
 * Enables one-click downloading of standardized, publication-grade Excel templates
 * that support single-subject or multi-subject batch analysis.
 */

import * as XLSX from 'xlsx';
import { COMPASS_POINTS } from './excelParser';

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
 * Creates standardized Myoton 9-Point Compass Grid workbook
 */
export function createMyotonWorkbook(subjectNames = ['Subject 1 (Subject_A)', 'Subject 2 (Subject_B)']) {
  const wb = XLSX.utils.book_new();

  const headerRow0 = ['', '', '', '', '', '', '', '', '', 'T1', '', 'M1', ''];
  const headerRow1 = [
    '',
    'before1_30', 'after1_30',
    'before1_50', 'after1_50',
    'before1_100', 'after1_100',
    '', '',
    'before1_30', 'after1_30',
    'before1_30', 'after1_30'
  ];

  const allRows = [headerRow0, headerRow1];

  subjectNames.forEach((sTitle, sIdx) => {
    allRows.push([sTitle, '', '', '', '', '', '', '', '', '', '', '', '']);

    COMPASS_POINTS.forEach((cp) => {
      const baseStiff = 400 + cp.id * 8 + sIdx * 10;
      const row = [
        cp.id, // Point ID 1 to 9
        Number((baseStiff).toFixed(1)),
        Number((baseStiff - 35).toFixed(1)),
        Number((baseStiff + 20).toFixed(1)),
        Number((baseStiff - 15).toFixed(1)),
        Number((baseStiff + 10).toFixed(1)),
        Number((baseStiff - 20).toFixed(1)),
        '', '',
        Number((450 + cp.id * 5).toFixed(1)),
        Number((440 + cp.id * 5).toFixed(1)),
        Number((500 + cp.id * 6).toFixed(1)),
        Number((485 + cp.id * 6).toFixed(1))
      ];
      allRows.push(row);
    });
  });

  const wsData = XLSX.utils.aoa_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, wsData, 'myoton');

  // Compass Snake Grid Guide
  const guideRows = [
    ['MYOTONOMETER 9-POINT COMPASS GRID GUIDE ("SNAKE" RASTER SEQUENCE)'],
    ['========================================================================'],
    ['Row Sequence 1 through 9 for Each Subject:'],
    ['  1. North-West (NW) -> Matrix Row 1, Column 1 (Top-Left)'],
    ['  2. North (N)       -> Matrix Row 1, Column 2 (Top-Center)'],
    ['  3. North-East (NE) -> Matrix Row 1, Column 3 (Top-Right)'],
    ['  4. West (W)        -> Matrix Row 2, Column 1 (Center-Left)'],
    ['  5. Center (C)      -> Matrix Row 2, Column 2 (Grid Center)'],
    ['  6. East (E)        -> Matrix Row 2, Column 3 (Center-Right)'],
    ['  7. South-West (SW) -> Matrix Row 3, Column 1 (Bottom-Left)'],
    ['  8. South (S)       -> Matrix Row 3, Column 2 (Bottom-Center)'],
    ['  9. South-East (SE) -> Matrix Row 3, Column 3 (Bottom-Right)'],
    [''],
    ['Metric Unit: Dynamic Stiffness (N/m). Optional parameters: T1 and M1.']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Compass_Grid_Guide');

  return wb;
}

/**
 * Creates a unified workbook containing BOTH Microcirculation and Myoton sheets
 */
export function createUnifiedWorkbook(subjectNames = ['Subject_A', 'Subject_B']) {
  const wbMicro = createMicrocirculationWorkbook(subjectNames);
  const wbMyo = createMyotonWorkbook(subjectNames.map((n, i) => `Subject ${i + 1} (${n})`));

  const wbUnified = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbUnified, wbMicro.Sheets['SBF_Signal_Data'], 'Microcirculation_SBF');
  XLSX.utils.book_append_sheet(wbUnified, wbMyo.Sheets['myoton'], 'OCT_Myoton_9Point');
  XLSX.utils.book_append_sheet(wbUnified, wbMicro.Sheets['Format_Guide'], 'User_Guide');

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

export function downloadMyotonTemplate() {
  const wb = createMyotonWorkbook(['Subject 1 (Subject_1)', 'Subject 2 (Subject_2)', 'Subject 3 (Subject_3)']);
  downloadWorkbook(wb, 'Standard_Myoton_9Point_Grid_Template.xlsx');
}

export function downloadUnifiedTemplate() {
  const wb = createUnifiedWorkbook(['Subject_1', 'Subject_2', 'Subject_3']);
  downloadWorkbook(wb, 'Standard_Unified_SBF_and_Myoton_Template.xlsx');
}
