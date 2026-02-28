import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Camera, FileText, Plus, ChevronDown, ChevronUp, ArrowLeft, Trash2 } from 'lucide-react';

export default function TaskA() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [answerContent, setAnswerContent] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      api.getQuestions(id).then(setQuestions);
    }
  }, [id]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'question' | 'answer') => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    
    const { url } = await api.uploadFile(file);
    const isImage = file.type.startsWith('image/');
    
    const data = {
      task_id: id,
      [type === 'question' ? (isImage ? 'image_url' : 'pdf_url') : (isImage ? 'answer_image_url' : 'answer_pdf_url')]: url
    };
    
    const newQ = await api.createQuestion(data);
    setQuestions([newQ, ...questions]);
  };

  const toggleExpand = (qId: string) => {
    setExpanded(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-6 pb-24">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold truncate">{location.state?.title || 'Question Collection'}</h1>
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
            className="hidden" 
            ref={fileInputRef}
            capture="environment"
            onChange={e => handleFileUpload(e, 'question')}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {questions.map(q => (
          <Card key={q.id} className="overflow-hidden relative group">
            <button 
              onClick={() => handleDelete(q.id)} 
              className={`absolute top-2 right-2 p-1.5 rounded z-10 transition-opacity ${confirmDelete === q.id ? 'text-red-600 bg-red-50 font-bold text-xs opacity-100' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
            >
              {confirmDelete === q.id ? 'Sure?' : <Trash2 className="h-4 w-4" />}
            </button>
            <CardHeader className="p-4 bg-zinc-50 pr-10">
              {q.content && <p className="text-sm font-medium">{q.content}</p>}
              {q.image_url && <img src={q.image_url} alt="Question" className="mt-2 rounded-md w-full object-cover" />}
              {q.pdf_url && (
                <a href={q.pdf_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-sm mt-2">
                  <FileText className="h-4 w-4 mr-1" /> View PDF
                </a>
              )}
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
                    {q.answer_image_url && <img src={q.answer_image_url} alt="Answer" className="mt-2 rounded-md w-full object-cover" />}
                    {q.answer_pdf_url && (
                      <a href={q.answer_pdf_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-sm mt-2">
                        <FileText className="h-4 w-4 mr-1" /> View PDF Answer
                      </a>
                    )}
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
