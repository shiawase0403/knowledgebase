import { useState, useEffect } from 'react';
import { Question } from '../types';
import { Button } from './ui/button';
import { X, CheckCircle2, Circle, AlertCircle, BarChart2, Star, ChevronDown, ChevronUp } from 'lucide-react';

interface QuestionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onStartQuiz: (selectedIds: string[]) => void;
}

export function QuestionSelectionModal({ isOpen, onClose, questions, onStartQuiz }: QuestionSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedBigQs, setExpandedBigQs] = useState<Set<string>>(new Set());

  // Flatten questions (including children of big questions) for selection
  const flatQuestions = questions.flatMap(q => q.type === 'big' ? (q.children || []) : [q]);

  useEffect(() => {
    if (isOpen) {
      // Default select all
      setSelectedIds(new Set(flatQuestions.map(q => q.id)));
      // Default expand all big questions
      setExpandedBigQs(new Set(questions.filter(q => q.type === 'big').map(q => q.id)));
    }
  }, [isOpen, questions]);

  if (!isOpen) return null;

  const toggleSelection = (id: string, childrenIds?: string[]) => {
    const newSet = new Set(selectedIds);
    
    if (childrenIds) {
      // It's a big question
      const allSelected = childrenIds.every(cid => newSet.has(cid));
      if (allSelected) {
        // Deselect all children
        childrenIds.forEach(cid => newSet.delete(cid));
      } else {
        // Select all children
        childrenIds.forEach(cid => newSet.add(cid));
      }
    } else {
      // It's a normal or child question
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
    }
    setSelectedIds(newSet);
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedBigQs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedBigQs(newSet);
  };

  const selectAll = () => setSelectedIds(new Set(flatQuestions.map(q => q.id)));
  const selectNone = () => setSelectedIds(new Set());

  const selectByErrorRate = () => {
    const sorted = [...flatQuestions]
      .filter(q => (q.wrong_count || 0) > 0)
      .sort((a, b) => {
        const rateA = (a.wrong_count || 0) / ((a.correct_count || 0) + (a.wrong_count || 0));
        const rateB = (b.wrong_count || 0) / ((b.correct_count || 0) + (b.wrong_count || 0));
        return rateB - rateA;
      });
    setSelectedIds(new Set(sorted.map(q => q.id)));
  };

  const selectMostAttempted = () => {
    const sorted = [...flatQuestions]
      .filter(q => ((q.correct_count || 0) + (q.wrong_count || 0)) > 0)
      .sort((a, b) => {
        const totalA = (a.correct_count || 0) + (a.wrong_count || 0);
        const totalB = (b.correct_count || 0) + (b.wrong_count || 0);
        return totalB - totalA;
      });
    setSelectedIds(new Set(sorted.map(q => q.id)));
  };

  const selectLeastAttempted = () => {
    const sorted = [...flatQuestions]
      .sort((a, b) => {
        const totalA = (a.correct_count || 0) + (a.wrong_count || 0);
        const totalB = (b.correct_count || 0) + (b.wrong_count || 0);
        return totalA - totalB;
      });
    setSelectedIds(new Set(sorted.map(q => q.id)));
  };

  const selectMarked = () => {
    const marked = flatQuestions.filter(q => q.is_marked === 1);
    setSelectedIds(new Set(marked.map(q => q.id)));
  };

  const renderQuestionRow = (q: Question, indexStr: string, isChild = false) => {
    const total = (q.correct_count || 0) + (q.wrong_count || 0);
    const errorRate = total > 0 ? ((q.wrong_count || 0) / total * 100).toFixed(1) : '0.0';
    const isSelected = selectedIds.has(q.id);

    return (
      <div 
        key={q.id} 
        onClick={() => toggleSelection(q.id)}
        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'} ${isChild ? 'ml-8 mt-2' : 'mt-2'}`}
      >
        <div className="mr-3 text-indigo-600">
          {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {isChild ? '小题' : '题目'} {indexStr}: {q.content ? q.content.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : '（图片/无题干）'}
          </div>
          <div className="flex items-center mt-1 text-xs text-gray-500 space-x-3">
            <span>已做: {total} 次</span>
            <span className={total > 0 && parseFloat(errorRate) > 50 ? 'text-red-600 font-medium' : ''}>
              错误率: {errorRate}%
            </span>
            {q.is_marked === 1 && <span className="text-amber-500 flex items-center"><Star className="h-3 w-3 mr-0.5 fill-current" /> 已标记</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">选择要做的题目</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        
        <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>全选</Button>
          <Button variant="outline" size="sm" onClick={selectNone}>全不选</Button>
          <Button variant="secondary" size="sm" onClick={selectByErrorRate} className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200">
            <AlertCircle className="h-4 w-4 mr-1" /> 错题优先
          </Button>
          <Button variant="secondary" size="sm" onClick={selectMostAttempted} className="text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200">
            <BarChart2 className="h-4 w-4 mr-1" /> 常做题目
          </Button>
          <Button variant="secondary" size="sm" onClick={selectLeastAttempted} className="text-green-600 bg-green-50 hover:bg-green-100 border-green-200">
            少做/未做
          </Button>
          <Button variant="secondary" size="sm" onClick={selectMarked} className="text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200">
            <Star className="h-4 w-4 mr-1" /> 已收藏/标记
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {questions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">没有可用的题目</div>
          ) : (
            questions.map((q, index) => {
              if (q.type === 'big') {
                const childrenIds = q.children?.map(c => c.id) || [];
                const selectedCount = childrenIds.filter(cid => selectedIds.has(cid)).length;
                const allSelected = childrenIds.length > 0 && selectedCount === childrenIds.length;
                const someSelected = selectedCount > 0 && !allSelected;
                const isExpanded = expandedBigQs.has(q.id);

                return (
                  <div key={q.id} className="mt-4 first:mt-0">
                    <div className="flex items-center p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer transition-colors">
                      <div 
                        className="mr-3 text-indigo-600 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleSelection(q.id, childrenIds); }}
                      >
                        {allSelected ? <CheckCircle2 className="h-5 w-5" /> : 
                         someSelected ? <div className="h-5 w-5 rounded-full border-2 border-indigo-600 flex items-center justify-center"><div className="h-2.5 w-2.5 bg-indigo-600 rounded-full"></div></div> : 
                         <Circle className="h-5 w-5 text-gray-300" />}
                      </div>
                      <div 
                        className="flex-1 min-w-0 flex items-center"
                        onClick={() => toggleExpand(q.id)}
                      >
                        <div className="text-sm font-bold text-gray-900 truncate flex-1">
                          综合题 {index + 1}: {q.content ? q.content.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : '（图片/无题干）'}
                        </div>
                        <div className="text-xs text-gray-500 ml-4 flex items-center">
                          已选 {selectedCount}/{childrenIds.length} 小题
                          {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                        </div>
                      </div>
                    </div>
                    {isExpanded && q.children && (
                      <div className="mb-2">
                        {q.children.map((child, cIndex) => renderQuestionRow(child, `${index + 1}.${cIndex + 1}`, true))}
                      </div>
                    )}
                  </div>
                );
              }

              return renderQuestionRow(q, `${index + 1}`);
            })
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            已选择 <span className="font-bold text-indigo-600">{selectedIds.size}</span> / {flatQuestions.length} 题
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button 
              onClick={() => onStartQuiz(Array.from(selectedIds))} 
              disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              开始做题
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
