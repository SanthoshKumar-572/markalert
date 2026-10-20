import { db } from '../database/db';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export const rawStudentList = [
  { sNo: 1, name: 'Priyanka M.K', regNo: '922524205125', phone: '8940915396' },
  { sNo: 2, name: 'Ragul R', regNo: '922524205126', phone: '6381598068' },
  { sNo: 3, name: 'Rajasaranya S', regNo: '922524205127', phone: '7397021477' },
  { sNo: 4, name: 'Rajavarman R A', regNo: '922524205128', phone: '9789826387' },
  { sNo: 5, name: 'Ramakrishnan M', regNo: '922524205129', phone: '9025535278' },
  { sNo: 6, name: 'Ramkishore S.M', regNo: '922524205130', phone: '8778764551' },
  { sNo: 7, name: 'Ranjanidevi R', regNo: '922524205131', phone: '9360729633' },
  { sNo: 8, name: 'Ranjith Kumar S', regNo: '922524205132', phone: '8056656387' },
  { sNo: 9, name: 'Rankanayaki V', regNo: '922524205133', phone: '9655211440' },
  { sNo: 10, name: 'Rifa Nowreen Nathar E.M', regNo: '922524205134', phone: '6381504697' },
  { sNo: 11, name: 'Ritheeshver G', regNo: '922524205135', phone: '9597671107' },
  { sNo: 12, name: 'Rohithsharma M', regNo: '922524205136', phone: '6374995334' },
  { sNo: 13, name: 'Roshan Safiha B', regNo: '922524205137', phone: '9597597426' },
  { sNo: 14, name: 'Sabari Vasan S', regNo: '922524205138', phone: '8015365439' },
  { sNo: 15, name: 'Sabitha P', regNo: '922524205139', phone: '8778527209' },
  { sNo: 16, name: 'Sakthivel S', regNo: '922524205140', phone: '9442183290' },
  { sNo: 17, name: 'Saleth Josela A', regNo: '922524205141', phone: '9790210183' },
  { sNo: 18, name: 'Sanjay K', regNo: '922524205142', phone: '9345787220' },
  { sNo: 19, name: 'Sanjay S', regNo: '922524205143', phone: '9489841868' },
  { sNo: 20, name: 'Sanjeevani M M', regNo: '922524205144', phone: '9003459989' },
  { sNo: 21, name: 'Santhiya B K', regNo: '922524205145', phone: '9080751908' },
  { sNo: 22, name: 'Santhoshkumar R', regNo: '922524205146', phone: '6383474523' },
  { sNo: 23, name: 'Santhosh S', regNo: '922524205147', phone: '8807854679' },
  { sNo: 24, name: 'Santhoshkumar S', regNo: '922524205148', phone: '9487528706' },
  { sNo: 25, name: 'Saravanan P', regNo: '922524205149', phone: '8072117461' },
  { sNo: 26, name: 'Sarmila V', regNo: '922524205150', phone: '9344812750' },
  { sNo: 27, name: 'Sathish Kumar P', regNo: '922524205151', phone: '9345782544' },
  { sNo: 28, name: 'Selvaraj D', regNo: '922524205152', phone: '6381273534' },
  { sNo: 29, name: 'Sharuprakash P', regNo: '922524205153', phone: '9363980381' },
  { sNo: 30, name: 'Shrinithi V', regNo: '922524205154', phone: '9159742474' },
  { sNo: 31, name: 'Sivaprasanth S', regNo: '922524205155', phone: '8248367978' },
  { sNo: 32, name: 'Srijanani P', regNo: '922524205156', phone: '9363308718' },
  { sNo: 33, name: 'Srinidi R', regNo: '922524205157', phone: '7708697023' },
  { sNo: 34, name: 'Suji M', regNo: '922524205159', phone: '9344547989' },
  { sNo: 35, name: 'Sujith R', regNo: '922524205160', phone: '6385220810' },
  { sNo: 36, name: 'Supreya M K', regNo: '922524205161', phone: '9655279272' },
  { sNo: 37, name: 'Suriyapriya V', regNo: '922524205162', phone: '9597742637' },
  { sNo: 38, name: 'Suvathi N', regNo: '922524205163', phone: '6369371391' },
  { sNo: 39, name: 'Swathi C', regNo: '922524205164', phone: '6380646845' },
  { sNo: 40, name: 'Swathi R', regNo: '922524205165', phone: '9363621521' },
  { sNo: 41, name: 'Swethaa V', regNo: '922524205166', phone: '9080278197' },
  { sNo: 42, name: 'Tarun Karthick G', regNo: '922524205167', phone: '9788882442' },
  { sNo: 43, name: 'Thamilnesan I', regNo: '922524205168', phone: '6383094190' },
  { sNo: 44, name: 'Tharani T', regNo: '922524205170', phone: '9500313240' },
  { sNo: 46, name: 'Tharunkumar K', regNo: '922524205171', phone: '8760964830' },
  { sNo: 47, name: 'Theerthagiri J', regNo: '922524205172', phone: '9159895331' },
  { sNo: 48, name: 'Thiruvasagam V', regNo: '922524205173', phone: '8248385411' },
  { sNo: 49, name: 'Vanitha M', regNo: '922524205174', phone: '8610967540' },
  { sNo: 50, name: 'Varsha S', regNo: '922524205175', phone: '8610344144' },
  { sNo: 51, name: 'Varsheni T', regNo: '922524205176', phone: '8838798298' },
  { sNo: 52, name: 'Varshini S S', regNo: '922524205177', phone: '9486546552' },
  { sNo: 53, name: 'Vikash S', regNo: '922524205178', phone: '9345352504' },
  { sNo: 54, name: 'Vishalini B', regNo: '922524205179', phone: '9488727640' },
  { sNo: 55, name: 'Yamuna E', regNo: '922524205180', phone: '6380458603' },
  { sNo: 56, name: 'Yogadharshini S', regNo: '922524205181', phone: '8248407545' },
  { sNo: 57, name: 'Yogesh R', regNo: '922524205182', phone: '7339108816' },
  { sNo: 58, name: 'Yuvanesh P', regNo: '922524205183', phone: '6379988358' },
  { sNo: 59, name: 'Yuvansankar K', regNo: '922524205184', phone: '7904379985' },
  { sNo: 60, name: 'Srilekha S.C', regNo: '922524205185', phone: '9789882471' },
  { sNo: 61, name: 'Nadar Prakash Shivahakthivel S', regNo: '922524205303', phone: '7710946257' }
];

