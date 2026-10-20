import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';
import { MongoClient, Db as MongoDatabase } from 'mongodb';

// Ensure DNS resolution succeeds for MongoDB Atlas SRV records on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

dotenv.config();

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

const KNOWN_TABLES = [
  'departments',
  'classes',
  'users',
  'faculty_class_assignments',
  'students',
  'parents',
  'subjects',
  'exams',
  'marks',
  'uploaded_files',
  'notification_batches',
  'notifications',
  'audit_logs',
  'message_templates',
  'system_settings'
];

class DatabaseManager {
  private pgPool: Pool | null = null;
  private sqliteDb: SqlJsDatabase | null = null;
  private sqliteFilePath: string = '';
  private isPostgres: boolean = false;
  private isInitialized: boolean = false;

  // MongoDB Atlas Integration
  private mongoClient: MongoClient | null = null;
  private mongoDb: MongoDatabase | null = null;
  private isMongoConnected: boolean = false;
  private syncTimeouts: Map<string, NodeJS.Timeout> = new Map();

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/college_sms.sqlite';

    // 1. Connect to MongoDB Atlas if URI is provided
    if (mongoUri) {
      try {
        console.log('[DB] Connecting to MongoDB Atlas...');
        this.mongoClient = new MongoClient(mongoUri);
        await this.mongoClient.connect();

        let dbName = 'collegesms';
        try {
          const parsed = new URL(mongoUri);
          const pathname = parsed.pathname.replace(/^\//, '').split('?')[0];
          if (pathname) dbName = pathname;
        } catch (_) {}

        this.mongoDb = this.mongoClient.db(dbName);
        this.isMongoConnected = true;
        console.log(`[DB] Connected to MongoDB Atlas successfully (Database: ${dbName}).`);
      } catch (err: any) {
        console.warn('[DB] MongoDB Atlas connection warning:', err.message);
      }
    }

    // 2. PostgreSQL Check (if configured)
    if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
      try {
        this.pgPool = new Pool({ connectionString: dbUrl });
        await this.pgPool.query('SELECT 1');
        this.isPostgres = true;
        console.log('[DB] Connected to PostgreSQL successfully.');
        await this.runMigrations();
        this.isInitialized = true;
        return;
      } catch (err: any) {
        console.warn('[DB] Could not connect to PostgreSQL:', err.message);
      }
    }

    // 3. Initialize SQL Engine (sql.js in-memory database with MongoDB / File persistence)
    const SQL = await initSqlJs();
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.sqliteFilePath = path.resolve(dataDir, 'college_sms.sqlite');

    // Create fresh in-memory SQLite database
    this.sqliteDb = new SQL.Database();
    this.isPostgres = false;
    await this.runMigrations();

    // 4. Hydrate from MongoDB Atlas or fallback to local SQLite file
    let hasLoadedFromMongo = false;
    if (this.isMongoConnected && this.mongoDb) {
      hasLoadedFromMongo = await this.loadFromMongo();
    }

    if (!hasLoadedFromMongo && fs.existsSync(this.sqliteFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(this.sqliteFilePath);
        const diskDb = new SQL.Database(fileBuffer);
        this.sqliteDb = diskDb;
        console.log(`[DB] Loaded SQLite database from local file ${this.sqliteFilePath}`);

        // If MongoDB is connected and empty, seed MongoDB Atlas with existing local data
        if (this.isMongoConnected && this.mongoDb) {
          console.log('[DB] Seeding MongoDB Atlas with initial data from local SQLite file...');
          await this.flushAllTablesToMongo();
        }
      } catch (err: any) {
        console.warn('[DB] Could not load local SQLite file:', err.message);
      }
    }

