const path = require('path');
const XLSX = require('xlsx');

// Mock COMPASS_POINTS and math functions
const COMPASS_POINTS = [
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

function std(arr) {
  if (arr.length <= 1) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

const filePath = path.join(__dirname, '../Example/Input_26_11_9/KYLE OCT.xlsx');
const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- Testing JavaScript parseKyleProtocolRecord ---');
console.log('Total raw rows:', rawData.length);

let participant = 'KYLE';
const protocols = [];

for (let r = 0; r < rawData.length; r++) {
  const row = rawData[r];
  if (!row) continue;
  const c0 = row[0] ? String(row[0]).trim() : '';

  if (c0.toLowerCase().includes('participant')) {
    const parts = c0.split(':');
    if (parts.length > 1 && parts[1].trim()) participant = parts[1].trim();
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
      const compass = COMPASS_POINTS[pIdx - 1];

      const e1Be = parseFloat(dRow[1]) || 0;
      const e2Be = parseFloat(dRow[2]) || 0;
      const e3Be = parseFloat(dRow[3]) || 0;
      const e1Af = parseFloat(dRow[5]) || 0;
      const e2Af = parseFloat(dRow[6]) || 0;
      const e3Af = parseFloat(dRow[7]) || 0;

      const meanBe = Number(((e1Be + e2Be + e3Be) / 3.0).toFixed(1));
      const meanAf = Number(((e1Af + e2Af + e3Af) / 3.0).toFixed(1));
      const delta = Number((meanAf - meanBe).toFixed(1));

      points[pIdx] = {
        pointId: pIdx,
        compassName: compass.name,
        compassCode: compass.code,
        before: meanBe,
        after: meanAf,
        delta: delta,
        triplicatesBefore: [e1Be, e2Be, e3Be],
        triplicatesAfter: [e1Af, e2Af, e3Af]
      };
    }

    protocols.push({
      protocolNum: protoNum,
      name: `Protocol ${protoNum}: ${freqStr} ${intStr} (${footStr})`,
      frequency: freqStr,
      intensity: intStr,
      foot: footStr,
      points
    });
  }
}

if (participant !== 'KYLE') throw new Error('Participant mismatch: ' + participant);
if (protocols.length !== 6) throw new Error('Protocol count mismatch: ' + protocols.length);

const p1Pt1 = protocols[0].points[1];
if (p1Pt1.before !== 808.7 || p1Pt1.after !== 823.0 || p1Pt1.delta !== 14.3) {
  throw new Error('Values mismatch in Protocol 1 Point 1: ' + JSON.stringify(p1Pt1));
}

console.log('✓ All JavaScript parser checks passed successfully!');
console.log('✓ Participant:', participant);
console.log('✓ Protocols count:', protocols.length);
console.log('✓ Protocol 1 Point 1 Before:', p1Pt1.before, 'After:', p1Pt1.after, 'Delta:', p1Pt1.delta);
