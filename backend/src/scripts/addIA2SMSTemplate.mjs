import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/college_sms.sqlite');

const SQL = await initSqlJs();
const buf = fs.readFileSync(dbPath);
const db = new SQL.Database(buf);

const id = 'tpl-ia2-sms';
const name = 'Internal Assessment – II Marks (SMS DLT)';
const channel = 'SMS';
const template_type = 'MARKS';

const body = `VSB ENGINEERING COLLEGE: Dear Parent/Guardian of {student_name}, Register No: {register_number}, Dept: {department}, Class: {class_name}. IA-II Marks: {subject1_name}: {subject1_marks} ({subject1_result}), {subject2_name}: {subject2_marks} ({subject2_result}), {subject3_name}: {subject3_marks} ({subject3_result}), {subject4_name}: {subject4_marks} ({subject4_result}), {subject5_name}: {subject5_marks} ({subject5_result}), {subject6_name}: {subject6_marks} ({subject6_result}). Overall Result: {overall_result}. Regards, VSB Engineering College`;

// Check if already exists
const existing = db.exec(`SELECT id FROM message_templates WHERE id = '${id}'`);
if (existing.length > 0 && existing[0].values.length > 0) {
  console.log('Template already exists, updating...');
  db.run(
    `UPDATE message_templates SET name = ?, body = ?, template_text = ?, channel = ?, template_type = ?, is_active = 1 WHERE id = ?`,
    [name, body, body, channel, template_type, id]
  );
} else {
  db.run(
    `INSERT INTO message_templates (id, name, channel, template_type, body, template_text, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, name, channel, template_type, body, body]
  );
  console.log('Template inserted!');
}

const data = db.export();
fs.writeFileSync(dbPath, Buffer.from(data));
console.log('Database saved with tpl-ia2-sms.');
db.close();
