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
import { calculateDwellValue, mean, median, std, pairedTTest, oneWayAnova, spearmanCorrelation, pearsonCorrelation } from './statistics.js';

export const COMPASS_POINTS = [
  { id: 1, name: 'North-West (NW)', code: 'NW', row: 0, col: 0 },
  { id: 2, name: 'North (N)', code: 'N', row: 0, col: 1 },
  { id: 3, name: 'North-East (NE)', code: 'NE', row: 0, col: 2 },
  { id: 4, name: 'West (W)', code: 'W', row: 1, col: 0 },
  { id: 5, name: 'Center (C)', code: 'C', row: 1, col: 1 },
  { id: 6, name: 'East (E)', code: 'E', row: 1, col: 2 },
  { id: 7, name: 'South-West (SW)', code: 'SW', row: 2, col: 0 },
  { id: 8, name: 'South (S)', code: 'S', row: 2, col: 1 },
  { id: 9, name: 'South-East (SE)', code: 'SE', row: 2, col: 2 }
];

/**
 * Parses microcirculation-data.xlsx into structured subject and condition timeseries
 * Automatically detects subject names, column offsets, and numeric data start.
 */
export function parseMicrocirculationWorkbook(workbook) {
  // Check for the most relevant sheet if multiple sheets exist
  let targetSheetName = workbook.SheetNames[0];
  for (const sName of workbook.SheetNames) {
    if (sName.toLowerCase().includes('micro') || sName.toLowerCase().includes('sbf')) {
      targetSheetName = sName;
      break;
    }
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rawData || rawData.length < 4) {
    throw new Error('Invalid SBF worksheet format (insufficient rows)');
  }

  // 1. Detect Subject Header Row (Search rows 0, 1, 2)
  let subjectRowIdx = 0;
  let subjects = [];

  for (let r = 0; r < Math.min(3, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    const detected = [];
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        const v = val.trim();
        // Exclude frequency markers or channel/phase labels
        if (!v.match(/^\d+_\d+/) && !v.match(/channel/i) && !v.match(/^(before|after)$/i)) {
          detected.push({ name: v, startCol: c });
        }
      }
    }
    if (detected.length > 0) {
      subjectRowIdx = r;
      subjects = detected;
      break;
    }
  }

  // Fallback if no subject row found: single subject named 'Subject_1'
  if (subjects.length === 0) {
    subjects = [{ name: 'Subject_1', startCol: 0 }];
  }

  // 2. Find the row where numeric time-series data begins
  let dataStartRow = 4;
  for (let r = subjectRowIdx + 1; r < Math.min(10, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    let numericCount = 0;
    for (let c = 0; c < Math.min(row.length, 12); c++) {
      if (typeof row[c] === 'number' && !isNaN(row[c])) numericCount++;
    }
    if (numericCount >= 2) {
      dataStartRow = r;
      break;
    }
  }

  const parsedSubjects = {};

  for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
    const s = subjects[sIdx];
    const sName = s.name;
    const baseCol = s.startCol;

    parsedSubjects[sName] = {
      name: sName,
      id: sIdx + 1,
      frequencies: {
        '30Hz': { before: [], after: [] },
        '50Hz': { before: [], after: [] },
        '100Hz': { before: [], after: [] }
      }
    };

    // Standard frequency offsets (30Hz, 50Hz, 100Hz):
    // 30Hz: before = baseCol, after = baseCol + 2
    // 50Hz: before = baseCol + 4, after = baseCol + 6
    // 100Hz: before = baseCol + 8, after = baseCol + 10
    const freqMap = [
      { key: '30Hz', beCol: baseCol, afCol: baseCol + 2 },
      { key: '50Hz', beCol: baseCol + 4, afCol: baseCol + 6 },
      { key: '100Hz', beCol: baseCol + 8, afCol: baseCol + 10 }
    ];

    for (const f of freqMap) {
      const beSamples = [];
      const afSamples = [];
      for (let r = dataStartRow; r < rawData.length; r++) {
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
 * Exhaustive Validator for Myoton OCT Foot Measurement Workbooks.
 * Maps all potential format states, formula errors, partial protocols, and anomalies.
 */
export function validateOctWorkbook(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length < 5) {
    return {
      status: 'ERROR',
      badge: 'Corrupted Format',
      color: 'rose',
      code: 'EMPTY_OR_UNREADABLE',
      title: 'Empty or Unreadable File',
      issues: ['The Excel workbook does not contain sufficient rows for protocol analysis.'],
      recommendation: 'Ensure the Excel workbook contains valid Myoton OCT measurement data.',
      protocolCount: 0
    };
  }

  let hasOctHeader = false;
  let hasParticipant = false;
  const protoIndices = [];
  const foundErrors = [];
  const outOfRangeValues = [];

  for (let r = 0; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;
    const c0 = row[0] ? String(row[0]).trim() : '';
    const c0Lower = c0.toLowerCase();

    if (c0Lower.includes('oct foot measurement') || c0Lower.includes('oct')) {
      hasOctHeader = true;
    }
    if (c0Lower.includes('participant')) {
      hasParticipant = true;
    }
    if (c0Lower.startsWith('protocol')) {
      protoIndices.push(r);
    }

    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] ?? '');
      if (cellVal.includes('#VALUE!') || cellVal.includes('#REF!') || cellVal.includes('#DIV/0!') || cellVal.includes('#N/A')) {
        foundErrors.push('Baris ' + (r + 1) + ', Kolom ' + (c + 1) + ': ' + cellVal);
      }
    }
  }

  // Check if completely unrecognizable format
  if (!hasOctHeader && !hasParticipant && protoIndices.length === 0) {
    const hasSubject = rawData.some(r => r && typeof r[0] === 'string' && (r[0].toLowerCase().includes('subject') || r[0].toLowerCase().includes('subjek')));
    if (hasSubject) {
      return {
        status: 'WARNING',
        badge: 'Legacy Subject Format',
        color: 'amber',
        code: 'LEGACY_FORMAT',
        title: 'Legacy Subject Table Format',
        issues: ['File uses legacy 9-point Subject format instead of Standard Multi-Protocol OCT Record.'],
        recommendation: 'Use the official OCT Foot Measurement Record template (NewFormat.xlsx) for full multi-protocol and triplicate support.',
        protocolCount: 0
      };
    }

    return {
      status: 'UNKNOWN',
      badge: 'Unknown Format Issue',
      color: 'slate',
      code: 'UNKNOWN_STRUCTURE',
      title: 'Unrecognized File Structure',
      issues: ['Workbook does not contain an OCT header, Participant marker, or standard Protocol blocks.'],
      recommendation: 'Download the official NewFormat.xlsx template from the application toolbar and copy measurement data into it.',
      protocolCount: 0
    };
  }

  if (protoIndices.length === 0) {
    return {
      status: 'ERROR',
      badge: 'Invalid Format',
      color: 'rose',
      code: 'MISSING_PROTOCOLS',
      title: 'No Protocol Blocks Detected',
      issues: ['Header identified but no lines beginning with "Protocol 1", "Protocol 2", etc. were found.'],
      recommendation: 'Ensure each protocol header row begins with "Protocol 1", "Protocol 2", etc.',
      protocolCount: 0
    };
  }

  // Verify points & triplicates in each protocol
  const issues = [];
  let completeProtocols = 0;

  protoIndices.forEach((r, idx) => {
    let validPointsCount = 0;
    for (let pIdx = 1; pIdx <= 9; pIdx++) {
      const dRow = rawData[r + 3 + pIdx];
      if (dRow) {
        const e1Be = parseFloat(dRow[1]);
        const e2Be = parseFloat(dRow[2]);
        const e3Be = parseFloat(dRow[3]);
        const e1Af = parseFloat(dRow[5]);
        const e2Af = parseFloat(dRow[6]);
        const e3Af = parseFloat(dRow[7]);

        const allNumeric = [e1Be, e2Be, e3Be, e1Af, e2Af, e3Af].every(v => !isNaN(v) && v > 0);
        if (allNumeric) {
          validPointsCount++;
          [e1Be, e2Be, e3Be, e1Af, e2Af, e3Af].forEach(v => {
            if (v < 30 || v > 3000) {
              outOfRangeValues.push('Protocol ' + (idx + 1) + ' Point ' + pIdx + ': Value ' + v + ' outside physiological range (30 - 3000)');
            }
          });
        }
      }
    }
    if (validPointsCount === 9) {
      completeProtocols++;
    } else {
      issues.push('Protocol ' + (idx + 1) + ' only has ' + validPointsCount + '/9 points completely filled.');
    }
  });

  if (foundErrors.length > 0) {
    return {
      status: 'ERROR',
      badge: 'Corrupted Format',
      color: 'rose',
      code: 'FORMULA_ERRORS',
      title: 'Excel Formula Errors Detected (#VALUE!, #REF!)',
      issues: foundErrors.slice(0, 5),
      recommendation: 'Check the corrupted Excel cells listed above and replace them with valid numeric measurement values.',
      protocolCount: protoIndices.length
    };
  }

  if (protoIndices.length < 6) {
    issues.push('Only ' + protoIndices.length + ' protocols found (clinical standard requires 6 protocols).');
  }

  if (outOfRangeValues.length > 0) {
    issues.push(...outOfRangeValues.slice(0, 3));
  }

  if (issues.length > 0) {
    return {
      status: 'WARNING',
      badge: 'Format Warning',
      color: 'amber',
      code: 'INCOMPLETE_DATA',
      title: 'Partial / Incomplete Format',
      issues: issues,
      recommendation: 'Some measurement points or protocols are incomplete. You may still analyze the available data.',
      protocolCount: protoIndices.length
    };
  }

  return {
    status: 'VALID',
    badge: 'Standard Format Verified',
    color: 'emerald',
    code: 'PERFECT_MATCH',
    title: 'Standard OCT Format Fully Verified',
    issues: [],
    recommendation: 'All 6 clinical protocols and 9 triplicate measurement points are verified intact.',
    protocolCount: protoIndices.length
  };
}

