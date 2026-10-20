import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/college_sms.sqlite');

const SQL = await initSqlJs();
const buf = fs.readFileSync(dbPath);
const db = new SQL.Database(buf);

// Check existing departments
const existing = db.exec('SELECT id, name, code FROM departments');
console.log('Existing departments:', JSON.stringify(existing));

// Check if CSE already exists
const cseCheck = db.exec("SELECT * FROM departments WHERE code = 'CSE'");
if (cseCheck.length > 0 && cseCheck[0].values.length > 0) {
  console.log('CSE already exists!');
} else {
  db.run("INSERT INTO departments (id, name, code) VALUES ('dept-cse', 'Computer Science and Engineering', 'CSE')");
  console.log('CSE department inserted!');
}

// Save back
const data = db.export();
fs.writeFileSync(dbPath, Buffer.from(data));
console.log('Database saved successfully.');
db.close();
