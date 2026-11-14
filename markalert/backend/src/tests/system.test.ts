import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

import { validateIndianPhone, maskPhone } from '../utils/phone';
import { renderTemplate, formatMarksBlock } from '../utils/template';
import { encryptText, decryptText } from '../utils/crypto';
import { excelService } from '../modules/excel/excel.service';
import { whatsAppProvider } from '../providers/whatsapp/whatsapp.provider';
import { smsProvider } from '../providers/sms/sms.provider';

describe('MarkAlert v2 Core Engine Test Suite', () => {
  // Test Scenario 1 & 2: Indian Phone Validation & Masking
  describe('Indian Mobile Number Validation & Privacy Masking', () => {
    it('should validate and normalize standard 10-digit Indian numbers', () => {
      const res = validateIndianPhone('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe('9876543210');
      expect(res.formattedE164).toBe('+919876543210');
      expect(res.masked).toBe('******3210');
    });

    it('should strip leading 0 (11 digits)', () => {
      const res = validateIndianPhone('09876543210');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe('9876543210');
      expect(res.formattedE164).toBe('+919876543210');
    });

    it('should strip country code 91 (12 digits)', () => {
      const res = validateIndianPhone('919876543210');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe('9876543210');
      expect(res.formattedE164).toBe('+919876543210');
    });

    it('should reject numbers not starting with 6, 7, 8, or 9', () => {
      const res = validateIndianPhone('5556543210');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('must start with 6, 7, 8, or 9');
    });

    it('should reject repetitive identical digits', () => {
      const res = validateIndianPhone('9999999999');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('repetitive identical digits');
    });

    it('should reject incomplete numbers', () => {
      const res = validateIndianPhone('98765');
      expect(res.isValid).toBe(false);
    });

    it('should mask phone numbers for UI privacy', () => {
      expect(maskPhone('9876543210')).toBe('******3210');
      expect(maskPhone('')).toBe('******');
    });
  });

  // Test Scenario 3: Data Encryption & Decryption
  describe('Data Encryption & Decryption (AES-256)', () => {
    it('should encrypt and correctly decrypt phone numbers', () => {
      const original = '+919876543210';
      const encrypted = encryptText(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':');

      const decrypted = decryptText(encrypted);
      expect(decrypted).toBe(original);
    });
  });

  // Test Scenario 4: Template Interpolation Engine
  describe('Message Template Engine', () => {
    it('should interpolate placeholders {{parent_name}}, {{student_name}}, {{marks}}, {{total}}, etc.', () => {
      const template = 'Dear {{parent_name}}, ward {{student_name}} ({{register_number}}) scored {{total}}/{{maximum_marks}} ({{percentage}}%) in {{exam_name}}. Marks:\n{{marks}}\n— {{college_name}}';
      const rendered = renderTemplate(template, {
        parent_name: 'Mr. Ramesh',
        student_name: 'Aravind R',
        register_number: '922521104001',
        exam_name: 'Internal Assessment - II',
        total: 185,
        maximum_marks: 200,
        percentage: 92.5,
        marks: '• Data Structures: 95/100\n• Operating Systems: 90/100',
        college_name: 'V.S.B. Engineering College',
      });

      expect(rendered).toContain('Dear Mr. Ramesh');
      expect(rendered).toContain('Aravind R (922521104001)');
      expect(rendered).toContain('185/200 (92.5%) in Internal Assessment - II');
      expect(rendered).toContain('• Data Structures: 95/100');
      expect(rendered).toContain('— V.S.B. Engineering College');
    });

    it('should format subject mark entries cleanly', () => {
      const block = formatMarksBlock([
        { subjectName: 'DBMS', marksObtained: 88, maxMarks: 100 },
        { subjectName: 'Networks', marksObtained: 92, maxMarks: 100 },
      ]);
      expect(block).toBe('• DBMS: 88/100\n• Networks: 92/100');
    });

    it('should render multi-subject template with status and overall result', () => {
      const template = `{EXAM_NAME} RESULT

Dear Parent,

We are pleased to share the {EXAM_NAME} results of {STUDENT_NAME}  (Reg. No: {REGISTER_NUMBER}).

{SUBJECT_1}: {MARK_1}/100 – {STATUS_1}
{SUBJECT_2}: {MARK_2}/100 – {STATUS_2}
{SUBJECT_3}: {MARK_3}/100 – {STATUS_3}
{SUBJECT_4}: {MARK_4}/100 – {STATUS_4}
{SUBJECT_5}: {MARK_5}/100 – {STATUS_5}

Overall Result: {OVERALL_RESULT}

Thank you for your continued support.

Regards,
{COLLEGE_NAME}, Karur.`;

      const vars = {
        exam_name: 'INTERNAL ASSESSMENT - 1',
        student_name: 'Yuvanesh P',
        register_number: '927621BIT101',
        college_name: 'V.S.B. Engineering College',
        overall_result: 'PASS',
        subject_1: 'Computer Networks', mark_1: 88, status_1: 'Pass',
        subject_2: 'DBMS', mark_2: 92, status_2: 'Pass',
        subject_3: 'Operating Systems', mark_3: 79, status_3: 'Pass',
        subject_4: 'Data Structures', mark_4: 85, status_4: 'Pass',
        subject_5: 'Web Technology', mark_5: 90, status_5: 'Pass',
      };

      const rendered = renderTemplate(template, vars);
      expect(rendered).toContain('INTERNAL ASSESSMENT - 1 RESULT');
      expect(rendered).toContain('Yuvanesh P  (Reg. No: 927621BIT101)');
      expect(rendered).toContain('Computer Networks: 88/100 – Pass');
      expect(rendered).toContain('DBMS: 92/100 – Pass');
      expect(rendered).toContain('Overall Result: PASS');
      expect(rendered).toContain('V.S.B. Engineering College, Karur.');
    });
  });

  // Test Scenario 5: Intelligent Excel Header Auto-Detection
  describe('Excel Header Matching & Column Detection', () => {
    it('should auto-detect standard headers (Reg No, Student Name, Parent Mobile)', () => {
      const columns = ['S.No', 'Reg No', 'Student Name', 'Parent Mobile', 'CN', 'DBMS'];
      const mapping = excelService.detectColumnMapping(columns);

      expect(mapping.registerNumberCol).toBe('Reg No');
      expect(mapping.studentNameCol).toBe('Student Name');
      expect(mapping.parentMobileCol).toBe('Parent Mobile');
      expect(mapping.subjectCols['CN']).toBe('CN');
      expect(mapping.subjectCols['DBMS']).toBe('DBMS');
      expect(mapping.subjectCols['S.No']).toBeUndefined(); // S.No must be excluded
    });

    it('should auto-detect varied column header aliases', () => {
      const columns = ['Roll Number', 'Candidate Name', 'Guardian Mobile', 'Father Name', 'Java Programming', 'Data Structures'];
      const mapping = excelService.detectColumnMapping(columns);

      expect(mapping.registerNumberCol).toBe('Roll Number');
      expect(mapping.studentNameCol).toBe('Candidate Name');
      expect(mapping.parentMobileCol).toBe('Guardian Mobile');
      expect(mapping.parentNameCol).toBe('Father Name');
      expect(mapping.subjectCols['Java Programming']).toBe('Java Programming');
      expect(mapping.subjectCols['Data Structures']).toBe('Data Structures');
    });
  });

  // Test Scenario 6: Rigorous Excel Validation (12 Validation Rules)
  describe('Excel Validation Pipeline', () => {
    it('should detect duplicate register numbers, invalid mobile numbers, and out-of-range marks', () => {
      const testRows = [
        // Row 1: Valid
        {
          'Reg No': '922521104001',
          'Student Name': 'Student One',
          'Parent Mobile': '9876543210',
          'CN': 85,
          'DBMS': 90,
        },
        // Row 2: Duplicate Reg No & Invalid Phone
        {
          'Reg No': '922521104001', // duplicate!
          'Student Name': 'Student Two',
          'Parent Mobile': '12345', // invalid length!
          'CN': 70,
          'DBMS': 75,
        },
        // Row 3: Out-of-range mark (> 100) and Negative mark
        {
          'Reg No': '922521104003',
          'Student Name': 'Student Three',
          'Parent Mobile': '9123456789',
          'CN': 105, // exceeds 100!
          'DBMS': -5, // negative mark!
        },
        // Row 4: Missing Student Name
        {
          'Reg No': '922521104004',
          'Student Name': '', // missing!
          'Parent Mobile': '9988776655',
          'CN': 80,
          'DBMS': 85,
        },
      ];

      const mapping = {
        registerNumberCol: 'Reg No',
        studentNameCol: 'Student Name',
        parentMobileCol: 'Parent Mobile',
        subjectCols: { 'CN': 'CN', 'DBMS': 'DBMS' },
      };

      const result = excelService.validateRows(testRows, mapping, { 'CN': 100, 'DBMS': 100 });

      expect(result.totalRows).toBe(4);
      expect(result.validRows).toBe(1); // Only Row 1 is completely valid
      expect(result.errorRows).toBe(3); // Rows 2, 3, 4 have errors

      // Row 2 checks
      const row2 = result.rows[1];
      expect(row2.status).toBe('ERROR');
      expect(row2.issues.some(i => i.message.includes('Duplicate register number'))).toBe(true);
      expect(row2.issues.some(i => i.field === 'Parent Mobile')).toBe(true);

      // Row 3 checks
      const row3 = result.rows[2];
      expect(row3.status).toBe('ERROR');
      expect(row3.issues.some(i => i.message.includes('exceeds maximum allowed marks'))).toBe(true);
      expect(row3.issues.some(i => i.message.includes('cannot be negative'))).toBe(true);

      // Row 4 checks
      const row4 = result.rows[3];
      expect(row4.status).toBe('ERROR');
      expect(row4.issues.some(i => i.field === 'Student Name')).toBe(true);
    });

    it('should generate a downloadable CSV error report', () => {
      const testRows = [
        {
          'Reg No': '922521104001',
          'Student Name': '',
          'Parent Mobile': '9876543210',
          'CN': 85,
        },
      ];
      const mapping = {
        registerNumberCol: 'Reg No',
        studentNameCol: 'Student Name',
        parentMobileCol: 'Parent Mobile',
        subjectCols: { 'CN': 'CN' },
      };
      const result = excelService.validateRows(testRows, mapping);
      const csv = excelService.generateErrorReport(result);

      expect(csv).toContain('Row Number,Register Number,Student Name,Status,Field,Issue Description');
      expect(csv).toContain('Student name is missing');
    });
  });

  // Test Scenario 7: Mock Providers Safety
  describe('Mock Provider Safety & Simulation', () => {
    it('WhatsApp Mock Provider should simulate wamid and never call internet in mock mode', async () => {
      const res = await whatsAppProvider.sendMessage({
        recipient: '9876543210',
        messageText: 'Test WhatsApp message',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('SENT');
      expect(res.providerMessageId).toContain('wamid.HBgL');
      expect(res.rawResponse?.mock).toBe(true);
    });

    it('SMS Mock Provider should simulate SMS-MSG and never call internet in mock mode', async () => {
      const res = await smsProvider.sendMessage({
        recipient: '9876543210',
        messageText: 'Test SMS message',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('SENT');
      expect(res.providerMessageId).toContain('SMS-MSG-');
      expect(res.rawResponse?.mock).toBe(true);
    });
  });
});
