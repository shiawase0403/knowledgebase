import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import db from './src/db.ts';
import crypto from 'crypto';
import sharp from 'sharp';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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
const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const date = new Date();
    const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const uploadPath = path.join(dataDir, 'uploads', folder);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(dataDir, 'uploads')));

// --- API Routes ---

// AI Paper Recognition
app.post('/api/ai/recognize-paper', upload.array('images'), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

  const sendEvent = (event: string, data: any) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let rawResponses: string[] = [];
  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
    console.log('Client disconnected from recognize-paper stream');
  });

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const glmApiKey = process.env.GLM_API_KEY;
    
    if (!geminiApiKey && !glmApiKey) {
      sendEvent('error', { error: '未配置任何 AI API Key。请在环境变量中设置 GEMINI_API_KEY 或 GLM_API_KEY。' });
      return res.end();
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      sendEvent('error', { error: 'No images uploaded.' });
      return res.end();
    }

    const { strategy, aiModel, userInstruction } = req.body; // strategy: 'extract', 'generate', 'blank', aiModel: 'gemini', 'glm'
    
    // Read structure.md
    const structurePath = path.resolve(process.cwd(), 'structure.md');
    let structureContent = '';
    if (fs.existsSync(structurePath)) {
      structureContent = fs.readFileSync(structurePath, 'utf-8');
    }

    // Prepare prompt
    let strategyPrompt = '';
    if (strategy === 'extract') {
      strategyPrompt = '请注意，用户要求你根据图片内容提取答案。如果图片中有答案，请将其填入 correct_options 和 answer_content 中。';
    } else if (strategy === 'generate') {
      strategyPrompt = '用户要求你利用自身知识为每道题生成详细解析和答案。请将答案填入 correct_options 和 answer_content 中。';
    } else {
      strategyPrompt = '用户要求将答案字段留空。请不要填写 correct_options 和 answer_content。';
    }

    if (userInstruction && typeof userInstruction === 'string' && userInstruction.trim()) {
      strategyPrompt += `\n\n【用户额外指令（高优先级）】：${userInstruction.trim()}。请务必遵守此指令，如果与上述策略冲突，以此指令为准。`;
    }

    const systemPrompt = `你是一个资深的教育教研专家和数据结构化工程师。你的任务是精准提取试卷图片中的题目，并严格按照我提供的 JSON 格式输出。

【核心指令】：
1. **仔细阅读材料**：请先完整阅读并理解图片中的所有文字和布局信息。
2. **分析题型结构**：在开始提取之前，请先思考并识别这张试卷的整体题型分布（如单选、填空、解答题等）以及题目之间的层级关系。
3. **LaTeX 格式**：所有的数学公式、物理符号、化学方程式等必须使用 LaTeX 格式输出。
4. **公式规范**：LaTeX 公式内部**严禁包含多余的空格**（例如：应输出 $x^2$ 而不是 $x ^ 2$）。
5. **忠于原件**：不要遗漏任何信息，也不要捏造图片中不存在的内容。

你必须严格遵守以下 JSON 结构：
${structureContent}

${strategyPrompt}

请直接输出一个 JSON 数组，不要包含任何 Markdown 标记（如 \`\`\`json ），也不要包含任何其他解释性文字。必须保证 JSON 格式完全合法。`;

    const allParsedData: any[] = [];

    // Process images one by one to avoid token limits and payload size limits
    for (const file of files) {
      if (isAborted) break;
      
      // Resize and compress image using sharp to save tokens and avoid payload limit
      const imageBuffer = await sharp(file.path)
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const base64Image = imageBuffer.toString('base64');
      let aiText = '';

      if (aiModel === 'gemini') {
        if (!geminiApiKey) {
          sendEvent('error', { error: '未配置 GEMINI_API_KEY，无法使用 Gemini 模型。请在环境变量中设置。' });
          return res.end();
        }
        // Use Gemini API (Preferred for long context)
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const imagePart = {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          };
          const textPart = {
            text: systemPrompt
          };
          
          const responseStream = await ai.models.generateContentStream({
            model: "gemini-3.1-pro-preview",
            contents: { parts: [imagePart, textPart] },
            config: {
              temperature: 0.1,
              thinkingConfig: strategy === 'generate' ? undefined : { thinkingLevel: ThinkingLevel.LOW }
            }
          });
          
          for await (const chunk of responseStream) {
            if (isAborted) break;
            const text = chunk.text;
            if (text) {
              aiText += text;
              sendEvent('chunk', { text });
            }
          }
        } catch (error: any) {
          console.error('Gemini API Error:', error);
          sendEvent('error', { error: 'Gemini AI recognition failed.', details: error.message || String(error) });
          return res.end();
        }
      } else {
        if (!glmApiKey) {
          sendEvent('error', { error: '未配置 GLM_API_KEY，无法使用智谱 GLM 模型。请在环境变量中设置。' });
          return res.end();
        }
        // Fallback to GLM API
        const messagesContent: any[] = [
          {
            type: 'text',
            text: systemPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ];

        try {
          const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${glmApiKey}`
            },
            body: JSON.stringify({
              model: 'glm-4v-plus', // Use latest and faster vision model
              messages: [
                {
                  role: 'user',
                  content: messagesContent
                }
              ],
              temperature: 0.1, 
              top_p: 0.7,
              max_tokens: 4096, // Reasonable limit for structured output
              stream: true
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              console.error('GLM API returned non-JSON error:', errorText);
              sendEvent('error', { error: `GLM API returned HTTP ${response.status}`, details: errorText, raw: errorText });
              return res.end();
            }
            
            console.error('GLM API Error:', errorData);
            
            // Handle specific GLM API errors
            if (errorData.error && errorData.error.code === '1113') {
              sendEvent('error', { 
                error: '智谱 AI 账号余额不足或无可用资源包。', 
                details: '请前往智谱 AI 开放平台 (open.bigmodel.cn) 充值或领取免费额度。' 
              });
              return res.end();
            }
            
            sendEvent('error', { error: 'AI recognition failed.', details: errorData, raw: JSON.stringify(errorData) });
            return res.end();
          }

          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              
              let newlineIndex;
              while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                
                if (isAborted) break;
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const text = data.choices[0]?.delta?.content || '';
                    if (text) {
                      aiText += text;
                      sendEvent('chunk', { text });
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              }
            }
          }
        } catch (error: any) {
          console.error('GLM API Error:', error);
          sendEvent('error', { error: 'GLM AI recognition failed.', details: error.message || String(error) });
          return res.end();
        }
      }

      rawResponses.push(aiText);

      // Clean up markdown markers if present
      let jsonStr = aiText.trim();
      
      // Sometimes AI wraps the JSON in markdown blocks
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Fallback: try to find the first '[' and last ']'
        const startIdx = jsonStr.indexOf('[');
        const endIdx = jsonStr.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        } else {
          // If no brackets found, it might be a truncated response. Try to fix it.
          if (startIdx !== -1 && endIdx === -1) {
             jsonStr = jsonStr.substring(startIdx) + '}]';
          }
        }
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonStr);
        if (Array.isArray(parsedJson)) {
          allParsedData.push(...parsedJson);
        } else if (typeof parsedJson === 'object') {
          allParsedData.push(parsedJson);
        }
      } catch (e) {
        console.error('Failed to parse JSON from AI:', jsonStr);
        // Attempt to fix common JSON errors
        try {
          let fixedJsonStr = jsonStr;

          // 1. Fix missing opening quote for keys: ,key": -> ,"key":
          // Example: {"id": "1",content": "..."} -> {"id": "1","content": "..."}
          fixedJsonStr = fixedJsonStr.replace(/,\s*([a-zA-Z0-9_]+)":/g, ',"$1":');

          // 2. Fix empty keys: "": -> "id": (Heuristic for this specific app)
          fixedJsonStr = fixedJsonStr.replace(/"":/g, '"id":');

          // 3. Fix trailing commas before closing brackets/braces
          fixedJsonStr = fixedJsonStr.replace(/,\s*([\]}])/g, '$1');
          
          // 4. If it's still failing, it might be truncated. Let's try to close it.
          if (!fixedJsonStr.trim().endsWith(']')) {
             const lastCompleteObjIdx = fixedJsonStr.lastIndexOf('}');
             if (lastCompleteObjIdx !== -1) {
                 fixedJsonStr = fixedJsonStr.substring(0, lastCompleteObjIdx + 1) + ']';
             } else {
                 fixedJsonStr += '}]';
             }
          }
          
          parsedJson = JSON.parse(fixedJsonStr);
          if (Array.isArray(parsedJson)) {
            allParsedData.push(...parsedJson);
          } else if (typeof parsedJson === 'object') {
            allParsedData.push(parsedJson);
          }
        } catch (e2) {
          sendEvent('error', { 
            error: 'AI 返回的数据格式无法解析为有效的 JSON。请重试，或检查图片内容是否过于复杂。', 
            raw: rawResponses.join('\n\n---\n\n') // Return all raw texts for debugging
          });
          return res.end();
        }
      }
    }

    sendEvent('done', { data: allParsedData });
    res.end();

  } catch (error: any) {
    console.error('AI Recognition Error:', error);
    sendEvent('error', { 
      error: 'Internal server error during AI recognition.', 
      details: error instanceof Error ? error.message : String(error),
      raw: rawResponses.length > 0 ? rawResponses.join('\n\n---\n\n') : undefined
    });
    res.end();
  }
});

// Get all subjects
app.get('/api/subjects', (_req, res) => {
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
  const { subject_id, title, type, category } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO tasks (id, subject_id, title, type, category) VALUES (?, ?, ?, ?, ?)').run(id, subject_id, title, type, category || null);
  res.json({ id, subject_id, title, type, category });
});

// Get a single task
app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(task);
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get questions for a task (Type A)
app.get('/api/tasks/:taskId/questions', (req, res) => {
  const questions = db.prepare('SELECT * FROM questions WHERE task_id = ? ORDER BY created_at DESC').all(req.params.taskId);
  res.json(questions);
});

// Create a question
app.post('/api/questions', (req, res) => {
  const { 
    task_id, parent_id, type, content, image_url, pdf_url, ocr_text, 
    options, correct_options,
    answer_content, answer_image_url, answer_pdf_url, answer_ocr_text,
    score
  } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO questions (
      id, task_id, parent_id, type, content, image_url, pdf_url, ocr_text, 
      options, correct_options,
      answer_content, answer_image_url, answer_pdf_url, answer_ocr_text,
      score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, task_id, parent_id || null, type || 'essay', content, image_url, pdf_url, ocr_text, 
    options ? JSON.stringify(options) : null, correct_options ? JSON.stringify(correct_options) : null,
    answer_content, answer_image_url, answer_pdf_url, answer_ocr_text,
    score !== undefined ? score : 1
  );
  res.json({ 
    id, 
    task_id, 
    parent_id,
    type: type || 'essay', 
    content, 
    image_url, 
    pdf_url, 
    ocr_text, 
    options: options ? JSON.stringify(options) : null, 
    correct_options: correct_options ? JSON.stringify(correct_options) : null,
    answer_content, 
    answer_image_url, 
    answer_pdf_url, 
    answer_ocr_text,
    score: score !== undefined ? score : 1
  });
});

// Update a question
app.put('/api/questions/:id', (req, res) => {
  const { 
    type, content, image_url, pdf_url, ocr_text, 
    options, correct_options,
    answer_content, answer_image_url, answer_pdf_url, answer_ocr_text,
    score
  } = req.body;
  db.prepare(`
    UPDATE questions 
    SET type = ?, content = ?, image_url = ?, pdf_url = ?, ocr_text = ?, 
        options = ?, correct_options = ?,
        answer_content = ?, answer_image_url = ?, answer_pdf_url = ?, answer_ocr_text = ?,
        score = ?
    WHERE id = ?
  `).run(
    type, content, image_url, pdf_url, ocr_text, 
    options ? JSON.stringify(options) : null, correct_options ? JSON.stringify(correct_options) : null,
    answer_content, answer_image_url, answer_pdf_url, answer_ocr_text, 
    score !== undefined ? score : 1,
    req.params.id
  );
  res.json({ success: true });
});

// Delete a question
app.delete('/api/questions/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update question stats (correct/wrong count)
app.post('/api/questions/:id/stats', (req, res) => {
  const { isCorrect } = req.body;
  
  if (isCorrect === undefined) {
    return res.status(400).json({ error: 'isCorrect boolean is required' });
  }

  if (isCorrect) {
    db.prepare('UPDATE questions SET correct_count = correct_count + 1 WHERE id = ?').run(req.params.id);
  } else {
    db.prepare('UPDATE questions SET wrong_count = wrong_count + 1 WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// Toggle question marked status
app.post('/api/questions/:id/mark', (req, res) => {
  const { isMarked } = req.body;
  
  if (isMarked === undefined) {
    return res.status(400).json({ error: 'isMarked boolean is required' });
  }

  db.prepare('UPDATE questions SET is_marked = ? WHERE id = ?').run(isMarked ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Import questions from JSON
app.post('/api/tasks/:taskId/questions/batch', (req, res) => {
  const { taskId } = req.params;
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid payload: questions must be an array' });
  }

  const insertQuestion = db.prepare(`
    INSERT INTO questions (
      id, task_id, parent_id, type, content, options, correct_options, answer_content, score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const processQuestion = (q: any, parentId: string | null = null) => {
    const id = crypto.randomUUID();
    let optionsJson = null;
    let correctOptionsJson = null;

    // Handle Options for Choice Types
    if ((q.type === 'single' || q.type === 'multiple') && Array.isArray(q.options)) {
      const options = q.options.map((opt: any) => {
        if (typeof opt === 'string') {
          return { id: crypto.randomUUID(), content: opt };
        }
        return { id: opt.id || crypto.randomUUID(), content: opt.content || '' };
      });
      optionsJson = JSON.stringify(options);

      // Handle Correct Options
      if (Array.isArray(q.correct_options)) {
        const correctIds = q.correct_options.map((val: any) => {
          if (typeof val === 'number' && val >= 0 && val < options.length) {
            return options[val].id;
          }
          if (typeof val === 'string') {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num.toString() === val && num >= 0 && num < options.length) {
              return options[num].id;
            }
            const upperVal = val.toUpperCase();
            if (upperVal >= 'A' && upperVal <= 'Z' && upperVal.length === 1) {
              const index = upperVal.charCodeAt(0) - 65;
              if (index >= 0 && index < options.length) {
                return options[index].id;
              }
            }
            // If it's already an ID, just return it
            return val;
          }
          return null;
        }).filter((id: string | null) => id !== null);
        correctOptionsJson = JSON.stringify(correctIds);
      }
    } 
    // Handle Options for Fishing Type
    else if (q.type === 'fishing' && Array.isArray(q.options)) {
      const options = q.options.map((opt: any) => {
        if (typeof opt === 'string') {
          return { id: crypto.randomUUID(), content: opt };
        }
        return { id: opt.id || crypto.randomUUID(), content: opt.content || '' };
      });
      optionsJson = JSON.stringify(options);
      
      // correct_options for fishing
      if (Array.isArray(q.correct_options)) {
         const correctIds = q.correct_options.map((val: any) => {
            if (typeof val === 'number' && val >= 0 && val < options.length) {
              return options[val].id;
            }
            if (typeof val === 'string') {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num.toString() === val && num >= 0 && num < options.length) {
                return options[num].id;
              }
              const upperVal = val.toUpperCase();
              if (upperVal >= 'A' && upperVal <= 'Z' && upperVal.length === 1) {
                const index = upperVal.charCodeAt(0) - 65;
                if (index >= 0 && index < options.length) {
                  return options[index].id;
                }
              }
              return val;
            }
            return null;
         }).filter((id: string | null) => id !== null);
         correctOptionsJson = JSON.stringify(correctIds);
      }
    }
    // Handle Fill/Cloze Types
    else if ((q.type === 'fill' || q.type === 'cloze') && q.correct_options) {
      // correct_options is an object map: { "space1": ["ans1", "ans2"] }
      correctOptionsJson = JSON.stringify(q.correct_options);
    }

    insertQuestion.run(
      id, 
      taskId, 
      parentId,
      q.type || 'essay', 
      q.content || '', 
      optionsJson, 
      correctOptionsJson, 
      q.answer_content || '',
      q.score !== undefined ? q.score : 1
    );

    // Handle Sub-questions for Big Question
    const children = q.children || q.questions;
    if (q.type === 'big' && Array.isArray(children)) {
      for (const subQ of children) {
        processQuestion(subQ, id);
      }
    }
  };

  try {
    const transaction = db.transaction(() => {
      for (const q of questions) {
        processQuestion(q);
      }
    });

    transaction();
    res.json({ success: true, count: questions.length });
  } catch (e) {
    console.error('Batch import failed:', e);
    res.status(500).json({ error: 'Batch import failed' });
  }
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

// Import nodes from Markdown tree
app.post('/api/nodes/import', (req, res) => {
  const { task_id, parent_id, tree } = req.body;
  if (!task_id || !tree || !Array.isArray(tree)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const insertNode = db.prepare(`
    INSERT INTO nodes (id, task_id, parent_id, content, image_url, order_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertTree = (nodes: any[], currentParentId: string | null, startIndex: number = 0) => {
    let order = startIndex;
    for (const node of nodes) {
      const id = crypto.randomUUID();
      insertNode.run(id, task_id, currentParentId, node.content, node.image_url || null, order++);
      if (node.children && node.children.length > 0) {
        insertTree(node.children, id, 0);
      }
    }
  };

  try {
    const transaction = db.transaction(() => {
      let startOrder = 0;
      if (parent_id) {
        const result = db.prepare('SELECT MAX(order_index) as maxOrder FROM nodes WHERE task_id = ? AND parent_id = ?').get(task_id, parent_id) as any;
        if (result && result.maxOrder !== null) startOrder = result.maxOrder + 1;
      } else {
        const result = db.prepare('SELECT MAX(order_index) as maxOrder FROM nodes WHERE task_id = ? AND parent_id IS NULL').get(task_id) as any;
        if (result && result.maxOrder !== null) startOrder = result.maxOrder + 1;
      }
      insertTree(tree, parent_id || null, startOrder);
    });
    
    transaction();
    res.json({ success: true });
  } catch (e) {
    console.error('Import failed:', e);
    res.status(500).json({ error: 'Import failed' });
  }
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

app.delete('/api/upload', (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const filePath = path.join(dataDir, url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      
      // Try to delete thumbnail if it exists
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const thumbPath = path.join(path.dirname(filePath), `${baseName}-thumb${ext}`);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('File deletion failed:', e);
    res.status(500).json({ error: 'File deletion failed' });
  }
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
           title as task_title, title as content_raw, NULL as ocr_raw, NULL as image_url, type as task_type
    FROM tasks
    WHERE title LIKE ? AND (? IS NULL OR subject_id = ?)
    
    UNION ALL
    
    SELECT 'question' as entity_type, q.id as entity_id, q.task_id, t.subject_id, 
           t.title as task_title, 
           COALESCE(q.content, '') || ' ' || COALESCE(q.answer_content, '') as content_raw, 
           COALESCE(q.ocr_text, '') || ' ' || COALESCE(q.answer_ocr_text, '') as ocr_raw, 
           q.image_url, t.type as task_type
    FROM questions q
    JOIN tasks t ON q.task_id = t.id
    WHERE (q.content LIKE ? OR q.ocr_text LIKE ? OR q.answer_content LIKE ? OR q.answer_ocr_text LIKE ?)
      AND (? IS NULL OR t.subject_id = ?)
      
    UNION ALL
    
    SELECT 'node' as entity_type, n.id as entity_id, n.task_id, t.subject_id, 
           COALESCE(p.content, t.title) as task_title, 
           n.content as content_raw, n.ocr_text as ocr_raw, n.image_url, t.type as task_type
    FROM nodes n
    JOIN tasks t ON n.task_id = t.id
    LEFT JOIN nodes p ON n.parent_id = p.id
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
      task_type: r.task_type,
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

// --- Dictionary API Routes ---

app.get('/api/tasks/:id/dictionary_entries', (req, res) => {
  const entries = db.prepare('SELECT * FROM dictionary_entries WHERE task_id = ? ORDER BY key ASC').all(req.params.id);
  res.json(entries);
});

app.post('/api/tasks/:id/dictionary_entries', (req, res) => {
  const { key, entries, synonyms, antonyms, comparisons } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO dictionary_entries (id, task_id, key, entries, synonyms, antonyms, comparisons)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, key,
    JSON.stringify(entries || []),
    JSON.stringify(synonyms || []),
    JSON.stringify(antonyms || []),
    JSON.stringify(comparisons || [])
  );
  res.json({ id });
});

app.post('/api/tasks/:id/dictionary_entries/bulk', (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Expected an array of entries' });
  }

  const insert = db.prepare(`
    INSERT INTO dictionary_entries (id, task_id, key, entries, synonyms, antonyms, comparisons)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((entriesArray) => {
    for (const entry of entriesArray) {
      const id = crypto.randomUUID();
      insert.run(
        id, req.params.id, entry.key,
        JSON.stringify(entry.entries || []),
        JSON.stringify(entry.synonyms || []),
        JSON.stringify(entry.antonyms || []),
        JSON.stringify(entry.comparisons || [])
      );
    }
  });

  insertMany(entries);
  res.json({ success: true, count: entries.length });
});

app.put('/api/entries/:id', (req, res) => {
  const { key, entries, synonyms, antonyms, comparisons } = req.body;
  db.prepare(`
    UPDATE dictionary_entries 
    SET key = ?, entries = ?, synonyms = ?, antonyms = ?, comparisons = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    key,
    JSON.stringify(entries || []),
    JSON.stringify(synonyms || []),
    JSON.stringify(antonyms || []),
    JSON.stringify(comparisons || []),
    req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/entries/:id', (req, res) => {
  db.prepare('DELETE FROM dictionary_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/entries/:id/query', (req, res) => {
  db.prepare('UPDATE dictionary_entries SET query_count = query_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/entries/:id/stars', (req, res) => {
  const entry = db.prepare('SELECT stars FROM dictionary_entries WHERE id = ?').get(req.params.id) as any;
  if (entry) {
    const newStars = (entry.stars + 1) % 6;
    db.prepare('UPDATE dictionary_entries SET stars = ? WHERE id = ?').run(newStars, req.params.id);
    res.json({ stars: newStars });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.put('/api/entries/:id/review', (req, res) => {
  const { review } = req.body;
  db.prepare('UPDATE dictionary_entries SET review = ? WHERE id = ?').run(review || '', req.params.id);
  res.json({ success: true });
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
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