export async function importStudentListToDatabase() {
  console.log('[Import] Initializing database connection...');
  await db.init();

  const classId = 'class-it-c';
  const deptId = 'dept-it';
  const year = '3';
  const section = 'C';
  const academicYear = '2026-27';

  // Ensure IT Department & Class IT-A exist
  const deptExists = await db.queryOne('SELECT id FROM departments WHERE id = ?', [deptId]);
  if (!deptExists) {
    await db.execute('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)', [deptId, 'Information Technology', 'IT']);
  }

  const classExists = await db.queryOne('SELECT id FROM classes WHERE id = ?', [classId]);
  if (!classExists) {
    await db.execute(
      'INSERT INTO classes (id, name, department_id, year, semester, section, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [classId, 'IT-A', deptId, year, '5', section, academicYear]
    );
  }

  let insertedCount = 0;
  let updatedCount = 0;

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
      insertedCount++;
    } else {
      await db.execute(
        `UPDATE students SET name = ?, parent_name = ?, parent_phone = ?, class_id = ?, department_id = ?, section = ?, year = ?
         WHERE register_number = ?`,
        [std.name, parentName, cleanPhone, classId, deptId, section, year, std.regNo]
      );

      await db.execute(
        `UPDATE parents SET parent_name = ?, mobile_number = ?, whatsapp_number = ? WHERE student_id = ?`,
        [parentName, cleanPhone, cleanPhone, existingStd.id]
      );
      updatedCount++;
    }
  }

  console.log(`[Import] Completed! Inserted: ${insertedCount}, Updated: ${updatedCount} out of ${rawStudentList.length} students into Class IT-A.`);

  // Also create an Excel roster sheet in sample_files
  const sampleDir = path.resolve(process.cwd(), 'sample_files');
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }

  // 1. Roster Excel
  const rosterData = rawStudentList.map(s => ({
    'Register Number': s.regNo,
    'Student Name': s.name,
    'Parent Name': `${s.name}'s Parent`,
    'Parent Mobile': s.phone
  }));
  const wsRoster = XLSX.utils.json_to_sheet(rosterData);
  const wbRoster = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbRoster, wsRoster, 'IT_A_Students');
  XLSX.writeFile(wbRoster, path.join(sampleDir, 'IT_A_61_Students_Roster.xlsx'));

  // 2. Marks Excel Template for IT-A (DBMS, Java, CN, DSA)
  const marksData = rawStudentList.map((s, idx) => ({
    'Register Number': s.regNo,
    'Student Name': s.name,
    'DBMS': 75 + (idx % 25),
    'Java': 70 + ((idx * 3) % 30),
    'CN': 68 + ((idx * 7) % 32),
    'DSA': 80 + ((idx * 5) % 20)
  }));
  const wsMarks = XLSX.utils.json_to_sheet(marksData);
  const wbMarks = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbMarks, wsMarks, 'IT_A_Internal_Marks');
  XLSX.writeFile(wbMarks, path.join(sampleDir, 'IT_A_Internal_Marks_61_Students.xlsx'));

  console.log('[Import] Generated Excel sample files:');
  console.log(' - sample_files/IT_A_61_Students_Roster.xlsx');
  console.log(' - sample_files/IT_A_Internal_Marks_61_Students.xlsx');
}

if (require.main === module) {
  importStudentListToDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Import Fatal Error]:', err);
      process.exit(1);
    });
}
