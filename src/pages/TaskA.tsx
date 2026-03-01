import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { extractTextFromImage } from '../services/ocr';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Camera, FileText, Plus, ChevronDown, ChevronUp, ArrowLeft, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';

export default function TaskA() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [answerContent, setAnswerContent] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);
  
  const queryParams = new URLSearchParams(location.search);
  const highlightQuestionId = queryParams.get('questionId');

  useEffect(() => {
    if (id) {
      api.getQuestions(id).then(setQuestions);
    }
  }, [id]);

  useEffect(() => {
    if (highlightQuestionId && questions.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`question-${highlightQuestionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightQuestionId, questions]);

  const handleCreate = async () => {
    if (!content.trim() || !id) return;
    const newQ = await api.createQuestion({ task_id: id, content, answer_content: answerContent });
    setQuestions([newQ, ...questions]);
    setContent('');
    setAnswerContent('');
  };

  const handleDelete = async (qId: string) => {
    if (confirmDelete !== qId) {
      setConfirmDelete(qId);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    await api.deleteQuestion(qId);
    setQuestions(questions.filter(q => q.id !== qId));
    setConfirmDelete(null);
  };

  const handleDeleteTask = async () => {
    if (!id) return;
    if (!confirmDeleteTask) {
      setConfirmDeleteTask(true);
      setTimeout(() => setConfirmDeleteTask(false), 3000);
      return;
    }
    await api.deleteTask(id);
    navigate(-1);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'question' | 'answer') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;
    
    setIsUploading(true);
    try {
      const imageUrls: string[] = [];
      const pdfUrls: string[] = [];
      let combinedOcrText = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { url } = await api.uploadFile(file);
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          imageUrls.push(url);
          const ocr_text = await extractTextFromImage(file);
          if (ocr_text) combinedOcrText += ocr_text + '\n';
        } else {
          pdfUrls.push(url);
        }
      }
      
      const data = {
        task_id: id,
        [type === 'question' ? 'image_url' : 'answer_image_url']: imageUrls.length > 0 ? JSON.stringify(imageUrls) : undefined,
        [type === 'question' ? 'pdf_url' : 'answer_pdf_url']: pdfUrls.length > 0 ? JSON.stringify(pdfUrls) : undefined,
        [type === 'question' ? 'ocr_text' : 'answer_ocr_text']: combinedOcrText
      };
      
      const newQ = await api.createQuestion(data);
      setQuestions([newQ, ...questions]);
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderMedia = (urlData: string | null, isPdf: boolean = false) => {
    if (!urlData) return null;
    let urls: string[] = [];
    try {
      urls = JSON.parse(urlData);
      if (!Array.isArray(urls)) urls = [urlData];
    } catch (e) {
      urls = [urlData];
    }
    
    if (isPdf) {
      return urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-sm mt-2">
          <FileText className="h-4 w-4 mr-1" /> View PDF {urls.length > 1 ? i + 1 : ''}
        </a>
      ));
    }
    
    return urls.map((url, i) => (
      <img key={i} src={url} alt="Attachment" className="mt-2 rounded-md w-full object-cover" />
    ));
  };

  const toggleExpand = (qId: string) => {
    setExpanded(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">{location.state?.title || 'Question Collection'}</h1>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleDeleteTask}
          className={confirmDeleteTask ? 'text-red-600 font-bold' : 'text-zinc-400 hover:text-red-600'}
          title="Delete Task"
        >
          {confirmDeleteTask ? 'Sure?' : <Trash2 className="h-5 w-5" />}
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <Input 
          placeholder="New Question Content..." 
          value={content} 
          onChange={e => setContent(e.target.value)} 
        />
        <Input 
          placeholder="Answer Content (Optional)..." 
          value={answerContent} 
          onChange={e => setAnswerContent(e.target.value)} 
        />
        <div className="flex space-x-2">
          <Button onClick={handleCreate} className="flex-1">
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            multiple
            className="hidden" 
            ref={fileInputRef}
            onChange={e => handleFileUpload(e, 'question')}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Upload Images/PDFs">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {questions.map(q => (
          <Card key={q.id} id={`question-${q.id}`} className={`overflow-hidden relative group ${highlightQuestionId === q.id ? 'ring-2 ring-yellow-400 ring-offset-2 transition-all duration-500' : ''}`}>
            <button 
              onClick={() => handleDelete(q.id)} 
              className={`absolute top-2 right-2 p-1.5 rounded z-10 transition-opacity ${confirmDelete === q.id ? 'text-red-600 bg-red-50 font-bold text-xs opacity-100' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
            >
              {confirmDelete === q.id ? 'Sure?' : <Trash2 className="h-4 w-4" />}
            </button>
            <CardHeader className="p-4 bg-zinc-50 pr-10">
              {q.content && <p className="text-sm font-medium">{q.content}</p>}
              {renderMedia(q.image_url, false)}
              {renderMedia(q.pdf_url, true)}
            </CardHeader>
            
            {(q.answer_content || q.answer_image_url || q.answer_pdf_url) && (
              <div className="border-t border-zinc-100">
                <Button 
                  variant="ghost" 
                  className="w-full justify-between rounded-none h-10 px-4 text-xs text-zinc-500"
                  onClick={() => toggleExpand(q.id)}
                >
                  Show Answer
                  {expanded[q.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {expanded[q.id] && (
                  <CardContent className="p-4 bg-white">
                    {q.answer_content && <p className="text-sm">{q.answer_content}</p>}
                    {renderMedia(q.answer_image_url, false)}
                    {renderMedia(q.answer_pdf_url, true)}
                  </CardContent>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
