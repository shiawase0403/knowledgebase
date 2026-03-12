import { useState, useEffect } from 'react';
import { Question, QuestionType, QuestionOption } from '../types';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { LatexInput, LatexTextarea } from './LatexInput';

interface QuestionEditorProps {
  initialType?: QuestionType;
  initialData?: Question;
  onSave: (questionData: any) => void;
  onCancel?: () => void;
  isSubQuestion?: boolean;
}

export function QuestionEditor({ initialType = 'essay', initialData, onSave, onCancel, isSubQuestion = false }: QuestionEditorProps) {
  const [type, setType] = useState<QuestionType>(initialData?.type || initialType);
  const [content, setContent] = useState(initialData?.content || '');
  const [answerContent, setAnswerContent] = useState(initialData?.answer_content || '');
  const [score, setScore] = useState<number>(initialData?.score ?? 1);
  
  // Choice Options (Single/Multiple)
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [correctOptions, setCorrectOptions] = useState<string[]>([]);

  // Fill/Cloze/Fishing State
  const [parsedBlanks, setParsedBlanks] = useState<any[]>([]);
  const [fishingOptions, setFishingOptions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Big Question State
  const [subQuestions, setSubQuestions] = useState<any[]>([]);
  const [isAddingSub, setIsAddingSub] = useState(false);

  // Initialize state from initialData
  useEffect(() => {
    if (initialData) {
      if (initialData.type === 'single' || initialData.type === 'multiple') {
        try {
          const opts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : (initialData.options || []);
          setOptions(opts.length > 0 ? opts : [{ id: crypto.randomUUID(), content: '' }, { id: crypto.randomUUID(), content: '' }]);
          
          const correct = typeof initialData.correct_options === 'string' ? JSON.parse(initialData.correct_options) : (initialData.correct_options || []);
          setCorrectOptions(correct);
        } catch (e) { console.error(e); }
      } else if (initialData.type === 'fishing') {
        try {
          const raw = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : (initialData.options || []);
          if (Array.isArray(raw)) {
            if (raw.length > 0 && typeof raw[0] === 'string') {
              setFishingOptions(raw);
            } else {
              setFishingOptions(raw.map((o: any) => {
                if (typeof o.content === 'object') return o.content.content || '';
                return String(o.content || '');
              }));
            }
          }
          
          // Correct options are IDs in DB. We need to map back to indices for editor.
          // const correctIds: string[] = initialData.correct_options ? JSON.parse(initialData.correct_options) : [];
          // We can't easily map back if we don't have the original order or if IDs changed.
          // But assuming order is preserved:
          // Actually, we need to know which blank corresponds to which option index.
          // correctIds[blankIndex] = optionId
          // We need to find index of optionId in opts.
          
          // We'll handle this in the parsing effect or here?
          // The parsing effect runs on content change.
          // We need to set the values of parsedBlanks after parsing.
          // Let's store the correct indices temporarily
          // We can't set parsedBlanks here because it depends on content parsing.
          // We can use a ref or just rely on the fact that content is set, so effect will run.
          // But effect resets values.
        } catch (e) { console.error(e); }
      } else if (initialData.type === 'big') {
        setSubQuestions(initialData.children || []);
      }
    } else {
       // Default init
       if (type === 'single' || type === 'multiple') {
         setOptions([{ id: crypto.randomUUID(), content: '' }, { id: crypto.randomUUID(), content: '' }]);
       }
    }
  }, [initialData]);

  // --- Parsing Logic ---
  useEffect(() => {
    setValidationError(null);
    if (type === 'fill' || type === 'cloze') {
      // Parse {key} or {{key}} or {key:{"a","b"}}
      const matches = content.match(/(\{[^{}]+\}|\{\{[^{}]+\}\})/g) || [];
      
      // Validation: Check for duplicate single braces {key}
      const singleKeys = new Set<string>();
      const doubleKeys = new Set<string>();
      
      const newBlanks: any[] = [];
      
      matches.forEach(m => {
        const isDouble = m.startsWith('{{');
        const inner = isDouble ? m.slice(2, -2) : m.slice(1, -1);
        
        if (type === 'cloze' && inner.includes(':')) {
          const [key, choicesStr] = inner.split(':');
          if (singleKeys.has(key)) {
            setValidationError(`错误：键名 "${key}" 重复使用。单花括号 {} 中的键名必须唯一。`);
          }
          singleKeys.add(key);
          
          let choices: string[] = [];
          try {
            choices = choicesStr.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          } catch (e) { choices = []; }
          
          // Check if already added to newBlanks (should not happen if keys unique, but just in case)
          if (!newBlanks.find(b => b.key === key)) {
            newBlanks.push({ key, type: 'cloze', choices, value: '' });
          }
          return;
        }
        
        if (isDouble) {
          doubleKeys.add(inner);
          // For double braces, we only need one entry in parsedBlanks per unique key
          if (!newBlanks.find(b => b.key === inner)) {
            newBlanks.push({ key: inner, type: 'fill', isDouble: true, value: [] }); // value is array of correct answers
          }
        } else {
          if (singleKeys.has(inner)) {
            setValidationError(`错误：键名 "${inner}" 重复使用。单花括号 {} 中的键名必须唯一。如果要复用答案，请使用双花括号 {{${inner}}}。`);
          }
          singleKeys.add(inner);
          if (!newBlanks.find(b => b.key === inner)) {
            newBlanks.push({ key: inner, type: 'fill', isDouble: false, value: [] }); // value is array of correct answers (synonyms)
          }
        }
      });
      
      // Merge with existing values
      setParsedBlanks(prev => newBlanks.map(nb => {
        const existing = prev.find(p => p.key === nb.key);
        
        // If loading from initialData, try to populate
        if (!existing && initialData && (initialData.type === 'fill' || initialData.type === 'cloze')) {
           try {
             const correctMap = typeof initialData.correct_options === 'string' ? JSON.parse(initialData.correct_options) : (initialData.correct_options || {});
             if (correctMap[nb.key]) {
               const val = correctMap[nb.key];
               if (nb.type === 'cloze') {
                 // Ensure value is string for cloze
                 let valStr = '';
                 if (Array.isArray(val)) {
                    valStr = val.length > 0 ? val[0] : '';
                 } else {
                    valStr = String(val || '');
                 }
                 return { ...nb, value: valStr };
               } else {
                 // Ensure value is array for fill
                 return { ...nb, value: Array.isArray(val) ? val : [val] };
               }
             }
           } catch(e) {}
        }
        
        if (existing) {
          // Migrate old string value to array if needed
          if (nb.type === 'fill' && typeof existing.value === 'string') {
             return { ...nb, value: existing.value.split('|').filter(Boolean) };
          }
          return { ...nb, value: existing.value };
        }
        
        return nb;
      }));

    } else if (type === 'fishing') {
      // Parse {space}
      const count = (content.match(/\{space\}/g) || []).length;
      const newBlanks = Array(count).fill(0).map((_, i) => ({ index: i, value: '' })); // value is correct option index
      
      setParsedBlanks(prev => newBlanks.map(nb => {
        const existing = prev.find(p => p.index === nb.index);
        
        // Populate from initialData
        if (!existing && initialData && initialData.type === 'fishing') {
          try {
            const rawOpts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : (initialData.options || []);
            const rawCorrect = typeof initialData.correct_options === 'string' ? JSON.parse(initialData.correct_options) : (initialData.correct_options || []);
            
            const correctVal = rawCorrect[nb.index];
            
            if (typeof correctVal === 'number') {
              // Legacy: stored as index
              return { ...nb, value: correctVal.toString() };
            } else if (typeof correctVal === 'string') {
              // Stored as ID
              // Need to find index in options
              // If options are strings, we can't match by ID unless we generated IDs deterministically or stored them.
              // If options are objects, we match by ID.
              if (rawOpts.length > 0 && typeof rawOpts[0] === 'object') {
                const optIdx = rawOpts.findIndex((o: any) => o.id === correctVal);
                if (optIdx !== -1) return { ...nb, value: optIdx.toString() };
              }
            }
          } catch(e) {}
        }

        return existing ? { ...nb, value: existing.value } : nb;
      }));
    }
  }, [content, type, initialData]);

  // --- Handlers ---
  const handleSave = () => {
    if (validationError) {
      alert("请先修复题目中的错误。");
      return;
    }

    const data: any = {
      type,
      content,
      answer_content: answerContent,
      score,
    };

    if (type === 'single' || type === 'multiple') {
      data.options = options;
      data.correct_options = correctOptions;
    } else if (type === 'fill' || type === 'cloze') {
      // Convert parsedBlanks to correct_options map
      const correctMap: Record<string, any> = {};
      parsedBlanks.forEach(b => {
        if (b.type === 'fill') {
          // Store array of correct answers
          correctMap[b.key] = b.value;
        } else {
          correctMap[b.key] = b.value;
        }
      });
      data.correct_options = correctMap;
    } else if (type === 'fishing') {
      // Transform strings to QuestionOption objects
      const finalOptions = fishingOptions.map(opt => ({ id: crypto.randomUUID(), content: opt }));
      data.options = finalOptions;
      
      // Map indices to IDs
      data.correct_options = parsedBlanks.map(b => {
         const idx = parseInt(b.value);
         if (idx >= 0 && idx < finalOptions.length) return finalOptions[idx].id;
         return null;
      });
    } else if (type === 'big') {
      data.questions = subQuestions;
    }

    onSave(data);
  };

  const addOption = () => {
    setOptions([...options, { id: crypto.randomUUID(), content: '' }]);
  };

  const toggleCorrect = (id: string) => {
    if (type === 'single') {
      setCorrectOptions([id]);
    } else {
      setCorrectOptions(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
  };

  // --- Renderers ---
  const renderTypeSelector = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {!isSubQuestion && (
        <Button variant={type === 'big' ? 'default' : 'outline'} size="sm" onClick={() => setType('big')}>综合题</Button>
      )}
      <Button variant={type === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setType('single')}>单选</Button>
      <Button variant={type === 'multiple' ? 'default' : 'outline'} size="sm" onClick={() => setType('multiple')}>多选</Button>
      <Button variant={type === 'essay' ? 'default' : 'outline'} size="sm" onClick={() => setType('essay')}>问答</Button>
      <Button variant={type === 'fill' ? 'default' : 'outline'} size="sm" onClick={() => setType('fill')}>填空</Button>
      <Button variant={type === 'cloze' ? 'default' : 'outline'} size="sm" onClick={() => setType('cloze')}>选词填空</Button>
      <Button variant={type === 'fishing' ? 'default' : 'outline'} size="sm" onClick={() => setType('fishing')}>小猫钓鱼</Button>
    </div>
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
      {renderTypeSelector()}

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">
          {type === 'big' ? '材料内容' : '题目内容'}
        </label>
        <LatexTextarea 
          value={content} 
          onChange={e => setContent(e.target.value)} 
          placeholder={
            type === 'fill' ? '例: 玫瑰是{color}, 紫罗兰是{color2}...' :
            type === 'cloze' ? '例: 此时电压{val:{"增大","减小"}}...' :
            type === 'fishing' ? '例: The cat sat on the {space}...' :
            '输入题目内容...'
          }
          className="min-h-[100px]"
        />
        <p className="text-xs text-zinc-400">
          {type === 'fill' && '提示: 使用 {key} 表示填空, {{key}} 表示可互换答案。'}
          {type === 'cloze' && '提示: 使用 {key:{"选项A","选项B"}} 表示下拉选择。'}
          {type === 'fishing' && '提示: 使用 {space} 表示拖拽空位。'}
        </p>
      </div>

      {/* Choice Options */}
      {(type === 'single' || type === 'multiple') && (
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center space-x-2">
              <button onClick={() => toggleCorrect(opt.id)} className={`p-1 rounded-full border ${correctOptions.includes(opt.id) ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-300'}`}>
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <LatexInput 
                  value={opt.content} 
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[idx].content = e.target.value;
                    setOptions(newOpts);
                  }}
                  placeholder={`选项 ${idx + 1}`}
                />
              </div>
              <button onClick={() => setOptions(options.filter((_, i) => i !== idx))}><XCircle className="h-4 w-4 text-zinc-400" /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addOption}><Plus className="h-3 w-3 mr-1" /> 添加选项</Button>
        </div>
      )}

      {/* Fill/Cloze Answers */}
      {(type === 'fill' || type === 'cloze') && parsedBlanks.length > 0 && (
        <div className="space-y-2 bg-zinc-50 p-3 rounded">
          <h4 className="text-sm font-bold text-zinc-600">设置正确答案</h4>
          {validationError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-2">
              {validationError}
            </div>
          )}
          {parsedBlanks.map((blank, i) => (
            <div key={i} className="space-y-1 border-b border-zinc-200 pb-2 last:border-0">
              <div className="flex items-center space-x-2 text-sm">
                <span className="w-20 font-mono text-zinc-500 truncate font-bold" title={blank.key}>
                  {blank.isDouble ? `{{${blank.key}}}` : `{${blank.key}}`}:
                </span>
                
                {blank.type === 'cloze' ? (
                  <select 
                    value={blank.value} 
                    onChange={e => {
                      const newBlanks = [...parsedBlanks];
                      newBlanks[i].value = e.target.value;
                      setParsedBlanks(newBlanks);
                    }}
                    className="border rounded px-2 py-1 flex-1"
                  >
                    <option value="">选择正确项...</option>
                    {blank.choices.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(blank.value || []).map((ans: string, ansIdx: number) => (
                        <div key={ansIdx} className="flex items-center bg-white border rounded px-2 py-1 text-sm">
                          <span>{ans}</span>
                          <button 
                            onClick={() => {
                              const newBlanks = [...parsedBlanks];
                              newBlanks[i].value = blank.value.filter((_: any, idx: number) => idx !== ansIdx);
                              setParsedBlanks(newBlanks);
                            }}
                            className="ml-2 text-zinc-400 hover:text-red-500"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <LatexInput 
                          value=""
                          placeholder="输入正确答案..."
                          className="h-8 text-sm"
                          onChange={() => {
                            // We use onKeyDown for this input as it's a tag input
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                const newBlanks = [...parsedBlanks];
                                const current = newBlanks[i].value || [];
                                if (!current.includes(val)) {
                                  newBlanks[i].value = [...current, val];
                                  setParsedBlanks(newBlanks);
                                }
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400">按回车添加</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fishing Options */}
      {type === 'fishing' && (
        <div className="space-y-4">
          <div className="bg-zinc-50 p-3 rounded space-y-2">
            <h4 className="text-sm font-bold text-zinc-600">候选项池</h4>
            {fishingOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs text-zinc-400 w-6">{idx + 1}.</span>
                <div className="flex-1">
                  <LatexInput 
                    value={opt} 
                    onChange={e => {
                      const newOpts = [...fishingOptions];
                      newOpts[idx] = e.target.value;
                      setFishingOptions(newOpts);
                    }}
                    className="h-8"
                  />
                </div>
                <button onClick={() => setFishingOptions(fishingOptions.filter((_, i) => i !== idx))}><XCircle className="h-4 w-4 text-zinc-400" /></button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setFishingOptions([...fishingOptions, ''])}><Plus className="h-3 w-3 mr-1" /> 添加候选项</Button>
          </div>

          {parsedBlanks.length > 0 && (
            <div className="bg-zinc-50 p-3 rounded space-y-2">
              <h4 className="text-sm font-bold text-zinc-600">设置空格答案 (对应候选项序号)</h4>
              {parsedBlanks.map((blank, i) => (
                <div key={i} className="flex items-center space-x-2 text-sm">
                  <span className="w-20 text-zinc-500">空格 {i + 1}:</span>
                  <select 
                    value={blank.value} 
                    onChange={e => {
                      const newBlanks = [...parsedBlanks];
                      newBlanks[i].value = e.target.value;
                      setParsedBlanks(newBlanks);
                    }}
                    className="border rounded px-2 py-1 flex-1"
                  >
                    <option value="">选择正确候选项...</option>
                    {fishingOptions.map((opt, idx) => (
                      <option key={idx} value={idx}>{idx + 1}. {opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Big Question Sub-questions */}
      {type === 'big' && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-bold text-zinc-600">子题目列表 ({subQuestions.length})</h4>
          {subQuestions.map((sq, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-zinc-50 rounded border">
              <span className="text-sm truncate max-w-[200px]">{sq.content}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-zinc-200 px-1 rounded">{sq.type}</span>
                <button onClick={() => setSubQuestions(subQuestions.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          
          {isAddingSub ? (
            <div className="border-l-2 border-indigo-500 pl-4 mt-4">
              <h5 className="text-sm font-bold mb-2">添加子题目</h5>
              <QuestionEditor 
                isSubQuestion={true}
                onSave={(sqData) => {
                  setSubQuestions([...subQuestions, sqData]);
                  setIsAddingSub(false);
                }}
                onCancel={() => setIsAddingSub(false)}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsAddingSub(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> 添加子题目
            </Button>
          )}
        </div>
      )}

      {type !== 'big' && (
        <div className="pt-4 border-t space-y-2">
          <label className="text-sm font-medium text-zinc-700">分值</label>
          <Input 
            type="number"
            min="0"
            step="0.5"
            value={score} 
            onChange={e => setScore(parseFloat(e.target.value) || 0)} 
            className="w-32"
          />
        </div>
      )}

      <div className="pt-4 border-t space-y-2">
        <label className="text-sm font-medium text-zinc-700">解析 / 答案分析</label>
        <LatexTextarea 
          value={answerContent} 
          onChange={e => setAnswerContent(e.target.value)} 
          placeholder="输入解析..."
          className="min-h-[60px]"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        {onCancel && <Button variant="ghost" onClick={onCancel}>取消</Button>}
        <Button onClick={handleSave}>保存题目</Button>
      </div>
    </div>
  );
}
