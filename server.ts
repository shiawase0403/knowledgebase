import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import db from './src/db.ts';
import crypto from 'crypto';
import sharp from 'sharp';

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
    const uploadPath = path.join(process.cwd(), 'data', 'uploads', folder);
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
app.use('/uploads', express.static(path.join(process.cwd(), 'data', 'uploads')));

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
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const date = new Date();
  const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const relativeUrl = `/uploads/${folder}/${req.file.filename}`;

  // Generate thumbnail if it's an image
  if (req.file.mimetype.startsWith('image/')) {
    try {
      const ext = path.extname(req.file.filename);
      const baseName = path.basename(req.file.filename, ext);
      const thumbFilename = `${baseName}-thumb${ext}`;
      const thumbPath = path.join(req.file.destination, thumbFilename);
      
      await sharp(req.file.path)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .toFile(thumbPath);
    } catch (e) {
      console.error('Thumbnail generation failed:', e);
    }
  }

  res.json({ url: relativeUrl });
});

// Search endpoint
app.get('/api/search', (req, res) => {
  const { q, subject_id } = req.query;
  if (!q) return res.json([]);

  const keyword = String(q);
  const searchPattern = `%${keyword}%`;
  const subj = subject_id ? String(subject_id) : null;

  // Abandon FTS5 tokenization. Use pure LIKE for exact substring matching across all text fields.
  const query = `
    SELECT 'task' as entity_type, id as entity_id, id as task_id, subject_id, 
           title as task_title, title as content_raw, NULL as ocr_raw, NULL as image_url
    FROM tasks
    WHERE title LIKE ? AND (? IS NULL OR subject_id = ?)
    
    UNION ALL
    
    SELECT 'question' as entity_type, q.id as entity_id, q.task_id, t.subject_id, 
           t.title as task_title, 
           COALESCE(q.content, '') || ' ' || COALESCE(q.answer_content, '') as content_raw, 
           COALESCE(q.ocr_text, '') || ' ' || COALESCE(q.answer_ocr_text, '') as ocr_raw, 
           q.image_url
    FROM questions q
    JOIN tasks t ON q.task_id = t.id
    WHERE (q.content LIKE ? OR q.ocr_text LIKE ? OR q.answer_content LIKE ? OR q.answer_ocr_text LIKE ?)
      AND (? IS NULL OR t.subject_id = ?)
      
    UNION ALL
    
    SELECT 'node' as entity_type, n.id as entity_id, n.task_id, t.subject_id, 
           t.title as task_title, n.content as content_raw, n.ocr_text as ocr_raw, n.image_url
    FROM nodes n
    JOIN tasks t ON n.task_id = t.id
    WHERE (n.content LIKE ? OR n.ocr_text LIKE ?)
      AND (? IS NULL OR t.subject_id = ?)
      
    LIMIT 50
  `;

  try {
    const rawResults = db.prepare(query).all(
      searchPattern, subj, subj,
      searchPattern, searchPattern, searchPattern, searchPattern, subj, subj,
      searchPattern, searchPattern, subj, subj
    );

    // Simple JS highlighter since we dropped FTS5
    const highlight = (text: string | null, kw: string) => {
      if (!text) return null;
      const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedKeyword = kw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      const regex = new RegExp(`(${escapedKeyword})`, 'gi');
      const matchIndex = escapedText.search(regex);
      
      if (matchIndex === -1) {
        return escapedText.length > 60 ? escapedText.substring(0, 60) + '...' : escapedText;
      }
      
      const start = Math.max(0, matchIndex - 30);
      const end = Math.min(escapedText.length, matchIndex + kw.length + 30);
      let snippet = escapedText.substring(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < escapedText.length) snippet = snippet + '...';
      
      return snippet.replace(regex, '<mark>$1</mark>');
    };

    const results = rawResults.map((r: any) => ({
      rowid: r.entity_id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      task_id: r.task_id,
      subject_id: r.subject_id,
      task_title: r.task_title,
      image_url: r.image_url,
      content_snippet: highlight(r.content_raw, keyword),
      ocr_snippet: highlight(r.ocr_raw, keyword)
    }));

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
