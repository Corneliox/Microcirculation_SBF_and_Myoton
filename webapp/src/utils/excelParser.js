/**
 * Parser for real clinical datasets:
 * - microcirculation-data.xlsx
 * - OCT_Myoton(R_R)(2).xlsx
 *
 * Implements 9-point compass grid mapping:
 * 1. Barat Laut (NW) -> [0, 0]
 * 2. Utara (N)       -> [0, 1]
 * 3. Timur Laut (NE) -> [0, 2]
 * 4. Barat (W)       -> [1, 0]
 * 5. Tengah (C)      -> [1, 1]
 * 6. Timur (E)       -> [1, 2]
 * 7. Barat Daya (SW) -> [2, 0]
 * 8. Selatan (S)     -> [2, 1]
 * 9. Tenggara (SE)   -> [2, 2]
 */

import * as XLSX from 'xlsx';
import { calculateDwellValue, mean, std, pairedTTest, oneWayAnova, spearmanCorrelation, pearsonCorrelation } from './statistics';

export const COMPASS_POINTS = [
  { id: 1, name: 'Barat Laut (NW)', code: 'NW', row: 0, col: 0 },
  { id: 2, name: 'Utara (N)', code: 'N', row: 0, col: 1 },
  { id: 3, name: 'Timur Laut (NE)', code: 'NE', row: 0, col: 2 },
  { id: 4, name: 'Barat (W)', code: 'W', row: 1, col: 0 },
  { id: 5, name: 'Tengah (C)', code: 'C', row: 1, col: 1 },
  { id: 6, name: 'Timur (E)', code: 'E', row: 1, col: 2 },
  { id: 7, name: 'Barat Daya (SW)', code: 'SW', row: 2, col: 0 },
  { id: 8, name: 'Selatan (S)', code: 'S', row: 2, col: 1 },
  { id: 9, name: 'Tenggara (SE)', code: 'SE', row: 2, col: 2 }
];

/**
 * Parses microcirculation-data.xlsx into structured subject and condition timeseries
 */
export function parseMicrocirculationWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Scan header rows:
  // Row 1: Subject names (e.g. Bas at Col 1, Cornel at Col 13, Reuben at Col 25)
  // Row 2: Frequencies (1_30, 1_50, 1_100)
  // Row 3: Phase (before, after)
  // Row 4: Channels (Channel 1, Channel 2)
  // Row 5+: Numeric signal samples
  const subjects = [];
  const subjectIndices = [];

  for (let c = 1; c < rawData[1].length; c++) {
    const val = rawData[1][c];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      subjects.push({ name: val.trim(), startCol: c });
      subjectIndices.push(c);
    }
  }

  const parsedSubjects = {};

  for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
    const s = subjects[sIdx];
    const sName = s.name;
    const baseCol = s.startCol;
    parsedSubjects[sName] = {
      name: sName,
      frequencies: {
        '30Hz': { before: [], after: [] },
        '50Hz': { before: [], after: [] },
        '100Hz': { before: [], after: [] }
      }
    };

    // Frequency blocks are offset by 4 columns:
    // 1_30: before = baseCol, after = baseCol + 2
    // 1_50: before = baseCol + 4, after = baseCol + 6
    // 1_100: before = baseCol + 8, after = baseCol + 10
    const freqMap = [
      { key: '30Hz', beCol: baseCol, afCol: baseCol + 2 },
      { key: '50Hz', beCol: baseCol + 4, afCol: baseCol + 6 },
      { key: '100Hz', beCol: baseCol + 8, afCol: baseCol + 10 }
    ];

    for (const f of freqMap) {
      const beSamples = [];
      const afSamples = [];
      for (let r = 5; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row) continue;
        const vBe = parseFloat(row[f.beCol]);
        const vAf = parseFloat(row[f.afCol]);
        if (!isNaN(vBe)) beSamples.push(vBe);
        if (!isNaN(vAf)) afSamples.push(vAf);
      }
      parsedSubjects[sName].frequencies[f.key].before = beSamples;
      parsedSubjects[sName].frequencies[f.key].after = afSamples;
    }
  }

  return parsedSubjects;
}

