import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Check if search_index uses trigram
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='search_index'").get() as any;
const needsMigration = tableInfo && !tableInfo.sql.includes('trigram');

if (needsMigration) {
  db.exec('DROP TABLE IF EXISTS search_index');
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('A', 'B')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    pdf_url TEXT,
    ocr_text TEXT,
    answer_content TEXT,
    answer_image_url TEXT,
    answer_pdf_url TEXT,
    answer_ocr_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    parent_id TEXT,
    content TEXT,
    image_url TEXT,
    pdf_url TEXT,
    ocr_text TEXT,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  -- FTS5 Virtual Table for Full-Text Search
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type UNINDEXED, -- 'task', 'question', 'node'
    entity_id UNINDEXED,
    task_id UNINDEXED,
    subject_id UNINDEXED,
    content,
    ocr_text,
    tokenize='trigram'
  );

  -- Triggers to keep search_index updated
  -- Tasks
  CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content)
    VALUES ('task', new.id, new.id, new.subject_id, new.title);
  END;
  CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
    UPDATE search_index SET content = new.title WHERE entity_type = 'task' AND entity_id = new.id;
  END;
  CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = old.id;
  END;

  -- Questions
  CREATE TRIGGER IF NOT EXISTS questions_ai AFTER INSERT ON questions BEGIN
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content, ocr_text)
    SELECT 'question', new.id, new.task_id, tasks.subject_id,
           COALESCE(new.content, '') || ' ' || COALESCE(new.answer_content, ''),
           COALESCE(new.ocr_text, '') || ' ' || COALESCE(new.answer_ocr_text, '')
    FROM tasks WHERE tasks.id = new.task_id;
  END;
  CREATE TRIGGER IF NOT EXISTS questions_au AFTER UPDATE ON questions BEGIN
    UPDATE search_index SET
      content = COALESCE(new.content, '') || ' ' || COALESCE(new.answer_content, ''),
      ocr_text = COALESCE(new.ocr_text, '') || ' ' || COALESCE(new.answer_ocr_text, '')
    WHERE entity_type = 'question' AND entity_id = new.id;
  END;
  CREATE TRIGGER IF NOT EXISTS questions_ad AFTER DELETE ON questions BEGIN
    DELETE FROM search_index WHERE entity_type = 'question' AND entity_id = old.id;
  END;

  -- Nodes
  CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content, ocr_text)
    SELECT 'node', new.id, new.task_id, tasks.subject_id, new.content, new.ocr_text
    FROM tasks WHERE tasks.id = new.task_id;
  END;
  CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
    UPDATE search_index SET content = new.content, ocr_text = new.ocr_text
    WHERE entity_type = 'node' AND entity_id = new.id;
  END;
  CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
    DELETE FROM search_index WHERE entity_type = 'node' AND entity_id = old.id;
  END;
`);

// Seed initial subjects
const subjects = ['语文', '数学', '英语', '物理', '化学', '地理'];
const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (id, name) VALUES (?, ?)');
const getSubjects = db.prepare('SELECT * FROM subjects');

if (getSubjects.all().length === 0) {
  subjects.forEach((name, i) => {
    insertSubject.run(`sub_${i + 1}`, name);
  });
}

if (needsMigration) {
  console.log('Migrating search_index to use trigram tokenizer...');
  db.exec(`
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content)
    SELECT 'task', id, id, subject_id, title FROM tasks;
    
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content, ocr_text)
    SELECT 'question', questions.id, questions.task_id, tasks.subject_id,
           COALESCE(questions.content, '') || ' ' || COALESCE(questions.answer_content, ''),
           COALESCE(questions.ocr_text, '') || ' ' || COALESCE(questions.answer_ocr_text, '')
    FROM questions JOIN tasks ON questions.task_id = tasks.id;
    
    INSERT INTO search_index(entity_type, entity_id, task_id, subject_id, content, ocr_text)
    SELECT 'node', nodes.id, nodes.task_id, tasks.subject_id, nodes.content, nodes.ocr_text
    FROM nodes JOIN tasks ON nodes.task_id = tasks.id;
  `);
  console.log('Migration complete.');
}

export default db;
