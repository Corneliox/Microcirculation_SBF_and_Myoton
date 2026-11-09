/**
 * Unit test for template generator roundtrip and parsing
 */
import * as XLSX from 'xlsx';
import { createMyotonWorkbook, createUnifiedWorkbook } from './src/utils/templateGenerator.js';
import { parseMyotonWorkbook, parseMicrocirculationWorkbook } from './src/utils/excelParser.js';

console.log('[TEST] 1. Generating Default Myoton Template (KYLE format)...');
const myoWb = createMyotonWorkbook(['KYLE']);
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

// Verify Point 1 values of Protocol 1:
// Before: 816, 814, 796 -> 808.7
// After: 793, 826, 850 -> 823.0
// Delta: 14.3
const pt1 = kyle.protocols[0].points[1];
console.log(`[PASS] Point 1: Before=${pt1.before}, After=${pt1.after}, Delta=${pt1.delta}`);
if (Math.abs(pt1.before - 808.7) > 0.2 || Math.abs(pt1.after - 823.0) > 0.2) {
  console.error('[FAIL] Point 1 mean values mismatch');
  process.exit(1);
}

console.log('\n[TEST] 2. Generating Unified Workbook (SBF + OCT Myoton)...');
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
