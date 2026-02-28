import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import db from './src/db.ts';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for mobile access
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date();
    const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const uploadPath = path.join(process.cwd(), 'uploads', folder);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- API Routes ---

// Get all subjects
app.get('/api/subjects', (req, res) => {
  const subjects = db.prepare('SELECT * FROM subjects').all();
  res.json(subjects);
});

// Get tasks by subject
app.get('/api/subjects/:subjectId/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE subject_id = ? ORDER BY created_at DESC').all(req.params.subjectId);
  res.json(tasks);
});

// Create a task
app.post('/api/tasks', (req, res) => {
  const { subject_id, title, type } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO tasks (id, subject_id, title, type) VALUES (?, ?, ?, ?)').run(id, subject_id, title, type);
  res.json({ id, subject_id, title, type });
});

// Get a single task
app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(task);
});

// Get questions for a task (Type A)
app.get('/api/tasks/:taskId/questions', (req, res) => {
  const questions = db.prepare('SELECT * FROM questions WHERE task_id = ? ORDER BY created_at DESC').all(req.params.taskId);
  res.json(questions);
});

// Create a question
app.post('/api/questions', (req, res) => {
  const { task_id, content, image_url, pdf_url, ocr_text, answer_content, answer_image_url, answer_pdf_url, answer_ocr_text } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO questions (id, task_id, content, image_url, pdf_url, ocr_text, answer_content, answer_image_url, answer_pdf_url, answer_ocr_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, task_id, content, image_url, pdf_url, ocr_text, answer_content, answer_image_url, answer_pdf_url, answer_ocr_text);
  res.json({ id });
});

// Delete a question
app.delete('/api/questions/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get nodes for a task (Type B)
app.get('/api/tasks/:taskId/nodes', (req, res) => {
  const nodes = db.prepare('SELECT * FROM nodes WHERE task_id = ? ORDER BY parent_id, order_index').all(req.params.taskId);
  res.json(nodes);
});

// Create a node
app.post('/api/nodes', (req, res) => {
  const { task_id, parent_id, content, image_url, pdf_url, ocr_text, order_index } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO nodes (id, task_id, parent_id, content, image_url, pdf_url, ocr_text, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, task_id, parent_id || null, content, image_url, pdf_url, ocr_text, order_index || 0);
  res.json({ id });
});

// Update a node
app.put('/api/nodes/:id', (req, res) => {
  const { content, image_url, pdf_url, ocr_text } = req.body;
  db.prepare(`
    UPDATE nodes SET content = ?, image_url = ?, pdf_url = ?, ocr_text = ? WHERE id = ?
  `).run(content, image_url, pdf_url, ocr_text, req.params.id);
  res.json({ success: true });
});

// Delete a node
app.delete('/api/nodes/:id', (req, res) => {
  db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const date = new Date();
  const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const relativeUrl = `/uploads/${folder}/${req.file.filename}`;
  res.json({ url: relativeUrl });
});

// Search endpoint
app.get('/api/search', (req, res) => {
  const { q, subject_id } = req.query;
  if (!q) return res.json([]);

  // Use FTS5 snippet for highlighting
  let query = `
    SELECT 
      rowid, entity_type, entity_id, task_id, subject_id,
      snippet(search_index, 4, '<mark>', '</mark>', '...', 64) as content_snippet,
      snippet(search_index, 5, '<mark>', '</mark>', '...', 64) as ocr_snippet
    FROM search_index 
    WHERE search_index MATCH ?
  `;
  // For trigram, we just need the exact phrase wrapped in quotes
  const params: any[] = [`"${q}"`];

  if (subject_id) {
    query += ' AND subject_id = ?';
    params.push(subject_id);
  }

  query += ' ORDER BY rank LIMIT 50';

  try {
    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Search failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
