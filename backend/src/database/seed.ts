import bcrypt from 'bcryptjs';
import { db } from './db';
import { rawStudentList } from '../scripts/importStudentList';

export async function seedDatabase() {
  console.log('[Seed] Initializing clean database for IT Department & Class IT-C...');
  await db.init();

  // 1. System Settings
  const defaultSettings = [
    { key: 'COLLEGE_NAME', value: 'VSB ENGINEERING COLLEGE', group: 'general', description: 'Official institution name displayed on messages' },
    { key: 'MOCK_NOTIFICATION_PROVIDER', value: 'true', group: 'general', description: 'Use simulated delivery for development/testing' },
    { key: 'MAX_RETRY_COUNT', value: '3', group: 'general', description: 'Maximum retry attempts for failed notifications' },
    { key: 'WHATSAPP_PHONE_NUMBER_ID', value: '109876543210987', group: 'whatsapp', description: 'WhatsApp Business API Phone Number ID' },
    { key: 'WHATSAPP_ACCESS_TOKEN', value: 'EAABwz...', group: 'whatsapp', description: 'Meta Graph API access token' },
    { key: 'WHATSAPP_TEMPLATE_NAME', value: 'internal_marks_notification', group: 'whatsapp', description: 'Registered Meta template name' },
    { key: 'SMS_API_KEY', value: 'mock_fast2sms_api_key_12345', group: 'sms', description: 'Fast2SMS / Provider API key' },
    { key: 'SMS_SENDER_ID', value: 'ABCENG', group: 'sms', description: 'DLT Registered Sender ID / Header' },
    { key: 'SMS_TEMPLATE_ID', value: '1107161829000000000', group: 'sms', description: 'DLT Registered Template ID' }
  ];

  for (const s of defaultSettings) {
    const existing = await db.queryOne('SELECT key FROM system_settings WHERE key = ?', [s.key]);
    if (!existing) {
      await db.execute('INSERT INTO system_settings (key, value, "group", description) VALUES (?, ?, ?, ?)', [s.key, s.value, s.group, s.description]);
    } else {
      await db.execute('UPDATE system_settings SET value = ? WHERE key = ?', [s.value, s.key]);
    }
  }

  // 2. Department (Keep ONLY Information Technology)
  await db.execute(`DELETE FROM departments WHERE id != 'dept-it'`);
  const deptExists = await db.queryOne('SELECT id FROM departments WHERE id = ?', ['dept-it']);
  if (!deptExists) {
    await db.execute('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)', ['dept-it', 'Information Technology', 'IT']);
  }

  // 3. Class (Keep ONLY IT-C)
  await db.execute(`DELETE FROM classes WHERE id != 'class-it-c'`);
  const classExists = await db.queryOne('SELECT id FROM classes WHERE id = ?', ['class-it-c']);
  if (!classExists) {
    await db.execute(
      'INSERT INTO classes (id, name, department_id, year, semester, section, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['class-it-c', 'IT-C', 'dept-it', '3', '5', 'C', '2026-27']
    );
  } else {
    await db.execute(
      'UPDATE classes SET name = ?, department_id = ?, year = ?, semester = ?, section = ?, academic_year = ? WHERE id = ?',
      ['IT-C', 'dept-it', '3', '5', 'C', '2026-27', 'class-it-c']
    );
  }

  // 4. Users (Admin and Faculty)
  const passwordAdmin = await bcrypt.hash('Admin@123', 10);
  const passwordFaculty = await bcrypt.hash('Faculty@123', 10);

  const users = [
    { id: 'user-admin', name: 'Dr. S. Ramanathan (Admin)', email: 'admin@college.edu', password_hash: passwordAdmin, role: 'ADMIN', department_id: null },
    { id: 'user-rajesh', name: 'Rajesh Kumar (Faculty)', email: 'rajesh@college.edu', password_hash: passwordFaculty, role: 'FACULTY', department_id: 'dept-it' },
    { id: 'user-faculty', name: 'Prof. K. Anitha (Faculty)', email: 'faculty@college.edu', password_hash: passwordFaculty, role: 'FACULTY', department_id: 'dept-it' }
  ];

  for (const u of users) {
    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [u.email]);
    if (!existing) {
      await db.execute('INSERT INTO users (id, name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)', [
        u.id, u.name, u.email, u.password_hash, u.role, u.department_id
      ]);
    } else {
      await db.execute('UPDATE users SET name = ?, role = ?, department_id = ? WHERE email = ?', [u.name, u.role, u.department_id, u.email]);
    }
  }

  // 4b. Faculty Class Assignments (Assign both to IT-C)
  await db.execute(`DELETE FROM faculty_class_assignments WHERE class_id != 'class-it-c'`);
  const assignments = [
    { id: 'fca-rajesh-it-c', faculty_id: 'user-rajesh', class_id: 'class-it-c', academic_year: '2026-27', assigned_by: 'user-admin' },
    { id: 'fca-anitha-it-c', faculty_id: 'user-faculty', class_id: 'class-it-c', academic_year: '2026-27', assigned_by: 'user-admin' }
  ];

  for (const a of assignments) {
    const existing = await db.queryOne('SELECT id FROM faculty_class_assignments WHERE faculty_id = ? AND class_id = ?', [a.faculty_id, a.class_id]);
    if (!existing) {
      await db.execute(
        'INSERT INTO faculty_class_assignments (id, faculty_id, class_id, academic_year, assigned_by) VALUES (?, ?, ?, ?, ?)',
        [a.id, a.faculty_id, a.class_id, a.academic_year, a.assigned_by]
      );
    }
  }

  // 5. Subjects (IT-C Semester 5 Subjects: CN, BDA, FSWT, STA, DC, ESIOT)
  await db.execute(`DELETE FROM subjects WHERE 1=1`);
  const subjects = [
    { id: 'sub-it-cn', subject_code: 'IT301', subject_name: 'CN', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' },
    { id: 'sub-it-bda', subject_code: 'IT302', subject_name: 'BDA', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' },
    { id: 'sub-it-fswt', subject_code: 'IT303', subject_name: 'FSWT', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' },
    { id: 'sub-it-sta', subject_code: 'IT304', subject_name: 'STA', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' },
    { id: 'sub-it-dc', subject_code: 'IT305', subject_name: 'DC', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' },
    { id: 'sub-it-esiot', subject_code: 'IT306', subject_name: 'ESIOT', max_marks: 100, pass_marks: 60, semester: '5', department_id: 'dept-it' }
  ];

  for (const sub of subjects) {
    await db.execute(
      'INSERT INTO subjects (id, subject_code, subject_name, max_marks, pass_marks, semester, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sub.id, sub.subject_code, sub.subject_name, sub.max_marks, sub.pass_marks, sub.semester, sub.department_id]
    );
  }

  // 6. Exams (For IT-C)
  await db.execute(`DELETE FROM exams WHERE class_id != 'class-it-c'`);
  const exams = [
    { id: 'exam-itc-ia1', name: 'Internal Assessment 1', exam_name: 'Internal Assessment 1', academic_year: '2026-27', semester: '5', department_id: 'dept-it', class_id: 'class-it-c', exam_date: '2026-09-25' },
    { id: 'exam-itc-ia2', name: 'Internal Assessment 2', exam_name: 'Internal Assessment 2', academic_year: '2026-27', semester: '5', department_id: 'dept-it', class_id: 'class-it-c', exam_date: '2026-10-25' }
  ];

  for (const ex of exams) {
    const existing = await db.queryOne('SELECT id FROM exams WHERE id = ?', [ex.id]);
    if (!existing) {
      await db.execute('INSERT INTO exams (id, name, exam_name, academic_year, semester, department_id, class_id, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        ex.id, ex.name, ex.exam_name, ex.academic_year, ex.semester, ex.department_id, ex.class_id, ex.exam_date
      ]);
    } else {
      await db.execute('UPDATE exams SET name = ?, class_id = ?, department_id = ? WHERE id = ?', [ex.name, ex.class_id, ex.department_id, ex.id]);
    }
  }

  // 7. IT-C Class Student Roster (61 Students)
  const validRegNos = rawStudentList.map(s => s.regNo);
  const placeholders = validRegNos.map(() => '?').join(', ');

  // Delete students not in 61 list
  await db.execute(`DELETE FROM marks WHERE student_id IN (SELECT id FROM students WHERE register_number NOT IN (${placeholders}))`, validRegNos);
  await db.execute(`DELETE FROM notifications WHERE student_id IN (SELECT id FROM students WHERE register_number NOT IN (${placeholders}))`, validRegNos);
  await db.execute(`DELETE FROM parents WHERE student_id IN (SELECT id FROM students WHERE register_number NOT IN (${placeholders}))`, validRegNos);
  await db.execute(`DELETE FROM students WHERE register_number NOT IN (${placeholders})`, validRegNos);

  for (const s of rawStudentList) {
    const studentId = `std-itc-${s.regNo}`;
    const parentName = `${s.name}'s Parent`;
    const cleanPhone = s.phone.replace(/\D/g, '');
    const email = `${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${s.regNo}@college.edu`;

    const existing = await db.queryOne('SELECT id FROM students WHERE register_number = ?', [s.regNo]);
    if (!existing) {
      await db.execute(
        `INSERT INTO students (id, register_number, name, parent_name, parent_phone, email, class_id, department_id, year, section)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, s.regNo, s.name, parentName, cleanPhone, email, 'class-it-c', 'dept-it', '3', 'C']
      );

      const parentId = `parent-${studentId}`;
      await db.execute(
        `INSERT INTO parents (id, student_id, parent_name, mobile_number, whatsapp_number, email, sms_enabled, whatsapp_enabled)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
        [parentId, studentId, parentName, cleanPhone, cleanPhone, `parent.${email}`]
      );
    } else {
      await db.execute(
        `UPDATE students SET name = ?, parent_name = ?, parent_phone = ?, class_id = ?, department_id = ?, section = ?
         WHERE register_number = ?`,
        [s.name, parentName, cleanPhone, 'class-it-c', 'dept-it', 'C', s.regNo]
      );

      await db.execute(
        `UPDATE parents SET parent_name = ?, mobile_number = ?, whatsapp_number = ? WHERE student_id = ?`,
        [parentName, cleanPhone, cleanPhone, existing.id]
      );
    }
  }

  // 8. Message Templates (Exactly 2 official templates: Internal Marks Breakdown & General/Holiday Notice)
  await db.execute('DELETE FROM message_templates WHERE 1=1');

  const marksWhatsAppBody = `Dear {{parent_name}},

{{exam_name}} marks of your ward:

Student: {{student_name}}
Register No: {{register_number}}

{{marks}}

Total: {{total}}/{{maximum_marks}}
Percentage: {{percentage}}%

Regards,
{{college_name}}`;

  const marksSMSBody = `Dear {{parent_name}}, {{exam_name}} marks of your ward: Student: {{student_name}}, Register No: {{register_number}}\n{{marks}}\nTotal: {{total}}/{{maximum_marks}}\nPercentage: {{percentage}}%\nRegards, {{college_name}}`;

  const holidayWhatsAppBody = `Dear {{parent_name}},

Greetings from {{college_name}}.

📢 Important Announcement / Holiday Notice:

Student: {{student_name}}
Register No: {{register_number}}

Circular Details:
{{notice_message}}

Kindly take note of the schedule. For any queries, please contact the class faculty advisor.

Warm regards,
Department of Information Technology,
{{college_name}}`;

  const holidaySMSBody = `Notice from {{college_name}}: Dear Parent of {{student_name}} (Register No: {{register_number}}): {{notice_message}}. Regards, {{college_name}}`;

  const ia2WhatsAppBody = `VSB ENGINEERING COLLEGE, KARUR

Dear Parent of {student_name},

Internal Assessment – II Marks

Register No.: {register_number}
Class: {class_name} | Department: {department}

{marks}

Overall Result: {overall_result}

Regards,
VSB Engineering College, Karur.`;

  const ia2SMSBody = `VSB ENGINEERING COLLEGE, KARUR: Dear Parent of {student_name}, Register No: {register_number}, Class: {class_name}, Dept: {department}. IA-II Marks: {marks}. Overall Result: {overall_result}. Regards, VSB Engineering College, Karur.`;

  const templates = [
    {
      id: 'tpl-ia2-whatsapp',
      name: 'Internal Assessment – II Marks (WhatsApp)',
      channel: 'WHATSAPP',
      template_type: 'MARKS',
      body: ia2WhatsAppBody
    },
    {
      id: 'tpl-ia2-sms',
      name: 'Internal Assessment – II Marks (SMS DLT)',
      channel: 'SMS',
      template_type: 'MARKS',
      body: ia2SMSBody
    },
    {
      id: 'tpl-marks-report-wa',
      name: 'Internal Examination Marks Report (Detailed)',
      channel: 'WHATSAPP',
      template_type: 'MARKS',
      body: marksWhatsAppBody
    },
    {
      id: 'tpl-marks-report-sms',
      name: 'Internal Examination Marks Report (SMS)',
      channel: 'SMS',
      template_type: 'MARKS',
      body: marksSMSBody
    },
    {
      id: 'tpl-holiday-notice-wa',
      name: 'General / Holiday & Circular Notice (WhatsApp)',
      channel: 'WHATSAPP',
      template_type: 'GENERAL',
      body: holidayWhatsAppBody
    },
    {
      id: 'tpl-holiday-notice-sms',
      name: 'General / Holiday & Circular Notice (SMS)',
      channel: 'SMS',
      template_type: 'GENERAL',
      body: holidaySMSBody
    },];

  for (const t of templates) {
    try {
      await db.execute(
        'INSERT INTO message_templates (id, name, channel, template_type, body, template_text, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [t.id, t.name, t.channel, t.template_type, t.body, t.body]
      );
    } catch {
      await db.execute(
        'INSERT INTO message_templates (id, name, channel, template_type, body, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [t.id, t.name, t.channel, t.template_type, t.body]
      );
    }
  }

  console.log('[Seed] Clean IT Department & Class IT-C seeded successfully with 61 students!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