/**
 * Parses new OCT Foot Measurement Record format (e.g. KYLE OCT.xlsx).
 * Supports multi-protocol records (Frequency 1Hz, 50Hz; Intensity 30%, 50%, 80%; Left vs Right foot)
 * with triplicate measurements (E1, E2, E3 Before and After).
 */
export function parseKyleProtocolRecord(rawData, fileName = '') {
  let participant = 'KYLE';
  const protocols = [];
  let currentDate = null;

  for (let r = 0; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;
    const c0 = row[0] ? String(row[0]).trim() : '';

    if (c0.toLowerCase().includes('participant')) {
      const parts = c0.split(':');
      if (parts.length > 1 && parts[1].trim()) {
        participant = parts[1].trim();
      }
    }

    if (c0.toLowerCase().includes('date')) {
      const dVal = row[1];
      currentDate = dVal ? String(dVal) : c0;
    }

    if (c0.toLowerCase().startsWith('protocol')) {
      const mProto = c0.match(/protocol\s*(\d+)/i);
      const protoNum = mProto ? parseInt(mProto[1], 10) : protocols.length + 1;

      const mFreq = c0.match(/frequency:\s*([\d.]+)\s*hz/i);
      const freqStr = mFreq ? `${mFreq[1]}Hz` : 'Unknown';

      const mInt = c0.match(/intensity:\s*([\d.]+)%?/i);
      const intStr = mInt ? `${mInt[1]}%` : 'Unknown';

      const nextRow = rawData[r + 1];
      const footStr = (nextRow && nextRow[0]) ? String(nextRow[0]).trim() : 'Unknown Foot';

      const points = {};
      for (let pIdx = 1; pIdx <= 9; pIdx++) {
        const dataR = r + 3 + pIdx;
        const dRow = rawData[dataR] || [];
        const compass = COMPASS_POINTS.find(cp => cp.id === pIdx);

        const e1Be = parseFloat(dRow[1]) || 0;
        const e2Be = parseFloat(dRow[2]) || 0;
        const e3Be = parseFloat(dRow[3]) || 0;

        const e1Af = parseFloat(dRow[5]) || 0;
        const e2Af = parseFloat(dRow[6]) || 0;
        const e3Af = parseFloat(dRow[7]) || 0;

        const beArr = [e1Be, e2Be, e3Be];
        const afArr = [e1Af, e2Af, e3Af];

        // 1. Mean (Average)
        const meanBe = Number(((e1Be + e2Be + e3Be) / 3.0).toFixed(1));
        const meanAf = Number(((e1Af + e2Af + e3Af) / 3.0).toFixed(1));
        const delta = Number((meanAf - meanBe).toFixed(1));

        // 2. Median (Middle Value: n > min & n < max)
        const sortedBe = beArr.slice().sort((a, b) => a - b);
        const sortedAf = afArr.slice().sort((a, b) => a - b);
        const medianBe = Number(sortedBe[1].toFixed(1));
        const medianAf = Number(sortedAf[1].toFixed(1));
        const medianDelta = Number((medianAf - medianBe).toFixed(1));

        const beStd = Number(std(beArr).toFixed(1));
        const afStd = Number(std(afArr).toFixed(1));
        const beCv = meanBe > 0 ? Number(((beStd / meanBe) * 100).toFixed(1)) : 0;
        const afCv = meanAf > 0 ? Number(((afStd / meanAf) * 100).toFixed(1)) : 0;

        points[pIdx] = {
          pointId: pIdx,
          compassName: compass ? compass.name : `Point ${pIdx}`,
          compassCode: compass ? compass.code : `P${pIdx}`,
          gridRow: compass ? compass.row : 0,
          gridCol: compass ? compass.col : 0,
          before: meanBe,
          after: meanAf,
          delta: delta,
          meanBefore: meanBe,
          meanAfter: meanAf,
          meanDelta: delta,
          medianBefore: medianBe,
          medianAfter: medianAf,
          medianDelta: medianDelta,
          stiffChangePct: meanBe > 0 ? Number(((delta / meanBe) * 100).toFixed(1)) : 0,
          medianStiffChangePct: medianBe > 0 ? Number(((medianDelta / medianBe) * 100).toFixed(1)) : 0,
          beforeStd: beStd,
          afterStd: afStd,
          beforeCv: beCv,
          afterCv: afCv,
          triplicatesBefore: [e1Be, e2Be, e3Be],
          triplicatesAfter: [e1Af, e2Af, e3Af],
          sortedTriplicatesBefore: sortedBe,
          sortedTriplicatesAfter: sortedAf
        };
      }

      protocols.push({
        protocolNum: protoNum,
        name: `Protocol ${protoNum}: ${freqStr} ${intStr} (${footStr})`,
        shortKey: `P${protoNum}_${freqStr}_${intStr}`,
        frequency: freqStr,
        intensity: intStr,
        foot: footStr,
        date: currentDate,
        points: points
      });
    }
  }

  // Construct standard points map for universal compatibility
  const defaultProto = protocols[0] || null;
  const standardPoints = {};

  for (let pIdx = 1; pIdx <= 9; pIdx++) {
    const compass = COMPASS_POINTS.find(cp => cp.id === pIdx);
    const freqs = {};

    protocols.forEach(proto => {
      const pt = proto.points[pIdx];
      if (pt) {
        freqs[proto.name] = {
          before: pt.before,
          after: pt.after,
          delta: pt.delta,
          meanBefore: pt.meanBefore,
          meanAfter: pt.meanAfter,
          meanDelta: pt.meanDelta,
          medianBefore: pt.medianBefore,
          medianAfter: pt.medianAfter,
          medianDelta: pt.medianDelta,
          triplicatesBefore: pt.triplicatesBefore,
          triplicatesAfter: pt.triplicatesAfter,
          sortedTriplicatesBefore: pt.sortedTriplicatesBefore,
          sortedTriplicatesAfter: pt.sortedTriplicatesAfter,
          beforeStd: pt.beforeStd,
          afterStd: pt.afterStd
        };
        freqs[proto.shortKey] = freqs[proto.name];
      }
    });

    const p1Pt = protocols.find(p => p.frequency.includes('1'))?.points[pIdx];
    if (p1Pt) {
      freqs['1Hz'] = {
        before: p1Pt.before,
        after: p1Pt.after,
        delta: p1Pt.delta,
        meanBefore: p1Pt.meanBefore,
        meanAfter: p1Pt.meanAfter,
        meanDelta: p1Pt.meanDelta,
        medianBefore: p1Pt.medianBefore,
        medianAfter: p1Pt.medianAfter,
        medianDelta: p1Pt.medianDelta,
        triplicatesBefore: p1Pt.triplicatesBefore,
        triplicatesAfter: p1Pt.triplicatesAfter,
        sortedTriplicatesBefore: p1Pt.sortedTriplicatesBefore,
        sortedTriplicatesAfter: p1Pt.sortedTriplicatesAfter,
        beforeStd: p1Pt.beforeStd,
        afterStd: p1Pt.afterStd
      };
    }
    const p50Pt = protocols.find(p => p.frequency.includes('50'))?.points[pIdx];
    if (p50Pt) {
      freqs['50Hz'] = {
        before: p50Pt.before,
        after: p50Pt.after,
        delta: p50Pt.delta,
        meanBefore: p50Pt.meanBefore,
        meanAfter: p50Pt.meanAfter,
        meanDelta: p50Pt.meanDelta,
        medianBefore: p50Pt.medianBefore,
        medianAfter: p50Pt.medianAfter,
        medianDelta: p50Pt.medianDelta,
        triplicatesBefore: p50Pt.triplicatesBefore,
        triplicatesAfter: p50Pt.triplicatesAfter,
        sortedTriplicatesBefore: p50Pt.sortedTriplicatesBefore,
        sortedTriplicatesAfter: p50Pt.sortedTriplicatesAfter,
        beforeStd: p50Pt.beforeStd,
        afterStd: p50Pt.afterStd
      };
    }
    if (!freqs['30Hz']) {
      freqs['30Hz'] = freqs['1Hz'] || (defaultProto ? defaultProto.points[pIdx] : { before: 0, after: 0, delta: 0 });
    }
    if (!freqs['100Hz']) {
      freqs['100Hz'] = freqs['50Hz'] || (defaultProto ? defaultProto.points[pIdx] : { before: 0, after: 0, delta: 0 });
    }

    standardPoints[pIdx] = {
      pointId: pIdx,
      compassName: compass ? compass.name : `Point ${pIdx}`,
      compassCode: compass ? compass.code : `P${pIdx}`,
      gridRow: compass ? compass.row : 0,
      gridCol: compass ? compass.col : 0,
      frequencies: freqs
    };
  }

  const validation = validateOctWorkbook(rawData);

  const sData = {
    name: participant,
    fileName: fileName || `${participant}_OCT.xlsx`,
    id: 1,
    isProtocolFormat: true,
    protocols: protocols,
    availableProtocols: protocols.map(p => p.name),
    availableFrequencies: [...new Set(protocols.map(p => p.frequency))],
    points: standardPoints,
    validation: validation,
    t1: {},
    m1: {}
  };

  const results = {};
  results[participant] = sData;
  results[1] = sData;
  results['ALL'] = sData;

  return results;
}

