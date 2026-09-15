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
export function createMicrocirculationWorkbook(subjectNames = ['Subjek_A', 'Subjek_B']) {
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

  // 2. Sheet Panduan / Instructions
  const guideRows = [
    ['PANDUAN FORMAT DATASET STANDAR MICROCIRCULATION (SBF)'],
    ['========================================================='],
    ['1. Struktur Kolom per Subjek (12 Kolom per Subjek):'],
    ['   - Kolom 1-4: Frekuensi 30 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    ['   - Kolom 5-8: Frekuensi 50 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    ['   - Kolom 9-12: Frekuensi 100 Hz (Channel 1-2 Before, Channel 1-2 After)'],
    [''],
    ['2. Parameter Sinyal:'],
    ['   - Laju Sampling Default: 40 Hz (1 data = 0.025 detik / 25 milidetik).'],
    ['   - Jumlah Baris Standar: ~2670 baris per fase (~66.8 detik total pencatatan).'],
    ['   - Baris 1: Nama Subjek (Cukup isi di kolom awal tiap blok 12 kolom).'],
    ['   - Baris 2: Frekuensi (1_30, 1_50, 1_100).'],
    ['   - Baris 3: Fase stimulasi (before, after).'],
    ['   - Baris 4: Saluran optik (Channel 1, Channel 2).'],
    ['   - Baris 5+: Nilai numerik Perfusion Units (PU).'],
    [''],
    ['3. Menambah Subjek (Single atau Banyak Subjek Bersamaan):'],
    ['   - Untuk 1 subjek saja: Gunakan kolom A sampai L (12 kolom pertama).'],
    ['   - Untuk banyak subjek: Tambahkan blok 12 kolom berikutnya di sebelah kanan (kolom M, dst).'],
    ['   - Aplikasi otomatis mendeteksi jumlah subjek secara dinamis tanpa batas maksimal!']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Format');

  return wb;
}

/**
 * Creates standardized Myoton 9-Point Compass Grid workbook
 */
export function createMyotonWorkbook(subjectNames = ['Subject 1 (Subjek_A)', 'Subject 2 (Subjek_B)']) {
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

  // Panduan Orientasi Kompas Ular (Snake Order)
  const guideRows = [
    ['PANDUAN ORIENTASI GRID KOMPAS 9 TITIK MYOTONOMETER ("SEPERTI ULAR")'],
    ['========================================================================'],
    ['Urutan Baris 1 s/d 9 untuk Tiap Subjek:'],
    ['  1. Barat Laut (NW) -> Koordinat Matriks Baris 1, Kolom 1 (Kiri Atas)'],
    ['  2. Utara (N)       -> Koordinat Matriks Baris 1, Kolom 2 (Tengah Atas)'],
    ['  3. Timur Laut (NE) -> Koordinat Matriks Baris 1, Kolom 3 (Kanan Atas)'],
    ['  4. Barat (W)       -> Koordinat Matriks Baris 2, Kolom 1 (Kiri Tengah)'],
    ['  5. Tengah (C)      -> Koordinat Matriks Baris 2, Kolom 2 (Pusat Grid)'],
    ['  6. Timur (E)       -> Koordinat Matriks Baris 2, Kolom 3 (Kanan Tengah)'],
    ['  7. Barat Daya (SW) -> Koordinat Matriks Baris 3, Kolom 1 (Kiri Bawah)'],
    ['  8. Selatan (S)     -> Koordinat Matriks Baris 3, Kolom 2 (Tengah Bawah)'],
    ['  9. Tenggara (SE)   -> Koordinat Matriks Baris 3, Kolom 3 (Kanan Bawah)'],
    [''],
    ['Satuan Nilai: Dynamic Stiffness (N/m). Parameter opsional: T1 dan M1.']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Grid_Kompas');

  return wb;
}

/**
 * Creates a unified workbook containing BOTH Microcirculation and Myoton sheets
 */
export function createUnifiedWorkbook(subjectNames = ['Subjek_A', 'Subjek_B']) {
  const wbMicro = createMicrocirculationWorkbook(subjectNames);
  const wbMyo = createMyotonWorkbook(subjectNames.map((n, i) => `Subject ${i + 1} (${n})`));

  const wbUnified = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbUnified, wbMicro.Sheets['SBF_Signal_Data'], 'Microcirculation_SBF');
  XLSX.utils.book_append_sheet(wbUnified, wbMyo.Sheets['myoton'], 'OCT_Myoton_9Point');
  XLSX.utils.book_append_sheet(wbUnified, wbMicro.Sheets['Panduan_Format'], 'Panduan_Penggunaan');

  return wbUnified;
}

/**
 * Triggers client-side browser file download for an XLSX workbook
 */
export function downloadWorkbook(workbook, filename = 'Template_Dataset.xlsx') {
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

export function downloadMicrocirculationTemplate() {
  const wb = createMicrocirculationWorkbook(['Subjek_1', 'Subjek_2', 'Subjek_3']);
  downloadWorkbook(wb, 'Format_Template_Microcirculation_SBF.xlsx');
}

export function downloadMyotonTemplate() {
  const wb = createMyotonWorkbook(['Subject 1 (Subjek_1)', 'Subject 2 (Subjek_2)', 'Subject 3 (Subjek_3)']);
  downloadWorkbook(wb, 'Format_Template_Myoton_9Point_Grid.xlsx');
}

export function downloadUnifiedTemplate() {
  const wb = createUnifiedWorkbook(['Subjek_1', 'Subjek_2', 'Subjek_3']);
  downloadWorkbook(wb, 'Format_Template_Unified_SBF_and_Myoton.xlsx');
}
