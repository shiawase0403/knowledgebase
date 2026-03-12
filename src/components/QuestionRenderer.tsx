import { Question, QuestionOption } from '../types';
import { Input } from './ui/input';
import { Star } from 'lucide-react';
import Latex from 'react-latex-next';

interface QuestionRendererProps {
  question: Question;
  userAnswers: any;
  onAnswer: (val: any) => void;
  showResult: boolean;
  index?: number;
  onToggleMark?: (id: string, currentMark: number | undefined) => void;
}

export function QuestionRenderer({ question, userAnswers, onAnswer, showResult, index, onToggleMark }: QuestionRendererProps) {
  const { type, content, options, correct_options } = question;
  
  let parsedOptions: QuestionOption[] = [];
  try {
    const raw = typeof options === 'string' ? JSON.parse(options) : (options || []);
    if (Array.isArray(raw)) {
      if (raw.length > 0 && typeof raw[0] === 'string') {
        // Handle legacy string array format
        parsedOptions = raw.map((s: string, i: number) => ({ id: i.toString(), content: s }));
      } else {
        // Handle object array, ensuring content is string
        parsedOptions = raw.map((o: any) => ({
          id: o.id,
          content: typeof o.content === 'object' ? (o.content.content || JSON.stringify(o.content)) : String(o.content || '')
        }));
      }
    }
  } catch (e) { parsedOptions = []; }

  let parsedCorrect: any = null;
  try {
    parsedCorrect = typeof correct_options === 'string' ? JSON.parse(correct_options) : (correct_options || null);
  } catch (e) { parsedCorrect = null; }

  // --- Helper for Fill/Cloze Parsing ---
  const renderTextWithBlanks = () => {
    if (!content) return null;
    
    // Split content by {key}, {{key}}, or {key:{"a","b"}}
    // Regex: match { ... } or {{ ... }}
    const parts = content.split(/(\{[^{}]+\}|\{\{[^{}]+\}\})/g);
    
    // State to track occurrences of keys for {{}}
    const keyCounts: Record<string, number> = {};
    
    // Pre-calculate correctness for double braces {{}}
    const doubleBraceCorrectness: Record<string, boolean[]> = {};
    
    if (showResult && parsedCorrect) {
       // Group user answers by key
       const userAnswersByKey: Record<string, { val: string, index: number }[]> = {};
       
       // First pass to populate userAnswersByKey
       const tempCounts: Record<string, number> = {};
       parts.forEach((part) => {
         if (part.match(/^\{\{.*?\}\}$/)) {
           const key = part.slice(2, -2);
           if (!userAnswersByKey[key]) userAnswersByKey[key] = [];
           const count = tempCounts[key] || 0;
           tempCounts[key] = count + 1;
           
           // Determine unique ID used for this input
           const uniqueKey = `${key}_${count}`;
           const val = userAnswers?.[uniqueKey] || userAnswers?.[key] || ''; // Fallback to key for legacy/single
           userAnswersByKey[key].push({ val, index: count });
         }
       });
       
       // Calculate correctness
       Object.keys(userAnswersByKey).forEach(key => {
         const answers = userAnswersByKey[key];
         const correctSet = parsedCorrect[key] || [];
         const correctArray = Array.isArray(correctSet) ? [...correctSet] : [correctSet];
         
         const results = new Array(answers.length).fill(false);
         
         // Greedy matching: find first unused correct answer
         answers.forEach((ans, i) => {
           const matchIdx = correctArray.findIndex(c => c === ans.val);
           if (matchIdx !== -1) {
             results[i] = true;
             correctArray.splice(matchIdx, 1); // Mark as used
           }
         });
         doubleBraceCorrectness[key] = results;
       });
    }

    return (
      <div className="leading-8">
        {parts.map((part, i) => {
          const isDouble = part.startsWith('{{');
          const isSingle = part.startsWith('{') && !isDouble;
          
          if (isDouble || isSingle) {
            const inner = isDouble ? part.slice(2, -2) : part.slice(1, -1);
            let key = inner;
            let choices: string[] = [];
            let isCloze = false;

            // Parse cloze format: {key:{"a","b"}}
            // Only for single braces usually, but check inner content
            if (inner.includes(':')) {
              const colonIdx = inner.indexOf(':');
              const k = inner.substring(0, colonIdx);
              const cStr = inner.substring(colonIdx + 1);
              key = k;
              try {
                // Extract choices from {"a","b"}
                const rawChoices = cStr.trim();
                if (rawChoices.startsWith('{') && rawChoices.endsWith('}')) {
                  choices = rawChoices.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                  isCloze = true;
                }
              } catch (e) { console.error("Error parsing cloze choices", e); }
            }

            // Determine unique ID for this input
            const count = keyCounts[key] || 0;
            keyCounts[key] = count + 1;
            // For double braces, use unique ID. For single, use key (enforced unique).
            // Actually, to be safe, always use key for single.
            const uniqueKey = isDouble ? `${key}_${count}` : key;

            const currentVal = userAnswers?.[uniqueKey] || '';

            // Check correctness
            let isCorrect = false;
            let correctAnsDisplay = '';
            
            if (showResult && parsedCorrect) {
              const correctSet = parsedCorrect[key];
              
              if (isDouble) {
                 // Use pre-calculated correctness
                 isCorrect = doubleBraceCorrectness[key]?.[count] || false;
                 correctAnsDisplay = Array.isArray(correctSet) ? correctSet.join(' / ') : correctSet;
              } else {
                 // Single brace / Cloze
                 const correctVal = Array.isArray(correctSet) ? correctSet[0] : correctSet;
                 isCorrect = currentVal === correctVal;
                 correctAnsDisplay = correctVal;
              }
            }
            const isWrong = showResult && !isCorrect;

            if (isCloze) {
              return (
                <span key={i} className="inline-block mx-1">
                  <select
                    value={currentVal}
                    onChange={e => onAnswer({ ...userAnswers, [uniqueKey]: e.target.value })}
                    disabled={showResult}
                    className={`border rounded px-2 py-1 text-sm outline-none transition-colors ${
                      isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 
                      isWrong ? 'border-red-500 bg-red-50 text-red-700' : 'border-zinc-300 focus:border-blue-500'
                    }`}
                  >
                    <option value="">请选择</option>
                    {choices.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {isWrong && <span className="text-green-600 text-xs ml-1">({correctAnsDisplay})</span>}
                </span>
              );
            }

            return (
              <span key={i} className="inline-block mx-1">
                <Input
                  value={currentVal}
                  onChange={e => onAnswer({ ...userAnswers, [uniqueKey]: e.target.value })}
                  disabled={showResult}
                  className={`inline-block w-24 h-8 border-0 border-b-2 rounded-none px-1 text-center focus-visible:ring-0 ${
                    isCorrect ? 'border-green-500 text-green-600 bg-green-50' : 
                    isWrong ? 'border-red-500 text-red-600 bg-red-50' : 'border-zinc-400 focus:border-blue-500'
                  }`}
                  placeholder={key}
                />
                {isWrong && <span className="text-green-600 text-xs ml-1">(<Latex>{correctAnsDisplay}</Latex>)</span>}
              </span>
            );
          }
          
          return <span key={i}><Latex>{part}</Latex></span>;
        })}
        <span className="ml-2 text-xs text-zinc-500 font-normal">({question.score ?? 1}分)</span>
      </div>
    );
  };

  // --- Fishing Specific Logic ---
  const renderFishing = () => {
    // We need to split content to find {space}s and render them as drop zones (or click zones)
    const parts = content.split(/(\{space\})/g);
    let spaceCount = 0;

    return (
      <div className="space-y-4">
        <div className="leading-8">
          {parts.map((part, i) => {
            if (part === '{space}') {
              const idx = spaceCount++;
              const currentValId = userAnswers?.[idx]; // ID of selected option
              const selectedOpt = parsedOptions.find((o: QuestionOption) => o.id === currentValId);
              
              const isCorrect = showResult && parsedCorrect && parsedCorrect[idx] === currentValId;
              const isWrong = showResult && !isCorrect;

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (showResult) return;
                    // If already filled, clear it
                    if (currentValId) {
                       onAnswer({ ...userAnswers, [idx]: undefined });
                    } else {
                       onAnswer({ ...userAnswers, activeSpace: idx });
                    }
                  }}
                  className={`inline-block min-w-[80px] h-8 border-b-2 mx-1 px-2 align-bottom text-center transition-colors ${
                    userAnswers?.activeSpace === idx ? 'border-blue-500 bg-blue-50' : 'border-zinc-300'
                  } ${
                    isCorrect ? 'border-green-500 text-green-600' : 
                    isWrong ? 'border-red-500 text-red-600' : ''
                  }`}
                >
                  {selectedOpt ? <Latex>{selectedOpt.content}</Latex> : <span className="text-zinc-300 text-xs">点击选择</span>}
                </button>
              );
            }
            return <span key={i}><Latex>{part}</Latex></span>;
          })}
          <span className="ml-2 text-xs text-zinc-500 font-normal">({question.score ?? 1}分)</span>
        </div>

        {/* Options Pool */}
        <div className="flex flex-wrap gap-2 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
          {parsedOptions.map((opt: QuestionOption) => {
            // Check if this option is used anywhere (excluding activeSpace)
            // We allow reuse now as per request "user can repeatedly select"
            // But maybe visual feedback is still nice?
            // Let's just highlight if used but not disable.
            const usedOptionIds = Object.entries(userAnswers || {})
              .filter(([k]) => k !== 'activeSpace')
              .map(([, v]) => v);
            const isUsed = usedOptionIds.includes(opt.id);
            
            return (
              <button
                key={opt.id}
                disabled={showResult}
                onClick={() => {
                  if (userAnswers?.activeSpace !== undefined) {
                    onAnswer({ 
                      ...userAnswers, 
                      [userAnswers.activeSpace]: opt.id,
                      activeSpace: undefined // Deselect space after filling
                    });
                  }
                }}
                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                  isUsed ? 'bg-zinc-100 border-zinc-300 text-zinc-600' : 'bg-white border-zinc-300 hover:border-blue-500 hover:text-blue-600 shadow-sm'
                }`}
              >
                <Latex>{opt.content}</Latex>
                {isUsed && <span className="ml-1 text-xs text-zinc-400">•</span>}
              </button>
            );
          })}
        </div>
        {userAnswers?.activeSpace !== undefined && (
          <div className="text-xs text-blue-600 animate-pulse">请从下方选择一个词填入上方高亮的空格中...</div>
        )}
      </div>
    );
  };

  // --- Main Render ---
  if (type === 'single' || type === 'multiple') {
    // Existing logic handled in TaskA, but could be moved here.
    // For now, return null to let TaskA handle it, or implement it here for consistency?
    // Let's implement it here to unify.
    return (
      <div className="space-y-4">
        <div className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
          <Latex>{content}</Latex>
          <span className="ml-2 text-xs text-zinc-500 font-normal">({question.score ?? 1}分)</span>
        </div>
        <div className="space-y-2">
          {parsedOptions.map((opt: QuestionOption) => {
            const currentAns = userAnswers || [];
            const isSelected = currentAns.includes(opt.id);
            const isCorrect = parsedCorrect?.includes(opt.id);
            
            let optClass = "border-zinc-200 hover:bg-zinc-50";
            if (showResult) {
              if (isCorrect) optClass = "border-green-500 bg-green-50 text-green-700 font-medium";
              else if (isSelected && !isCorrect) optClass = "border-red-500 bg-red-50 text-red-700";
              else if (!isSelected && !isCorrect) optClass = "border-zinc-200 opacity-50";
            } else {
              if (isSelected) optClass = "border-indigo-500 bg-indigo-50 text-indigo-700";
            }

            return (
              <div 
                key={opt.id} 
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${optClass}`}
                onClick={() => {
                  if (showResult) return;
                  if (type === 'single') onAnswer([opt.id]);
                  else {
                    if (isSelected) onAnswer(currentAns.filter((id: string) => id !== opt.id));
                    else onAnswer([...currentAns, opt.id]);
                  }
                }}
              >
                <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${
                  isSelected ? 'border-current bg-current' : 'border-zinc-400'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className="text-sm"><Latex>{opt.content}</Latex></span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'fill' || type === 'cloze') {
    return renderTextWithBlanks();
  }

  if (type === 'fishing') {
    return renderFishing();
  }

  if (type === 'big') {
    const totalScore = question.children?.reduce((acc, child) => acc + (child.score ?? 1), 0) || 0;
    return (
      <div className="space-y-6">
        <div className="prose prose-sm max-w-none bg-zinc-50 p-4 rounded-lg border border-zinc-200">
          {/* Material */}
          <div className="whitespace-pre-wrap">
            <Latex>{content}</Latex>
            <span className="ml-2 text-xs text-zinc-500 font-normal">({totalScore}分)</span>
          </div>
        </div>
        <div className="space-y-8 pl-4 border-l-2 border-zinc-100">
          {question.children?.map((child, i) => (
            <div key={child.id} id={`question-${child.id}`} className="relative">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                  {index !== undefined ? `${index + 1}.${i + 1}` : `${i + 1}`}
                </span>
                <span className="text-xs text-zinc-400 uppercase">{child.type}</span>
              </div>
              {onToggleMark && (
                <div className="absolute top-0 right-0">
                  <button 
                    onClick={() => onToggleMark(child.id, child.is_marked)}
                    className={`p-1 rounded-full transition-colors ${child.is_marked === 1 ? 'text-amber-500 bg-amber-50' : 'text-zinc-300 hover:text-amber-500 hover:bg-zinc-50'}`}
                    title={child.is_marked === 1 ? "取消标记" : "标记此题"}
                  >
                    <Star className={`h-4 w-4 ${child.is_marked === 1 ? 'fill-current' : ''}`} />
                  </button>
                </div>
              )}
              <QuestionRenderer 
                question={child} 
                userAnswers={userAnswers?.[child.id]} 
                onAnswer={(ans) => onAnswer({ ...userAnswers, [child.id]: ans })}
                showResult={showResult}
                onToggleMark={onToggleMark}
              />
              {/* Show explanation for child if result shown */}
              {showResult && (
                <div className="mt-2 text-xs text-zinc-500 bg-zinc-50 p-2 rounded">
                  <span className="font-bold">解析：</span> {child.answer_content ? <Latex>{child.answer_content}</Latex> : '无'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback for essay
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
        <Latex>{content}</Latex>
        <span className="ml-2 text-xs text-zinc-500 font-normal">({question.score ?? 1}分)</span>
      </div>
      <div className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-lg border border-zinc-100">请在心中作答或写在纸上。</div>
    </div>
  );
}