/**
 * Parses OCT_Myoton(R_R)(2).xlsx into structured 9-point grid datasets.
 * Dynamically detects subject markers and points 1-9 in snake compass order.
 * Also auto-detects new multi-protocol format (KYLE OCT.xlsx).
 */
export function parseMyotonWorkbook(workbook) {
  let combinedResults = {};
  let kyleSheetFound = false;

  // 1. Scan all sheets for the new OCT Foot Measurement Record format (e.g. KYLE OCT.xlsx)
  for (const sName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sName];
    if (!sheet) continue;
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawData || rawData.length === 0) continue;

    const isKyleFormat = rawData.some(row =>
      row && typeof row[0] === 'string' &&
      (row[0].includes('OCT FOOT MEASUREMENT') || row[0].toLowerCase().includes('participant') || row[0].toLowerCase().startsWith('protocol'))
    );

    if (isKyleFormat) {
      const parsed = parseKyleProtocolRecord(rawData);
      combinedResults = { ...combinedResults, ...parsed };
      kyleSheetFound = true;
    }
  }

  if (kyleSheetFound) {
    return combinedResults;
  }

  // 2. Fallback to scanning sheets for Legacy Subject format
  let legacyRawData = null;
  for (const sName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sName];
    if (!sheet) continue;
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawData || rawData.length === 0) continue;

    const hasSubject = rawData.some(row =>
      row && typeof row[0] === 'string' &&
      (row[0].toLowerCase().includes('subject') || row[0].toLowerCase().includes('subjek'))
    );
    if (hasSubject) {
      legacyRawData = rawData;
      break;
    }
  }

  if (!legacyRawData) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    legacyRawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  }

  const rawData = legacyRawData;
  const subjectSections = [];

  // Dynamically scan column 0 for subject header rows
  for (let r = 0; r < rawData.length; r++) {
    const row = rawData[r];
    if (row && typeof row[0] === 'string') {
      const txt = row[0].trim();
      if (txt.toLowerCase().includes('subject') || txt.toLowerCase().includes('subjek')) {
        subjectSections.push({
          name: txt,
          id: subjectSections.length + 1,
          startRow: r + 1
        });
      }
    }
  }

  // Fallback for files without explicit Subject row titles
  if (subjectSections.length === 0) {
    subjectSections.push(
      { name: 'Subject 1', id: 1, startRow: 3 },
      { name: 'Subject 2', id: 2, startRow: 13 },
      { name: 'Subject 3', id: 3, startRow: 23 }
    );
  }

  const results = {};
  const allSubjectIds = [];

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
            delta: Number(((parseFloat(row[2]) || 0) - (parseFloat(row[1]) || 0)).toFixed(1))
          },
          '50Hz': {
            before: parseFloat(row[3]) || 0,
            after: parseFloat(row[4]) || 0,
            delta: Number(((parseFloat(row[4]) || 0) - (parseFloat(row[3]) || 0)).toFixed(1))
          },
          '100Hz': {
            before: parseFloat(row[5]) || 0,
            after: parseFloat(row[6]) || 0,
            delta: Number(((parseFloat(row[6]) || 0) - (parseFloat(row[5]) || 0)).toFixed(1))
          }
        }
      };

      if (row[9] !== undefined || row[10] !== undefined) {
        sData.t1[pIdx] = {
          before: parseFloat(row[9]) || 0,
          after: parseFloat(row[10]) || 0,
          delta: Number(((parseFloat(row[10]) || 0) - (parseFloat(row[9]) || 0)).toFixed(1))
        };
      }
      if (row[11] !== undefined || row[12] !== undefined) {
        sData.m1[pIdx] = {
          before: parseFloat(row[11]) || 0,
          after: parseFloat(row[12]) || 0,
          delta: Number(((parseFloat(row[12]) || 0) - (parseFloat(row[11]) || 0)).toFixed(1))
        };
      }
    }

    results[s.id] = sData;
    results[s.name] = sData;
    allSubjectIds.push(s.id);
  }

  // Pre-calculate GROUP_AVERAGE across all detected subjects
  if (allSubjectIds.length > 0) {
    const groupData = {
      name: `Group Average (N = ${allSubjectIds.length})`,
      id: 'ALL',
      points: {},
      t1: {},
      m1: {}
    };

    for (let pIdx = 1; pIdx <= 9; pIdx++) {
      const compass = COMPASS_POINTS.find(cp => cp.id === pIdx);
      const be30List = [], af30List = [];
      const be50List = [], af50List = [];
      const be100List = [], af100List = [];

      allSubjectIds.forEach(id => {
        const p = results[id]?.points[pIdx]?.frequencies;
        if (p) {
          be30List.push(p['30Hz'].before);
          af30List.push(p['30Hz'].after);
          be50List.push(p['50Hz'].before);
          af50List.push(p['50Hz'].after);
          be100List.push(p['100Hz'].before);
          af100List.push(p['100Hz'].after);
        }
      });

      const avg = arr => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

      const mBe30 = avg(be30List);
      const mAf30 = avg(af30List);
      const mBe50 = avg(be50List);
      const mAf50 = avg(af50List);
      const mBe100 = avg(be100List);
      const mAf100 = avg(af100List);

      groupData.points[pIdx] = {
        pointId: pIdx,
        compassName: compass.name,
        compassCode: compass.code,
        gridRow: compass.row,
        gridCol: compass.col,
        frequencies: {
          '30Hz': { before: mBe30, after: mAf30, delta: Number((mAf30 - mBe30).toFixed(1)) },
          '50Hz': { before: mBe50, after: mAf50, delta: Number((mAf50 - mBe50).toFixed(1)) },
          '100Hz': { before: mBe100, after: mAf100, delta: Number((mAf100 - mBe100).toFixed(1)) }
        }
      };
    }

    results['ALL'] = groupData;
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