/**
 * Parses OCT_Myoton(R_R)(2).xlsx into structured 9-point grid datasets
 */
export function parseMyotonWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // In OCT_Myoton(R_R)(2).xlsx:
  // Subject 1 is at rows 3-11
  // Subject 2 is at rows 13-21
  // Subject 3 is at rows 23-31
  // Cols 1-6: before1_30, after1_30, before1_50, after1_50, before1_100, after1_100
  // Cols 9-10: T1 before/after 1_30
  // Cols 11-12: M1 before/after 1_30

  const subjectSections = [
    { name: 'Subject 1 (Bas)', startRow: 3, id: 1 },
    { name: 'Subject 2 (Cornel)', startRow: 13, id: 2 },
    { name: 'Subject 3 (Reuben)', startRow: 23, id: 3 }
  ];

  const results = {};

  for (const s of subjectSections) {
    const sData = {
      name: s.name,
      id: s.id,
      points: {},
      t1: {},
      m1: {}
    };

    for (let pIdx = 1; pIdx <= 9; pIdx++) {
      const rIdx = s.startRow + pIdx - 1;
      const row = rawData[rIdx];
      if (!row) continue;

      const compass = COMPASS_POINTS.find(cp => cp.id === pIdx);

      sData.points[pIdx] = {
        pointId: pIdx,
        compassName: compass ? compass.name : `Point ${pIdx}`,
        compassCode: compass ? compass.code : `P${pIdx}`,
        gridRow: compass ? compass.row : 0,
        gridCol: compass ? compass.col : 0,
        frequencies: {
          '30Hz': {
            before: parseFloat(row[1]) || 0,
            after: parseFloat(row[2]) || 0,
            delta: (parseFloat(row[2]) || 0) - (parseFloat(row[1]) || 0)
          },
          '50Hz': {
            before: parseFloat(row[3]) || 0,
            after: parseFloat(row[4]) || 0,
            delta: (parseFloat(row[4]) || 0) - (parseFloat(row[3]) || 0)
          },
          '100Hz': {
            before: parseFloat(row[5]) || 0,
            after: parseFloat(row[6]) || 0,
            delta: (parseFloat(row[6]) || 0) - (parseFloat(row[5]) || 0)
          }
        }
      };

      // T1 & M1 measurements (if present)
      if (row[9] !== undefined || row[10] !== undefined) {
        sData.t1[pIdx] = {
          before: parseFloat(row[9]) || 0,
          after: parseFloat(row[10]) || 0,
          delta: (parseFloat(row[10]) || 0) - (parseFloat(row[9]) || 0)
        };
      }
      if (row[11] !== undefined || row[12] !== undefined) {
        sData.m1[pIdx] = {
          before: parseFloat(row[11]) || 0,
          after: parseFloat(row[12]) || 0,
          delta: (parseFloat(row[12]) || 0) - (parseFloat(row[11]) || 0)
        };
      }
    }
    results[s.id] = sData;
  }

  return results;
}

/**
 * Segments a continuous microcirculation signal into temporal dwells.
 * @param {Array<number>} samples Raw signal samples
 * @param {number} fs Sampling rate in Hz (default: 40 Hz = 25ms per sample)
 * @param {number} dwellDurationSec Dwell duration in seconds (e.g. 7.41s for 9 points or custom X sec)
 * @param {string} method Estimator ('p25', 'median', 'mean')
 * @returns {Array<object>} Segmented dwell stats
 */
