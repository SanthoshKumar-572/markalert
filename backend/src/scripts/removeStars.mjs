import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('backend/data/college_sms.sqlite');
console.log('Opening database:', dbPath);

const SQL = await initSqlJs();
const fileBuffer = fs.readFileSync(dbPath);
const db = new SQL.Database(fileBuffer);

const cleanTemplate = `VSB ENGINEERING COLLEGE

Dear Parent/Guardian of {student_name},

Internal Assessment – II Marks

Register No.: {register_number}
Department: {department}
Class: {class_name}

Subject-wise Marks (Out of 100):
• {subject1_name}: {subject1_marks}/100 – {subject1_result}
• {subject2_name}: {subject2_marks}/100 – {subject2_result}
• {subject3_name}: {subject3_marks}/100 – {subject3_result}
• {subject4_name}: {subject4_marks}/100 – {subject4_result}
• {subject5_name}: {subject5_marks}/100 – {subject5_result}
• {subject6_name}: {subject6_marks}/100 – {subject6_result}

Overall Result: {overall_result}

Regards,
VSB Engineering College`;

db.run(
  `UPDATE message_templates SET body = ?, template_text = ? WHERE id = 'tpl-ia2-whatsapp'`,
  [cleanTemplate, cleanTemplate]
);

// Strip all ** from any template
const res = db.exec(`SELECT id, body, template_text FROM message_templates`);
if (res.length > 0) {
  for (const row of res[0].values) {
    const id = row[0];
    const body = (row[1] || '').replace(/\*\*/g, '');
    const tplText = (row[2] || '').replace(/\*\*/g, '');
    db.run(
      `UPDATE message_templates SET body = ?, template_text = ? WHERE id = ?`,
      [body, tplText, id]
    );
  }
}

const data = db.export();
fs.writeFileSync(dbPath, Buffer.from(data));

console.log('Successfully stripped all stars (**) from templates in SQLite database!');
