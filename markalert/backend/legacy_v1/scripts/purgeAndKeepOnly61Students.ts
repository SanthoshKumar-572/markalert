import { db } from '../database/db';
import { rawStudentList } from './importStudentList';

export async function purgeAndKeepOnly61Students() {
  console.log('[Purge] Connecting to database...');
  await db.init();

  const validRegNos = rawStudentList.map(s => s.regNo);
  const placeholders = validRegNos.map(() => '?').join(', ');

  console.log(`[Purge] Keeping only ${validRegNos.length} valid students (${validRegNos[0]} to ${validRegNos[validRegNos.length - 1]})...`);

  // 1. Delete marks of students not in the 61 list
  await db.execute(
    `DELETE FROM marks WHERE student_id IN (
      SELECT id FROM students WHERE register_number NOT IN (${placeholders})
    )`,
    validRegNos
  );

  // 2. Delete notifications of students not in the 61 list
  await db.execute(
    `DELETE FROM notifications WHERE student_id IN (
      SELECT id FROM students WHERE register_number NOT IN (${placeholders})
    )`,
    validRegNos
  );

  // 3. Delete parents of students not in the 61 list
  await db.execute(
    `DELETE FROM parents WHERE student_id IN (
      SELECT id FROM students WHERE register_number NOT IN (${placeholders})
    )`,
    validRegNos
  );

  // 4. Delete students not in the 61 list
  await db.execute(
    `DELETE FROM students WHERE register_number NOT IN (${placeholders})`,
    validRegNos
  );

  // 5. Ensure all students exist with their exact details in Class IT-C
  const classId = 'class-it-c';
  const deptId = 'dept-it';
  const year = '3';
  const section = 'C';

  for (const std of rawStudentList) {
    const studentId = `std-it-${std.regNo}`;
    const parentName = `${std.name}'s Parent`;
    const cleanPhone = std.phone.replace(/\D/g, '');
    const email = `${std.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${std.regNo}@college.edu`;

    const existingStd = await db.queryOne('SELECT id FROM students WHERE register_number = ?', [std.regNo]);
    if (!existingStd) {
      await db.execute(
        `INSERT INTO students (id, register_number, name, parent_name, parent_phone, email, class_id, department_id, year, section)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, std.regNo, std.name, parentName, cleanPhone, email, classId, deptId, year, section]
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
        [std.name, parentName, cleanPhone, classId, deptId, section, std.regNo]
      );
    }
  }

  // Count remaining students
  const remainingStudents = await db.query<any>('SELECT id, register_number, name, parent_phone, class_id FROM students ORDER BY register_number ASC');
  console.log(`[Purge] Successfully completed! Total students in database: ${remainingStudents.length}`);
  console.log(`First 3 students:`, remainingStudents.slice(0, 3).map(s => `${s.register_number} - ${s.name} (${s.parent_phone})`));
  console.log(`Last student:`, remainingStudents[remainingStudents.length - 1]?.register_number, remainingStudents[remainingStudents.length - 1]?.name);
}

if (require.main === module) {
  purgeAndKeepOnly61Students()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Purge Error]:', err);
      process.exit(1);
    });
}