export function segmentMicrocirculationSignal(samples, fs = 40.0, dwellDurationSec = 7.41, method = 'p25') {
  if (!samples || samples.length === 0) return [];
  const samplesPerDwell = Math.max(10, Math.round(dwellDurationSec * fs));
  const numDwells = Math.min(9, Math.floor(samples.length / samplesPerDwell));
  const dwells = [];

  for (let i = 0; i < 9; i++) {
    const s0 = i * samplesPerDwell;
    const s1 = Math.min(s0 + samplesPerDwell, samples.length);
    const seg = samples.slice(s0, s1);
    const compass = COMPASS_POINTS[i];

    if (seg.length > 0) {
      dwells.push({
        dwellIndex: i + 1,
        compassName: compass.name,
        compassCode: compass.code,
        gridRow: compass.row,
        gridCol: compass.col,
        startTimeSec: Number((s0 / fs).toFixed(2)),
        endTimeSec: Number((s1 / fs).toFixed(2)),
        sampleCount: seg.length,
        value: Number(calculateDwellValue(seg, method).toFixed(2)),
        mean: Number(mean(seg).toFixed(2)),
        std: Number(std(seg).toFixed(2))
      });
    } else {
      dwells.push({
        dwellIndex: i + 1,
        compassName: compass.name,
        compassCode: compass.code,
        gridRow: compass.row,
        gridCol: compass.col,
        startTimeSec: 0,
        endTimeSec: 0,
        sampleCount: 0,
        value: 0,
        mean: 0,
        std: 0
      });
    }
  }
  return dwells;
}

/**
 * Correlates 9-point microcirculation flux with 9-point Myoton tissue stiffness
 */
export function computeMultimodalGridResults(microDwellsBefore, microDwellsAfter, myotonPoints, freqKey = '30Hz') {
  const gridCells = [];
  const fluxBeforeArr = [];
  const fluxAfterArr = [];
  const fluxDeltaArr = [];
  const stiffBeforeArr = [];
  const stiffAfterArr = [];
  const stiffDeltaArr = [];

  for (let i = 0; i < 9; i++) {
    const pointId = i + 1;
    const compass = COMPASS_POINTS[i];
    const fb = microDwellsBefore[i] ? microDwellsBefore[i].value : 0;
    const fa = microDwellsAfter[i] ? microDwellsAfter[i].value : 0;
    const dFlux = fa - fb;

    const myoPoint = myotonPoints[pointId];
    const myoFreq = myoPoint ? myoPoint.frequencies[freqKey] : { before: 0, after: 0, delta: 0 };
    const sb = myoFreq.before;
    const sa = myoFreq.after;
    const dStiff = myoFreq.delta;

    fluxBeforeArr.push(fb);
    fluxAfterArr.push(fa);
    fluxDeltaArr.push(dFlux);
    stiffBeforeArr.push(sb);
    stiffAfterArr.push(sa);
    stiffDeltaArr.push(dStiff);

    gridCells.push({
      id: pointId,
      name: compass.name,
      code: compass.code,
      row: compass.row,
      col: compass.col,
      fluxBefore: fb,
      fluxAfter: fa,
      fluxDelta: Number(dFlux.toFixed(2)),
      fluxChangePct: fb > 0 ? Number(((dFlux / fb) * 100).toFixed(1)) : 0,
      stiffBefore: sb,
      stiffAfter: sa,
      stiffDelta: dStiff,
      stiffChangePct: sb > 0 ? Number(((dStiff / sb) * 100).toFixed(1)) : 0
    });
  }

  const spearmanDelta = spearmanCorrelation(fluxDeltaArr, stiffDeltaArr);
  const pearsonDelta = pearsonCorrelation(fluxDeltaArr, stiffDeltaArr);
  const spearmanBefore = spearmanCorrelation(fluxBeforeArr, stiffBeforeArr);
  const spearmanAfter = spearmanCorrelation(fluxAfterArr, stiffAfterArr);

  return {
    cells: gridCells,
    correlations: {
      deltaSpearman: spearmanDelta,
      deltaPearson: pearsonDelta,
      beforeSpearman: spearmanBefore,
      afterSpearman: spearmanAfter
    },
    means: {
      fluxBeforeMean: Number(mean(fluxBeforeArr).toFixed(2)),
      fluxAfterMean: Number(mean(fluxAfterArr).toFixed(2)),
      fluxDeltaMean: Number(mean(fluxDeltaArr).toFixed(2)),
      stiffBeforeMean: Number(mean(stiffBeforeArr).toFixed(1)),
      stiffAfterMean: Number(mean(stiffAfterArr).toFixed(1)),
      stiffDeltaMean: Number(mean(stiffDeltaArr).toFixed(1))
    }
  };
}
