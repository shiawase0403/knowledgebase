import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, CheckCircle2, RotateCcw, HelpCircle, Star } from 'lucide-react';
import { Question } from '../types';
import { QuestionRenderer } from '../components/QuestionRenderer';

import { calculateCorrectness } from '../utils/grading';

export default function QuizPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [maxTotalScore, setMaxTotalScore] = useState(0);

  const selectedIds = location.state?.selectedIds as string[] | undefined;

  useEffect(() => {
    if (id) {
      loadQuestions();
    }
  }, [id, selectedIds]);

  const loadQuestions = () => {
    if (!id) return;
    api.getQuestions(id).then(data => {
      // Build tree first
      const tree: Question[] = [];
      const map = new Map<string, Question>();
      data.forEach((q: Question) => map.set(q.id, { ...q, children: [] }));
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
      
      // Now filter by selectedIds if provided
      let finalTree = tree;
      if (selectedIds && selectedIds.length > 0) {
        finalTree = tree.filter((q: Question) => {
          if (q.type === 'big') {
            // Keep big question if any of its children are selected
            const selectedChildren = q.children?.filter(c => selectedIds.includes(c.id)) || [];
            if (selectedChildren.length > 0) {
              q.children = selectedChildren; // Only keep selected children
              return true;
            }
            return false;
          }
          return selectedIds.includes(q.id);
        });
      }
      
      setQuestions(finalTree);
    });
  };

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

  const handleSubmit = async () => {
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let currentScore = 0;
    let maxScore = 0;

    for (const q of questions) {
      if (q.type === 'big') {
        // For big questions, answers are nested in userAnswers[q.id]
        const bigQAnswers = userAnswers[q.id] || {};
        if (q.children) {
          for (const child of q.children) {
            const answer = bigQAnswers[child.id];
            const result = calculateCorrectness(child, answer);
            
            if (result !== null) {
              currentScore += result.score;
              maxScore += result.maxScore;
              try {
                await api.updateQuestionStats(child.id, result.isCorrect);
              } catch (e) {
                console.error(`Failed to update stats for question ${child.id}`, e);
              }
            }
          }
        }
      } else {
        // For regular questions
        const result = calculateCorrectness(q, userAnswers[q.id]);
        if (result !== null) {
          currentScore += result.score;
          maxScore += result.maxScore;
          try {
            await api.updateQuestionStats(q.id, result.isCorrect);
          } catch (e) {
            console.error(`Failed to update stats for question ${q.id}`, e);
          }
        }
      }
    }
    
    setTotalScore(currentScore);
    setMaxTotalScore(maxScore);
  };

  const handleReset = () => {
    setUserAnswers({});
    setShowResults(false);
    setTotalScore(0);
    setMaxTotalScore(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderMedia = (urlData: string | undefined, isPdf: boolean = false) => {
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
        <div key={i} className="mt-2">
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">
            查看 PDF 附件 {urls.length > 1 ? i + 1 : ''}
          </a>
        </div>
      ));
    }
    
    return urls.map((url, i) => (
      <div key={i} className="mt-2">
        <img src={url} alt="答案解析图片" className="rounded-md max-w-full h-auto object-contain" />
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold truncate">{location.state?.title || '做题模式'}</h1>
          </div>
          <div className="text-sm text-zinc-500">
            共 {questions.length} 题
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
        {showResults && maxTotalScore > 0 && (
          <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-100 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <h2 className="text-xl font-bold text-indigo-900 mb-2">练习结果</h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-black text-indigo-600">{totalScore.toFixed(1).replace(/\.0$/, '')}</span>
                <span className="text-lg font-medium text-indigo-400">/ {maxTotalScore} 分</span>
              </div>
              <p className="text-sm text-indigo-600/80 mt-2">
                得分率: {Math.round((totalScore / maxTotalScore) * 100)}%
              </p>
            </CardContent>
          </Card>
        )}

        {questions.map((q, index) => (
          <Card key={q.id} className="overflow-hidden border-none shadow-sm">
            <CardHeader className="p-6 bg-white relative">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-xs font-bold px-2 py-0.5 rounded uppercase bg-zinc-100 text-zinc-600">
                  Question {index + 1}
                </span>
                <span className="text-xs text-zinc-400 uppercase bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                  {q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : q.type === 'essay' ? '问答' : q.type === 'fill' ? '填空' : q.type === 'cloze' ? '选词' : q.type === 'fishing' ? '钓鱼' : '综合'}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                {(() => {
                  if (q.type === 'big' && q.children && q.children.length > 0) {
                    const allMarked = q.children.every(c => c.is_marked === 1);
                    const someMarked = q.children.some(c => c.is_marked === 1);
                    const currentMark = allMarked ? 1 : 0;
                    
                    return (
                      <button 
                        onClick={() => handleToggleMark(q.id, currentMark, true, q.children!.map(c => c.id))}
                        className={`p-2 rounded-full transition-colors ${allMarked ? 'text-amber-500 bg-amber-50' : someMarked ? 'text-amber-400 bg-amber-50/50' : 'text-zinc-300 hover:text-amber-500 hover:bg-zinc-50'}`}
                        title={allMarked ? "取消所有小题标记" : "标记所有小题"}
                      >
                        <Star className={`h-5 w-5 ${allMarked ? 'fill-current' : someMarked ? 'fill-amber-200' : ''}`} />
                      </button>
                    );
                  }
                  return (
                    <button 
                      onClick={() => handleToggleMark(q.id, q.is_marked)}
                      className={`p-2 rounded-full transition-colors ${q.is_marked === 1 ? 'text-amber-500 bg-amber-50' : 'text-zinc-300 hover:text-amber-500 hover:bg-zinc-50'}`}
                      title={q.is_marked === 1 ? "取消标记" : "标记此题"}
                    >
                      <Star className={`h-5 w-5 ${q.is_marked === 1 ? 'fill-current' : ''}`} />
                    </button>
                  );
                })()}
              </div>
              <QuestionRenderer 
                question={q} 
                userAnswers={userAnswers[q.id]} 
                onAnswer={(ans) => !showResults && setUserAnswers({ ...userAnswers, [q.id]: ans })}
                showResult={showResults}
                index={index}
                onToggleMark={handleToggleMark}
              />
            </CardHeader>
            {showResults && (
              <CardContent className="p-6 bg-green-50/50 border-t border-green-100">
                <div className="flex items-center text-sm font-bold text-green-800 mb-2">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  解析 / 答案
                </div>
                {q.answer_content ? (
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{q.answer_content}</p>
                ) : (
                  <p className="text-sm text-zinc-400 italic">暂无解析</p>
                )}
                {renderMedia(q.answer_image_url, false)}
                {renderMedia(q.answer_pdf_url, true)}
              </CardContent>
            )}
          </Card>
        ))}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center items-center space-x-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          {!showResults ? (
            <Button size="lg" className="w-full max-w-md bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200" onClick={handleSubmit}>
              <CheckCircle2 className="h-5 w-5 mr-2" /> 提交答案
            </Button>
          ) : (
            <Button size="lg" variant="outline" className="w-full max-w-md border-zinc-300 hover:bg-zinc-50" onClick={handleReset}>
              <RotateCcw className="h-5 w-5 mr-2" /> 重做
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
