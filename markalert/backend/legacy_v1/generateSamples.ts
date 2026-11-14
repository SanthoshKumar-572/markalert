import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { rawStudentList } from '../scripts/importStudentList';

const sampleDirs = [
  path.resolve(__dirname, '../../../sample_files'),
  path.resolve(__dirname, '../../sample_files'),
  path.resolve(process.cwd(), 'sample_files'),
  path.resolve(process.cwd(), '../sample_files')
];
for (const dir of sampleDirs) {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
}

// 1. Standard Marks Excel (61 IT-C students with CN, STA, IOT, BDA, FSWD, DC)
const standardData = rawStudentList.map(s => {
  if (s.name === 'YUVANESH P') {
    return {
      'REG NO': s.regNo,
      'NAME': s.name,
      'CN': 70,
      'STA': 67,
      'IOT': 80,
      'BDA': 75,
      'FSWD': 64,
      'DC': 81
    };
  }
  return {
    'REG NO': s.regNo,
    'NAME': s.name,
    'CN': 75 + (s.sNo % 20),
    'STA': 65 + (s.sNo % 25),
    'IOT': 80 + (s.sNo % 15),
    'BDA': 70 + (s.sNo % 22),
    'FSWD': 68 + (s.sNo % 24),
    'DC': 74 + (s.sNo % 20)
  };
});

const wb1 = XLSX.utils.book_new();
const ws1 = XLSX.utils.json_to_sheet(standardData);
XLSX.utils.book_append_sheet(wb1, ws1, 'Internal Marks');

// 2. Varied Column Names
const variedData = rawStudentList.slice(0, 10).map(s => ({
  'Register Number': s.regNo,
  'Student Name': s.name,
  'CN': 80,
  'STA': 75,
  'IOT': 85,
  'BDA': 70,
  'FSWD': 90,
  'DC': 82
}));

const wb2 = XLSX.utils.book_new();
const ws2 = XLSX.utils.json_to_sheet(variedData);
XLSX.utils.book_append_sheet(wb2, ws2, 'Marks Sheet');

// 3. Marks with Validation Errors (Negative, Exceeding max, Duplicate, Missing name)
const errorData = [
  { 'REG NO': '922524205125', 'NAME': 'PRIYANKA M.K', 'CN': -5, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 },
  { 'REG NO': '922524205126', 'NAME': 'RAGUL R', 'CN': 150, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 },
  { 'REG NO': '922524205127', 'NAME': 'RAJASARANYA S', 'CN': 80, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 },
  { 'REG NO': '922524205128', 'NAME': 'RAJAVARMAN R A', 'CN': 80, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 },
  { 'REG NO': '922524205128', 'NAME': 'RAJAVARMAN DUPLICATE', 'CN': 85, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 },
  { 'REG NO': '922524205129', 'NAME': '', 'CN': 70, 'STA': 80, 'IOT': 75, 'BDA': 70, 'FSWD': 80, 'DC': 85 }
];

const wb3 = XLSX.utils.book_new();
const ws3 = XLSX.utils.json_to_sheet(errorData);
XLSX.utils.book_append_sheet(wb3, ws3, 'Errors Test Sheet');

for (const dir of sampleDirs) {
  XLSX.writeFile(wb1, path.join(dir, 'sample_marks_standard.xlsx'));
  XLSX.writeFile(wb2, path.join(dir, 'sample_marks_varied_columns.xlsx'));
  XLSX.writeFile(wb3, path.join(dir, 'sample_marks_with_errors.xlsx'));
}

console.log('[Samples] Generated sample Excel test files across sample_files directories');
