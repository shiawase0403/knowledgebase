import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { extractTextFromImage } from '../services/ocr';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  FileText, Plus, ChevronDown, ChevronUp, ArrowLeft, Trash2, 
  Loader2, Image as ImageIcon, HelpCircle, Upload, Edit, Play, Star
} from 'lucide-react';
import { Question } from '../types';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { QuestionEditor } from '../components/QuestionEditor';
import { AIPaperImportModal } from '../components/AIPaperImportModal';
import { QuestionSelectionModal } from '../components/QuestionSelectionModal';

export default function TaskA() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAIImportModalOpen, setIsAIImportModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Quiz Mode State (Preview)
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState<Record<string, boolean>>({});

  const queryParams = new URLSearchParams(location.search);
  const highlightQuestionId = queryParams.get('questionId');

  const loadQuestions = async () => {
    if (!id) return;
    const data = await api.getQuestions(id);
    // Process flat list into tree for Big Questions
    const tree: Question[] = [];
    const map = new Map<string, Question>();
    
    // First pass: map all questions
    data.forEach((q: Question) => {
      map.set(q.id, { ...q, children: [] });
    });

    // Second pass: build tree
    data.forEach((q: Question) => {
      if (q.parent_id) {
        const parent = map.get(q.parent_id);
        if (parent) {
          parent.children?.push(map.get(q.id)!);
        }
      } else {
        tree.push(map.get(q.id)!);
      }
    });
    
    setQuestions(tree);
  };

  useEffect(() => {
    loadQuestions();
  }, [id]);

  const handleToggleMark = async (questionId: string, currentMark: number | undefined, isBigQuestion: boolean = false, childrenIds: string[] = []) => {
    try {
      if (isBigQuestion && childrenIds.length > 0) {
        // Toggle all children
        const allMarked = currentMark === 1;
        const newMark = allMarked ? 0 : 1;
        
        // Update all children in DB
        await Promise.all(childrenIds.map(id => api.toggleQuestionMark(id, newMark === 1)));
        
        // Update local state
        setQuestions(prev => {
          const updateNode = (nodes: Question[]): Question[] => {
            return nodes.map(n => {
              if (n.id === questionId) return { ...n, is_marked: newMark };
              if (childrenIds.includes(n.id)) return { ...n, is_marked: newMark };
              if (n.children) return { ...n, children: updateNode(n.children) };
              return n;
            });
          };
          return updateNode(prev);
        });
      } else {
        // Toggle single question
        const newMark = currentMark === 1 ? 0 : 1;
        await api.toggleQuestionMark(questionId, newMark === 1);
        
        // Update local state
        setQuestions(prev => {
          const updateNode = (nodes: Question[]): Question[] => {
            return nodes.map(n => {
              if (n.id === questionId) return { ...n, is_marked: newMark };
              if (n.children) {
                const updatedChildren = updateNode(n.children);
                // Also update parent's is_marked if this was a child
                // We can use is_marked = 1 for all, 2 for some, 0 for none. But DB is integer 0/1.
                // Let's just keep parent is_marked as 1 if all are marked, else 0. 
                // Wait, the UI can just calculate it on the fly.
                return { ...n, children: updatedChildren };
              }
              return n;
            });
          };
          return updateNode(prev);
        });
      }
    } catch (e) {
      console.error('Failed to toggle mark', e);
    }
  };

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !id) return;
    
    const file = e.target.files[0];
    setIsImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      if (!Array.isArray(json)) {
        alert('导入失败：JSON 格式错误，必须是数组。');
        return;
      }

      await api.importQuestions(id, json);
      await loadQuestions();
      alert(`成功导入 ${json.length} 个题目！`);
    } catch (error) {
      console.error('Import failed', error);
      alert('导入失败：请检查文件格式是否正确。');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleAIImport = async (parsedData: any[]) => {
    if (!id) return;
    try {
      setIsImporting(true);
      await api.importQuestions(id, parsedData);
      await loadQuestions();
      alert(`成功导入 ${parsedData.length} 个题目！`);
    } catch (error) {
      console.error('AI Import failed', error);
      alert('导入失败，请重试。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateQuestion = async (data: any) => {
    if (!id) return;
    try {
      const payload = {
        task_id: id,
        ...data
      };
      
      if (data.type === 'big' && data.questions && data.questions.length > 0) {
        await api.importQuestions(id, [data]);
      } else {
        await api.createQuestion(payload);
      }
      
      await loadQuestions();
      setIsCreating(false);
    } catch (error) {
      console.error("Creation failed", error);
    }
  };

  const handleUpdateQuestion = async (qId: string, data: any) => {
    try {
      // If it's a big question, we might need to handle children updates.
      // Currently api.updateQuestion only updates the question row.
      // For Big Question structure changes (add/remove sub-questions), 
      // we might need more complex logic or just delete and recreate children?
      // For now, let's assume we update the main question content.
      // If sub-questions are modified in the editor, we need to handle them.
      
      // QuestionEditor returns `questions` array for Big Question.
      // We should probably delete old children and create new ones, or update existing.
      // This is complex. For MVP, let's just update the main question fields.
      // If the user wants to edit sub-questions, they should probably do it individually 
      // if we rendered them individually in the editor.
      // But QuestionEditor renders sub-questions inside itself for 'big' type.
      
      // Let's just update the question itself for now.
      // If data.questions is present (Big Question), we might need to sync children.
      // Since we don't have a sync endpoint, maybe we can't easily update structure yet.
      // Let's just update content/type/answer.
      
      await api.updateQuestion(qId, data);
      await loadQuestions();
      setEditingQuestionId(null);
    } catch (error) {
      console.error("Update failed", error);
    }
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

  const handleAddMedia = async (qId: string, type: 'question' | 'answer', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      // Find question in tree (recursive search needed)
      const findQ = (list: Question[]): Question | undefined => {
        for (const q of list) {
          if (q.id === qId) return q;
          if (q.children) {
            const found = findQ(q.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      
      const q = findQ(questions);
      if (!q) return;

      const newImageUrls: string[] = [];
      const newPdfUrls: string[] = [];
      let newOcrText = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { url } = await api.uploadFile(file);
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          newImageUrls.push(url);
          const ocr_text = await extractTextFromImage(file);
          if (ocr_text) newOcrText += ocr_text + '\n';
        } else {
          newPdfUrls.push(url);
        }
      }

      let existingImageUrls: string[] = [];
      try {
        const parsed = JSON.parse(q[type === 'question' ? 'image_url' : 'answer_image_url'] || '[]');
        existingImageUrls = Array.isArray(parsed) ? parsed : [q[type === 'question' ? 'image_url' : 'answer_image_url'] as string];
      } catch (e) {
        if (q[type === 'question' ? 'image_url' : 'answer_image_url']) {
          existingImageUrls = [q[type === 'question' ? 'image_url' : 'answer_image_url'] as string];
        }
      }

      let existingPdfUrls: string[] = [];
      try {
        const parsed = JSON.parse(q[type === 'question' ? 'pdf_url' : 'answer_pdf_url'] || '[]');
        existingPdfUrls = Array.isArray(parsed) ? parsed : [q[type === 'question' ? 'pdf_url' : 'answer_pdf_url'] as string];
      } catch (e) {
        if (q[type === 'question' ? 'pdf_url' : 'answer_pdf_url']) {
          existingPdfUrls = [q[type === 'question' ? 'pdf_url' : 'answer_pdf_url'] as string];
        }
      }

      const existingOcrText = q[type === 'question' ? 'ocr_text' : 'answer_ocr_text'] || '';

      const finalImageUrls = [...existingImageUrls, ...newImageUrls].filter(Boolean);
      const finalPdfUrls = [...existingPdfUrls, ...newPdfUrls].filter(Boolean);
      const finalOcrText = existingOcrText + '\n' + newOcrText;

      const updateData = {
        ...q,
        [type === 'question' ? 'image_url' : 'answer_image_url']: finalImageUrls.length > 0 ? JSON.stringify(finalImageUrls) : null,
        [type === 'question' ? 'pdf_url' : 'answer_pdf_url']: finalPdfUrls.length > 0 ? JSON.stringify(finalPdfUrls) : null,
        [type === 'question' ? 'ocr_text' : 'answer_ocr_text']: finalOcrText
      };

      await api.updateQuestion(qId, updateData);
      await loadQuestions();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteMedia = async (qId: string, type: 'question' | 'answer', urlToDelete: string, isPdf: boolean) => {
    // Find question logic (same as above)
    const findQ = (list: Question[]): Question | undefined => {
      for (const q of list) {
        if (q.id === qId) return q;
        if (q.children) {
          const found = findQ(q.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    const q = findQ(questions);
    if (!q) return;

    const field = isPdf ? (type === 'question' ? 'pdf_url' : 'answer_pdf_url') : (type === 'question' ? 'image_url' : 'answer_image_url');
    let urls: string[] = [];
    try {
      urls = JSON.parse(q[field] || '[]');
      if (!Array.isArray(urls)) urls = [q[field] as string];
    } catch (e) {
      urls = [q[field] as string];
    }

    const newUrls = urls.filter(u => u !== urlToDelete);
    const updateData = {
      ...q,
      [field]: newUrls.length > 0 ? JSON.stringify(newUrls) : null
    };

    await api.updateQuestion(qId, updateData);
    await api.deleteFile(urlToDelete);
    await loadQuestions();
  };

  const renderMedia = (urlData: string | undefined, isPdf: boolean = false, qId: string, type: 'question' | 'answer') => {
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
        <div key={i} className="flex items-center justify-between mt-2 bg-zinc-50 p-2 rounded border border-zinc-200">
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-sm">
            <FileText className="h-4 w-4 mr-1" /> 查看 PDF {urls.length > 1 ? i + 1 : ''}
          </a>
          <button onClick={() => handleDeleteMedia(qId, type, url, true)} className="text-zinc-400 hover:text-red-600 p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ));
    }
    
    return urls.map((url, i) => (
      <div key={i} className="relative mt-2 group/img inline-block max-w-full">
        <img src={url} alt="附件" className="rounded-md max-w-full h-auto object-contain" />
        <button 
          onClick={() => handleDeleteMedia(qId, type, url, false)} 
          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded shadow-sm text-zinc-600 hover:text-red-600 opacity-0 group-hover/img:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ));
  };

  const toggleExpand = (qId: string) => {
    setExpanded(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const checkAnswer = (q: Question) => {
    setShowResults({ ...showResults, [q.id]: true });
    if (!expanded[q.id]) toggleExpand(q.id);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">{location.state?.title || '题目集'}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setIsSelectionModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Play className="h-4 w-4 mr-2" /> 开始做题
          </Button>
          <div className="flex justify-end space-x-2">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={importInputRef}
              onChange={handleImport}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsAIImportModalOpen(true)}
              disabled={isImporting}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              AI 智能识图导入
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              导入 JSON
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDeleteTask}
            className={confirmDeleteTask ? 'text-red-600 font-bold' : 'text-zinc-400 hover:text-red-600'}
            title="删除任务"
          >
            {confirmDeleteTask ? '确定?' : <Trash2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Creator Section */}
      {isCreating ? (
        <Card className="p-4 border-2 border-indigo-50">
          <QuestionEditor 
            onSave={handleCreateQuestion} 
            onCancel={() => setIsCreating(false)} 
          />
        </Card>
      ) : (
        <Button onClick={() => setIsCreating(true)} className="w-full py-8 border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-500">
          <Plus className="h-6 w-6 mr-2" /> 添加新题目
        </Button>
      )}

      <div className="space-y-6">
        {questions.map((q, index) => {
          if (editingQuestionId === q.id) {
            return (
              <Card key={q.id} className="p-4 border-2 border-indigo-50">
                <QuestionEditor 
                  initialData={q}
                  onSave={(data) => handleUpdateQuestion(q.id, data)}
                  onCancel={() => setEditingQuestionId(null)}
                />
              </Card>
            );
          }

          return (
            <Card key={q.id} id={`question-${q.id}`} className={`overflow-hidden relative group border-2 border-transparent ${highlightQuestionId === q.id ? 'ring-2 ring-yellow-400 ring-offset-2 transition-all duration-500' : ''}`}>
              <div className="absolute top-2 right-2 flex space-x-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditingQuestionId(q.id)}
                  className="p-1.5 rounded text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50"
                  title="编辑"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(q.id)} 
                  className={`p-1.5 rounded ${confirmDelete === q.id ? 'text-red-600 bg-red-50 font-bold text-xs' : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'}`}
                  title="删除"
                >
                  {confirmDelete === q.id ? '确定?' : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
              
              <CardHeader className="p-4 bg-zinc-50 pr-20 relative">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase bg-zinc-200 text-zinc-700`}>
                    {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : q.type === 'essay' ? '问答' : q.type === 'fill' ? '填空' : q.type === 'cloze' ? '选词' : q.type === 'fishing' ? '钓鱼' : '综合'}
                  </span>
                  <span className="text-xs text-zinc-400">#{index + 1}</span>
                </div>
                
                <div className="absolute top-4 right-16">
                  {(() => {
                    if (q.type === 'big' && q.children && q.children.length > 0) {
                      const allMarked = q.children.every(c => c.is_marked === 1);
                      const someMarked = q.children.some(c => c.is_marked === 1);
                      const currentMark = allMarked ? 1 : 0;
                      
                      return (
                        <button 
                          onClick={() => handleToggleMark(q.id, currentMark, true, q.children!.map(c => c.id))}
                          className={`p-1.5 rounded-full transition-colors ${allMarked ? 'text-amber-500 bg-amber-50' : someMarked ? 'text-amber-400 bg-amber-50/50' : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-50'}`}
                          title={allMarked ? "取消所有小题标记" : "标记所有小题"}
                        >
                          <Star className={`h-4 w-4 ${allMarked ? 'fill-current' : someMarked ? 'fill-amber-200' : ''}`} />
                        </button>
                      );
                    }
                    return (
                      <button 
                        onClick={() => handleToggleMark(q.id, q.is_marked)}
                        className={`p-1.5 rounded-full transition-colors ${q.is_marked === 1 ? 'text-amber-500 bg-amber-50' : 'text-zinc-400 hover:text-amber-500 hover:bg-zinc-50'}`}
                        title={q.is_marked === 1 ? "取消标记" : "标记此题"}
                      >
                        <Star className={`h-4 w-4 ${q.is_marked === 1 ? 'fill-current' : ''}`} />
                      </button>
                    );
                  })()}
                </div>

                {/* Question Content Rendered by QuestionRenderer */}
                <div className="mt-2">
                  <QuestionRenderer 
                    question={q} 
                    userAnswers={userAnswers[q.id]} 
                    onAnswer={(ans) => setUserAnswers({ ...userAnswers, [q.id]: ans })}
                    showResult={showResults[q.id]}
                    index={index}
                    onToggleMark={handleToggleMark}
                  />
                </div>

                {renderMedia(q.image_url, false, q.id, 'question')}
                {renderMedia(q.pdf_url, true, q.id, 'question')}
                
                <div className="mt-3">
                  <label className="cursor-pointer inline-flex items-center text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                    <input type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={(e) => handleAddMedia(q.id, 'question', e)} />
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> 添加媒体
                  </label>
                </div>
              </CardHeader>
              
              <CardContent className="p-4">
                {/* Actions */}
                <div className="flex items-center justify-between mt-4">
                  <Button 
                    onClick={() => checkAnswer(q)} 
                    disabled={showResults[q.id]}
                    size="sm"
                    className={showResults[q.id] ? 'opacity-50' : ''}
                  >
                    预览答案
                  </Button>
                  
                  {showResults[q.id] && (
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(q.id)} className="text-zinc-500">
                      {expanded[q.id] ? '隐藏解析' : '显示解析'}
                      {expanded[q.id] ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                    </Button>
                  )}
                </div>

                {/* Explanation / Answer Section */}
                {expanded[q.id] && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 bg-zinc-50/50 -mx-4 px-4 pb-4">
                    <div className="flex items-center text-sm font-bold text-zinc-700 mb-2">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      解析 / 答案
                    </div>
                    {q.answer_content ? (
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{q.answer_content}</p>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">无解析。</p>
                    )}
                    {renderMedia(q.answer_image_url, false, q.id, 'answer')}
                    {renderMedia(q.answer_pdf_url, true, q.id, 'answer')}
                    
                    <div className="mt-3">
                      <label className="cursor-pointer inline-flex items-center text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                        <input type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={(e) => handleAddMedia(q.id, 'answer', e)} />
                        <ImageIcon className="h-3.5 w-3.5 mr-1" /> 添加媒体
                      </label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* AI Import Modal */}
      <AIPaperImportModal 
        isOpen={isAIImportModalOpen}
        onClose={() => setIsAIImportModalOpen(false)}
        onImport={handleAIImport}
      />

      <QuestionSelectionModal
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        questions={questions}
        onStartQuiz={(selectedIds) => {
          setIsSelectionModalOpen(false);
          navigate(`/tasks/${id}/quiz`, { state: { title: location.state?.title, selectedIds } });
        }}
      />
    </div>
  );
}
