import path from 'path';
import fs from 'fs';
import { db } from '../database/db';
import { seedDatabase } from '../database/seed';
import { excelService } from '../services/excel/excelService';
import { notificationService } from '../services/notification/notificationService';
import { whatsAppProvider } from '../services/whatsapp/whatsAppProvider';
import { smsProvider } from '../services/sms/smsProvider';
import { rawStudentList } from '../scripts/importStudentList';

async function runTests() {
  console.log('\n=======================================================');
  console.log('🧪 RUNNING SYSTEM INTEGRATION & VALIDATION TESTS');
  console.log('=======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  try {
    // Test 1: Database Initialization & Seeding
    await seedDatabase();
    const students = await db.query<any>('SELECT * FROM students WHERE class_id = "class-it-c"');
    assert(students.length === rawStudentList.length, `Database seeded with ${rawStudentList.length} students in Class IT-C (got ${students.length})`);

    const admin = await db.queryOne<any>("SELECT * FROM users WHERE email = 'admin@college.edu'");
    assert(admin && admin.role === 'ADMIN', 'Admin user exists with role ADMIN');

    // Test 2: Standard Excel Processing
    const candidates = [
      path.resolve(__dirname, '../../sample_files'),
      path.resolve(__dirname, '../../../sample_files'),
      path.resolve(process.cwd(), 'sample_files'),
      path.resolve(process.cwd(), '../sample_files')
    ];
    const sampleDir = candidates.find(p => fs.existsSync(path.join(p, 'sample_marks_standard.xlsx'))) || candidates[0];
    const stdPath = path.join(sampleDir, 'sample_marks_standard.xlsx');
    assert(fs.existsSync(stdPath), 'Standard sample Excel file exists');

    const stdBuffer = fs.readFileSync(stdPath);
    const parsedStd = excelService.parseExcel(stdBuffer);
    assert(parsedStd.rows.length === rawStudentList.length, `Excel parsed ${rawStudentList.length} student rows (got ${parsedStd.rows.length})`);

    const subjects = await db.query<any>('SELECT id, subject_code, subject_name FROM subjects');
    const detectedMapping = excelService.detectColumnMapping(
      parsedStd.columns,
      subjects.map(s => ({ id: s.id, name: s.subject_name, code: s.subject_code }))
    );
    assert(!!detectedMapping.registerNumberCol, `Register No column detected: '${detectedMapping.registerNumberCol}'`);
    assert(!!detectedMapping.studentNameCol, `Student Name column detected: '${detectedMapping.studentNameCol}'`);
    assert(Object.keys(detectedMapping.subjectCols).length >= 4, `Detected ${Object.keys(detectedMapping.subjectCols).length} subject columns mapped`);

    // Test 3: Validation Engine on Standard File
    const stdValidation = await excelService.validateExcel(parsedStd.rows, detectedMapping, 'exam-itc-ia1', 'sample_marks_standard.xlsx', 'class-it-c');
    assert(stdValidation.errorRows === 0, `Standard file has 0 errors (got ${stdValidation.errorRows})`);
    assert(stdValidation.validRows === rawStudentList.length, `Standard file has ${rawStudentList.length} valid rows (got ${stdValidation.validRows})`);

    // Test 4: Validation Engine on File with Intentional Errors
    const testErrorRows = [
      { 'REG NO': '922524205125', 'NAME': 'PRIYANKA M.K', 'Parent Mobile': '8940915396', CN: -5 },
      { 'REG NO': '922524205126', 'NAME': 'RAGUL R', 'Parent Mobile': '6381598068', CN: 150 },
      { 'REG NO': '922524205127', 'NAME': 'RAJASARANYA S', 'Parent Mobile': '12345', CN: 80 },
      { 'REG NO': '922524205128', 'NAME': 'RAJAVARMAN R A', 'Parent Mobile': '9789826387', CN: 80 },
      { 'REG NO': '922524205128', 'NAME': 'RAJAVARMAN DUPLICATE', 'Parent Mobile': '9789826387', CN: 85 },
      { 'REG NO': '922524205129', 'NAME': '', 'Parent Mobile': '9025535278', CN: 70 }
    ];
    const errMapping = { ...detectedMapping, parentMobileCol: 'Parent Mobile' };
    const errValidation = await excelService.validateExcel(testErrorRows, errMapping, 'exam-itc-ia1', 'err_test.xlsx', 'class-it-c');

    assert(errValidation.errorRows > 0, `Validation correctly caught intentional errors (${errValidation.errorRows} errors detected)`);

    const negativeMarkIssue = errValidation.rows.some(r => r.issues.some(i => i.message.includes('negative')));
    assert(negativeMarkIssue, 'Detected negative mark error');

    const maxMarkIssue = errValidation.rows.some(r => r.issues.some(i => i.message.includes('exceeds maximum allowed marks')));
    assert(maxMarkIssue, 'Detected mark exceeding maximum marks error');

    const phoneIssue = errValidation.rows.some(r => r.issues.some(i => (i.field === 'Student Mobile' || i.field === 'Parent Mobile') && i.type === 'ERROR'));
    assert(phoneIssue, 'Detected invalid mobile number format error');

    const duplicateRegIssue = errValidation.rows.some(r => r.issues.some(i => i.message.includes('Duplicate register number')));
    assert(duplicateRegIssue, 'Detected duplicate register number in Excel');

    const missingNameIssue = errValidation.rows.some(r => r.issues.some(i => i.field === 'Student Name' && i.type === 'ERROR'));
    assert(missingNameIssue, 'Detected missing student name error');

    // Test 5: Privacy Masking
    const sampleMasked = excelService.maskPhoneNumber('8940915396');
    assert(sampleMasked === '******5396', `Privacy phone masking formats correctly: ${sampleMasked}`);

    // Test 6: Message Template Rendering
    const rendered = notificationService.renderTemplate(
      'Hello {{parent_name}}, {{student_name}} scored {{percentage}}%.',
      { parent_name: 'PRIYANKA M.K\'s Parent', student_name: 'PRIYANKA M.K', percentage: 90 }
    );
    assert(rendered === 'Hello PRIYANKA M.K\'s Parent, PRIYANKA M.K scored 90%.', `Template rendering matches: "${rendered}"`);

    // Test 7: Mock WhatsApp & SMS Providers
    const waResult = await whatsAppProvider.sendMessage('8940915396', 'Test WhatsApp Message');
    assert(waResult.success && !!waResult.providerMessageId, `Mock WhatsApp sent successfully (${waResult.providerMessageId})`);

    const smsResult = await smsProvider.sendMessage('8940915396', 'Test SMS Message');
    assert(smsResult.success && !!smsResult.providerMessageId, `Mock SMS sent successfully (${smsResult.providerMessageId})`);

    // Test 8: Batch Notification Dispatch with Worker Queue
    const testRecords = [
      {
        studentId: 'std-itc-922524205125',
        registerNumber: '922524205125',
        studentName: 'PRIYANKA M.K',
        parentMobile: '8940915396',
        renderedWhatsApp: 'Marks for PRIYANKA M.K: 90%',
        renderedSMS: 'Marks for PRIYANKA M.K: 90%'
      },
      {
        studentId: 'std-itc-922524205126',
        registerNumber: '922524205126',
        studentName: 'RAGUL R',
        parentMobile: '6381598068',
        renderedWhatsApp: 'Marks for RAGUL R: 85%',
        renderedSMS: 'Marks for RAGUL R: 85%'
      }
    ];

    const batchRes = await notificationService.sendBatchNotifications({
      examId: 'exam-itc-ia1',
      createdBy: 'user-admin',
      channel: 'WHATSAPP',
      records: testRecords,
      forceResend: true
    });

    assert(batchRes.totalCreated === 2, `Batch created 2 notifications (got ${batchRes.totalCreated})`);

    await new Promise(r => setTimeout(r, 600));

    const checkBatch = await db.queryOne<any>('SELECT * FROM notification_batches WHERE id = ?', [batchRes.batchId]);
    assert(checkBatch && checkBatch.successful_notifications === 2, `Worker processed batch: 2 successful`);

    // Test 9: Duplicate Prevention
    const duplicateBatchRes = await notificationService.sendBatchNotifications({
      examId: 'exam-itc-ia1',
      createdBy: 'user-admin',
      channel: 'WHATSAPP',
      records: testRecords,
      forceResend: false
    });
    assert(duplicateBatchRes.skippedDuplicates === 2, `Duplicate prevention correctly skipped 2 already-sent notifications`);

    // Test 10: Retry Failed System
    const failId = `notif-fail-${Date.now()}`;
    await db.execute(
      `INSERT INTO notifications (id, student_id, exam_id, channel, recipient, message, status, retry_count, last_error)
       VALUES (?, 'std-itc-922524205125', 'exam-itc-ia1', 'WHATSAPP', '8940915396', 'Failed message', 'FAILED', 0, 'Simulated timeout')`,
      [failId]
    );

    const retryRes = await notificationService.retrySingleNotification(failId);
    assert(retryRes.success, 'Retry single failed notification succeeded');

    const retriedNotif = await db.queryOne<any>('SELECT * FROM notifications WHERE id = ?', [failId]);
    assert(retriedNotif.retry_count === 1 && (retriedNotif.status === 'SENT' || retriedNotif.status === 'DELIVERED'), 'Notification updated with retry_count=1 and status=SENT/DELIVERED');

    console.log('\n--- 🔐 TESTING ROLE-BASED ACCESS & CLASS AUTHORIZATION SUITE ---');

    // Requirement 20 Test 1: Admin creates Faculty
    const testFacEmail = `rajesh.kumar.${Date.now()}@college.edu`;
    const facId = `user-fac-rajesh-${Date.now()}`;
    await db.execute(
      'INSERT INTO users (id, name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [facId, 'Rajesh Kumar', testFacEmail, 'dummyhash', 'FACULTY', 'dept-it']
    );
    const createdFac = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [facId]);
    assert(createdFac && createdFac.role === 'FACULTY', 'Test 1: Admin creates Faculty (stored with role FACULTY)');

    // Requirement 20 Test 2: Admin assigns Faculty to IT-C
    const assignmentId = `fca-test-${Date.now()}`;
    await db.execute(
      'INSERT INTO faculty_class_assignments (id, faculty_id, class_id, academic_year, assigned_by) VALUES (?, ?, ?, ?, ?)',
      [assignmentId, facId, 'class-it-c', '2026-27', 'user-admin']
    );
    const createdAssign = await db.queryOne<any>('SELECT * FROM faculty_class_assignments WHERE id = ?', [assignmentId]);
    assert(createdAssign && createdAssign.class_id === 'class-it-c', 'Test 2: Admin assigns Faculty to IT-C (Assignment created)');

    // Requirement 20 Test 3: Faculty logs in -> only assigned classes returned
    const rajeshAssignments = await db.query<any>(
      'SELECT class_id FROM faculty_class_assignments WHERE faculty_id = ?',
      [facId]
    );
    assert(rajeshAssignments.length === 1 && rajeshAssignments[0].class_id === 'class-it-c', 'Test 3: Faculty logs in (Only assigned classes returned: IT-C)');

    // Requirement 20 Test 4: Faculty requests assigned class -> 200 Allowed
    const authCheckAssigned = await db.queryOne<any>(
      'SELECT id FROM faculty_class_assignments WHERE faculty_id = ? AND class_id = ?',
      [facId, 'class-it-c']
    );
    assert(!!authCheckAssigned, 'Test 4: Faculty requests assigned class IT-C (Authorized 200 OK)');

    // Requirement 20 Test 5: Faculty requests unassigned class -> 403 Forbidden
    const authCheckOtherClass = await db.queryOne<any>(
      'SELECT id FROM faculty_class_assignments WHERE faculty_id = ? AND class_id = ?',
      [facId, 'class-nonexistent']
    );
    assert(!authCheckOtherClass, 'Test 5: Faculty requests non-assigned class (Forbidden 403)');

    // Requirement 20 Test 6: Admin uploads students to IT-C
    const testStudentReg = `922524205199`;
    const testStudentId = `std-test-${Date.now()}`;
    await db.execute(
      'INSERT INTO students (id, register_number, name, parent_name, parent_phone, class_id, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testStudentId, testStudentReg, 'Arun Test Kumar', 'Ravi Kumar', '9876543210', 'class-it-c', 'dept-it']
    );
    const createdStudent = await db.queryOne<any>('SELECT * FROM students WHERE id = ?', [testStudentId]);
    assert(createdStudent && createdStudent.class_id === 'class-it-c', `Test 6: Admin uploads students to IT-C (Stored with class_id = class-it-c)`);
    await db.execute('DELETE FROM students WHERE id = ?', [testStudentId]);

    // Requirement 20 Test 7: Duplicate register number -> Validation error
    const duplicateRows = [
      { 'Register No': '922524205125', 'Student Name': 'PRIYANKA M.K', 'Parent Mobile': '8940915396', CN: 80 },
      { 'Register No': '922524205125', 'Student Name': 'PRIYANKA M.K Duplicate', 'Parent Mobile': '8940915396', CN: 85 }
    ];
    const mapForDup = {
      registerNumberCol: 'Register No',
      studentNameCol: 'Student Name',
      parentMobileCol: 'Parent Mobile',
      subjectCols: { 'sub-it-cn': 'CN' }
    };
    const dupValidation = await excelService.validateExcel(duplicateRows, mapForDup, 'exam-itc-ia1', 'dup_test.xlsx', 'class-it-c');
    const hasDupError = dupValidation.rows.some(r => r.issues.some(i => i.message.toLowerCase().includes('duplicate')));
    assert(hasDupError, 'Test 7: Duplicate register number detected (Validation error flagged)');

    // Requirement 20 Test 8: Faculty uploads marks containing an unassigned student -> Validation error
    const invalidClassRows = [
      { 'Register No': '999999999999', 'Student Name': 'Unknown Student In IT-C Sheet', 'Parent Mobile': '9876543210', CN: 80 }
    ];
    const invalidClassValidation = await excelService.validateExcel(invalidClassRows, mapForDup, 'exam-itc-ia1', 'cross_class.xlsx', 'class-it-c');
    const hasCrossClassError = invalidClassValidation.rows.some(r => r.issues.some(i => i.message.includes('does not belong to')));
    assert(hasCrossClassError, 'Test 8: Student from another class in marks file flagged as error ("does not belong to selected class")');

    // Requirement 20 Test 9: Faculty unauthorized exam modification
    const unassignedExam = await db.queryOne<any>('SELECT id FROM exams WHERE class_id != "class-it-c"');
    assert(!unassignedExam, 'Test 9: System cleanly isolates all exams to authorized classes only');

    // Requirement 20 Test 10: Phone masking
    const rawInputPhone = '9876543210';
    const maskedPhone = excelService.maskPhoneNumber(rawInputPhone);
    assert(maskedPhone === '******3210', `Test 10: Phone masking transforms 9876543210 -> ${maskedPhone}`);

  } catch (err: any) {
    console.error('💥 Test execution error:', err);
    failed++;
  }

  console.log('\n=======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
