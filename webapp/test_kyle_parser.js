import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { COMPASS_POINTS, parseKyleProtocolRecord } from './src/utils/excelParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../Example/Input_26_11_9/KYLE OCT.xlsx');
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- Testing JavaScript parseKyleProtocolRecord ---');
console.log('Total raw rows:', rawData.length);

const parsed = parseKyleProtocolRecord(rawData);
const kyle = parsed['KYLE'];

if (!kyle) {
  console.error('Participant KYLE not found');
  process.exit(1);
}

if (!kyle.protocols || kyle.protocols.length !== 6) {
  console.error('Expected 6 protocols, got', kyle.protocols?.length);
  process.exit(1);
}

const p1 = kyle.protocols[0];
const pt1 = p1.points[1];

if (Math.abs(pt1.before - 808.7) > 0.2 || Math.abs(pt1.after - 823.0) > 0.2 || Math.abs(pt1.delta - 14.3) > 0.2) {
  console.error('Protocol 1 Point 1 values mismatch:', pt1);
  process.exit(1);
}

console.log('✓ All JavaScript parser checks passed successfully!');
console.log('✓ Participant:', kyle.name);
console.log('✓ Protocols count:', kyle.protocols.length);
console.log('✓ Protocol 1 Point 1 Before:', pt1.before, 'After:', pt1.after, 'Delta:', pt1.delta);
