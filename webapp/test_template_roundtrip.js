/**
 * Unit test for template generator roundtrip and parsing
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { createMyotonWorkbook, createUnifiedWorkbook } from './src/utils/templateGenerator.js';
import { parseMyotonWorkbook, parseMicrocirculationWorkbook } from './src/utils/excelParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[TEST] 1. Testing physical NewFormat.xlsx file parsing...');
const newFormatPath = path.join(__dirname, '../Example/Input_26_11_9/NewFormat.xlsx');
if (!fs.existsSync(newFormatPath)) {
  console.error('[FAIL] NewFormat.xlsx missing at:', newFormatPath);
  process.exit(1);
}
const bufNew = fs.readFileSync(newFormatPath);
const wbNew = XLSX.read(bufNew, { type: 'buffer' });
const parsedNew = parseMyotonWorkbook(wbNew);

if (!parsedNew['KYLE'] || !parsedNew['KYLE'].protocols || parsedNew['KYLE'].protocols.length !== 6) {
  console.error('[FAIL] Failed parsing physical NewFormat.xlsx');
  process.exit(1);
}
console.log(`[PASS] Physical NewFormat.xlsx parsed successfully with ${parsedNew['KYLE'].protocols.length} protocols!`);

console.log('\n[TEST] 2. Generating Default Myoton Template (KYLE benchmark values)...');
const myoWb = createMyotonWorkbook(['KYLE'], true);
const parsedMyo = parseMyotonWorkbook(myoWb);

if (!parsedMyo['KYLE']) {
  console.error('[FAIL] Participant KYLE not found in parsed template');
  process.exit(1);
}

const kyle = parsedMyo['KYLE'];
console.log(`[PASS] Participant found: ${kyle.name}, isProtocolFormat: ${kyle.isProtocolFormat}`);

if (!kyle.protocols || kyle.protocols.length !== 6) {
  console.error(`[FAIL] Expected 6 protocols, got: ${kyle.protocols ? kyle.protocols.length : 0}`);
  process.exit(1);
}
console.log(`[PASS] Verified 6 clinical protocols:`);
kyle.protocols.forEach(p => console.log(`   - ${p.name}`));

const pt1 = kyle.protocols[0].points[1];
console.log(`[PASS] Point 1: Mean Before=${pt1.before}, Mean After=${pt1.after}, Mean Delta=${pt1.delta}`);
console.log(`[PASS] Point 1: Median Before=${pt1.medianBefore}, Median After=${pt1.medianAfter}, Median Delta=${pt1.medianDelta}`);
if (Math.abs(pt1.before - 808.7) > 0.2 || Math.abs(pt1.after - 823.0) > 0.2) {
  console.error('[FAIL] Point 1 mean values mismatch');
  process.exit(1);
}
if (Math.abs(pt1.medianBefore - 814.0) > 0.2 || Math.abs(pt1.medianAfter - 826.0) > 0.2 || Math.abs(pt1.medianDelta - 12.0) > 0.2) {
  console.error('[FAIL] Point 1 median values mismatch');
  process.exit(1);
}

console.log('\n[TEST] 3. Generating Blank Template (matching NewFormat.xlsx)...');
const blankWb = createMyotonWorkbook(['KYLE'], false);
const parsedBlank = parseMyotonWorkbook(blankWb);
if (!parsedBlank['KYLE'] || parsedBlank['KYLE'].protocols.length !== 6) {
  console.error('[FAIL] Blank template parsing failed');
  process.exit(1);
}
console.log('[PASS] Blank template generated and parsed cleanly!');

console.log('\n[TEST] 4. Generating Unified Workbook (SBF + OCT Myoton)...');
const unifiedWb = createUnifiedWorkbook(['KYLE', 'Subject_B']);
console.log('Unified Workbook Sheets:', unifiedWb.SheetNames);

const parsedUnifiedMyo = parseMyotonWorkbook(unifiedWb);
if (!parsedUnifiedMyo['KYLE']) {
  console.error('[FAIL] parseMyotonWorkbook failed on unified workbook');
  process.exit(1);
}
console.log('[PASS] parseMyotonWorkbook succeeded on unified workbook for KYLE!');

const parsedUnifiedMicro = parseMicrocirculationWorkbook(unifiedWb);
const microSubjects = Object.keys(parsedUnifiedMicro);
console.log('[PASS] parseMicrocirculationWorkbook succeeded on unified workbook. Subjects:', microSubjects);

console.log('\n=========================================');
console.log('ALL TEMPLATE GENERATOR TESTS PASSED OK!   ');
console.log('=========================================');