    this.saveSqlite();
    this.isInitialized = true;
  }

  // Load records from MongoDB Atlas collections into the in-memory database
  private async loadFromMongo(): Promise<boolean> {
    if (!this.isMongoConnected || !this.mongoDb || !this.sqliteDb) return false;

    try {
      let totalDocuments = 0;
      for (const table of KNOWN_TABLES) {
        const collection = this.mongoDb.collection(table);
        const docs = await collection.find({}).toArray();

        if (docs.length > 0) {
          totalDocuments += docs.length;
          const tableCols = (this.sqliteDb.exec(`PRAGMA table_info("${table}")`)[0]?.values || []).map(row => row[1] as string);

          for (const doc of docs) {
            const cleanDoc: Record<string, any> = { ...doc };
            if (!cleanDoc.id && cleanDoc._id && typeof cleanDoc._id === 'string') {
              cleanDoc.id = cleanDoc._id;
            }
            delete cleanDoc._id;

            const validKeys = Object.keys(cleanDoc).filter(k => tableCols.includes(k));
            if (validKeys.length === 0) continue;

            const cols = validKeys.map(k => `"${k}"`).join(',');
            const placeholders = validKeys.map(() => '?').join(',');
            const values = validKeys.map(k => cleanDoc[k]);

            const sql = `INSERT OR REPLACE INTO "${table}" (${cols}) VALUES (${placeholders})`;
            try {
              this.sqliteDb.run(sql, values);
            } catch (err: any) {
              console.warn(`[DB] Could not insert doc into ${table}:`, err.message);
            }
          }
          console.log(`[DB] Loaded ${docs.length} records for '${table}' from MongoDB Atlas.`);
        }
      }

      if (totalDocuments > 0) {
        console.log(`[DB] Total ${totalDocuments} documents loaded from MongoDB Atlas.`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('[DB] Error loading data from MongoDB Atlas:', err.message);
      return false;
    }
  }

  // Save in-memory SQLite state to disk as local backup
  private saveSqlite(): void {
    if (this.sqliteDb && this.sqliteFilePath) {
      try {
        const data = this.sqliteDb.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.sqliteFilePath, buffer);
      } catch (err: any) {
        console.warn('[DB] Could not save SQLite backup:', err.message);
      }
    }
  }

  // Synchronize a specific table to MongoDB Atlas
  public async syncTableToMongo(table: string): Promise<void> {
    if (!this.isMongoConnected || !this.mongoDb || !this.sqliteDb) return;
    try {
      const collection = this.mongoDb.collection(table);
      const rows = await this.query(`SELECT * FROM "${table}"`);

      if (rows.length === 0) {
        await collection.deleteMany({});
        return;
      }

      const validIds: any[] = [];
      const bulkOps: any[] = [];

      for (const r of rows) {
        const docId = r.id || r.key;
        if (docId) validIds.push(docId);

        bulkOps.push({
          replaceOne: {
            filter: { _id: docId || r },
            replacement: { _id: docId, ...r },
            upsert: true
          }
        });
      }

      if (validIds.length > 0) {
        bulkOps.push({
          deleteMany: {
            filter: { _id: { $nin: validIds } }
          }
        });
      }

      await collection.bulkWrite(bulkOps, { ordered: false });
      this.saveSqlite();
    } catch (err: any) {
      console.error(`[DB] Sync error for table '${table}' to MongoDB:`, err.message);
    }
  }

  // Flush all known tables to MongoDB Atlas
  public async flushAllTablesToMongo(): Promise<void> {
    for (const table of KNOWN_TABLES) {
      await this.syncTableToMongo(table);
    }
  }

  // Debounced table sync to prevent excessive network calls during batch writes
  public scheduleTableSync(table: string): void {
    if (!this.isMongoConnected || !this.mongoDb) return;

    const existing = this.syncTimeouts.get(table);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      try {
        await this.syncTableToMongo(table);
      } catch (err: any) {
        console.error(`[DB] Background sync failed for '${table}':`, err.message);
      } finally {
        this.syncTimeouts.delete(table);
      }
    }, 100);

    this.syncTimeouts.set(table, timeout);
  }

  private async runMigrations(): Promise<void> {
    if (this.isPostgres && this.pgPool) {
      const schemaPath = path.resolve(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await this.pgPool.query(sql);
      }
    } else if (this.sqliteDb) {
      const sqliteSchema = `
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS classes (
          id TEXT PRIMARY KEY,
          name TEXT,
          department_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
          year TEXT NOT NULL,
          semester TEXT,
          section TEXT NOT NULL,
          academic_year TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('ADMIN', 'FACULTY')),
          department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS faculty_class_assignments (
          id TEXT PRIMARY KEY,
          faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          academic_year TEXT,
          assigned_at TEXT DEFAULT (datetime('now')),
          assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE(faculty_id, class_id, academic_year)
        );

        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          register_number TEXT NOT NULL,
          name TEXT NOT NULL,
          parent_name TEXT,
          parent_phone TEXT,
          email TEXT,
          class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
          department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
          year TEXT,
          section TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS parents (
          id TEXT PRIMARY KEY,
          student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
          parent_name TEXT NOT NULL,
          mobile_number TEXT NOT NULL,
          whatsapp_number TEXT,
          email TEXT,
          sms_enabled INTEGER DEFAULT 1,
          whatsapp_enabled INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          subject_code TEXT UNIQUE NOT NULL,
          subject_name TEXT NOT NULL,
          max_marks REAL DEFAULT 20.0,
          pass_marks REAL DEFAULT 10.0,
          semester TEXT DEFAULT '3',
          department_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS exams (
          id TEXT PRIMARY KEY,
          name TEXT,
          exam_name TEXT NOT NULL,
          academic_year TEXT NOT NULL,
          semester TEXT NOT NULL,
          department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
          class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          exam_date TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS marks (
          id TEXT PRIMARY KEY,
          exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
          student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
          subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
          marks_obtained REAL NOT NULL,
          max_marks REAL NOT NULL,
          source_file TEXT,
          entered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(student_id, subject_id, exam_id)
        );

        CREATE TABLE IF NOT EXISTS uploaded_files (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          total_rows INTEGER DEFAULT 0,
          valid_rows INTEGER DEFAULT 0,
          error_rows INTEGER DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('UPLOADED', 'VALIDATED', 'PROCESSED', 'FAILED')),
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notification_batches (
          id TEXT PRIMARY KEY,
          exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
          uploaded_file_id TEXT REFERENCES uploaded_files(id) ON DELETE SET NULL,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          total_notifications INTEGER DEFAULT 0,
          successful_notifications INTEGER DEFAULT 0,
          failed_notifications INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'PROCESSING',
          created_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          batch_id TEXT REFERENCES notification_batches(id) ON DELETE SET NULL,
          student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
          exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
          channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'SMS')),
          recipient TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING')),
          provider_message_id TEXT,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          last_retry_at TEXT,
          sent_at TEXT,
          delivered_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          details TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS message_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          channel TEXT NOT NULL DEFAULT 'WHATSAPP',
          template_type TEXT NOT NULL DEFAULT 'MARKS',
          template_text TEXT,
          body TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT '',
          "group" TEXT DEFAULT 'general',
          description TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `;
      this.sqliteDb.run(sqliteSchema);

      // Safe column additions for SQLite if database already existed
      const safeAlters = [
        'ALTER TABLE system_settings ADD COLUMN "group" TEXT DEFAULT \'general\'',
        'ALTER TABLE message_templates ADD COLUMN template_type TEXT DEFAULT \'MARKS\'',
        'ALTER TABLE message_templates ADD COLUMN body TEXT',
        'ALTER TABLE message_templates ADD COLUMN template_text TEXT',
        'ALTER TABLE subjects ADD COLUMN pass_marks REAL DEFAULT 10.0',
        'ALTER TABLE subjects ADD COLUMN semester TEXT DEFAULT \'3\'',
        'ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1',
        'ALTER TABLE classes ADD COLUMN name TEXT',
        'ALTER TABLE classes ADD COLUMN semester TEXT',
        'ALTER TABLE students ADD COLUMN parent_name TEXT',
        'ALTER TABLE students ADD COLUMN parent_phone TEXT',
        'ALTER TABLE exams ADD COLUMN name TEXT',
        'ALTER TABLE exams ADD COLUMN department_id TEXT',
        'ALTER TABLE exams ADD COLUMN class_id TEXT',
        'ALTER TABLE exams ADD COLUMN created_by TEXT',
        'ALTER TABLE audit_logs ADD COLUMN entity_type TEXT'
      ];

      for (const alter of safeAlters) {
        try {
          this.sqliteDb.run(alter);
        } catch (_) {}
      }

      this.saveSqlite();
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.init();

    if (this.isPostgres && this.pgPool) {
      let pgSql = sql;
      if (sql.includes('?')) {
        let index = 1;
        pgSql = sql.replace(/\?/g, () => `$${index++}`);
      }
      const res = await this.pgPool.query(pgSql, params);
      return res.rows as T[];
    } else if (this.sqliteDb) {
      let sqliteSql = sql;
      if (/\$\d+/.test(sql)) {
        sqliteSql = sql.replace(/\$\d+/g, '?');
      }

      try {
        const stmt = this.sqliteDb.prepare(sqliteSql);
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T);
        }
        stmt.free();
        return rows;
      } catch (err: any) {
        console.error(`[DB Query Error] SQL: ${sqliteSql}`, err);
        throw err;
      }
    }

    throw new Error('Database is not initialized');
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
    await this.init();

    if (this.isPostgres && this.pgPool) {
      let pgSql = sql;
      if (sql.includes('?')) {
        let index = 1;
        pgSql = sql.replace(/\?/g, () => `$${index++}`);
      }
      const res = await this.pgPool.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    } else if (this.sqliteDb) {
      let sqliteSql = sql;
      if (/\$\d+/.test(sql)) {
        sqliteSql = sql.replace(/\$\d+/g, '?');
      }

      try {
        this.sqliteDb.run(sqliteSql, params);
        const changes = this.sqliteDb.getRowsModified();
        this.saveSqlite();

        // Detect modified table to schedule MongoDB Atlas synchronization
        const tableMatch = sql.match(/(?:INSERT\s+(?:OR\s+REPLACE\s+)?INTO|UPDATE|DELETE\s+FROM)\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
        if (tableMatch && tableMatch[1]) {
          const tableName = tableMatch[1].toLowerCase();
          if (KNOWN_TABLES.includes(tableName)) {
            this.scheduleTableSync(tableName);
          }
        }

        return { changes };
      } catch (err: any) {
        console.error(`[DB Execute Error] SQL: ${sqliteSql}`, err);
        throw err;
      }
    }

    throw new Error('Database is not initialized');
  }

  public async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.query<T>(sql, params);
  }

  public async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return this.queryOne<T>(sql, params);
  }

  public async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
    return this.execute(sql, params);
  }

  // Getters for direct MongoDB access if needed
  public getMongoDb(): MongoDatabase | null {
    return this.mongoDb;
  }

  public getMongoClient(): MongoClient | null {
    return this.mongoClient;
  }

  public isMongo(): boolean {
    return this.isMongoConnected;
  }

  // Gracefully flush pending syncs and close connections
  public async close(): Promise<void> {
    for (const [table, timeout] of this.syncTimeouts.entries()) {
      clearTimeout(timeout);
      await this.syncTableToMongo(table);
    }
    this.syncTimeouts.clear();

    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.mongoDb = null;
      this.isMongoConnected = false;
    }

    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
  }
}

export const db = new DatabaseManager();
