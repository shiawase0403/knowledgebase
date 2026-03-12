import { useState, useEffect } from 'react';
import { DictionaryEntry, EntryDefinition } from '../types';
import { Star, Eye, MessageSquare, Edit3, X } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface DictionaryEntryViewerProps {
  entry: DictionaryEntry;
  entries: DictionaryEntry[];
  onEntryClick: (id: string) => void;
  onUpdateStars: () => void;
  onUpdateReview: (review: string) => void;
}

export default function DictionaryEntryViewer({ entry, entries, onEntryClick, onUpdateStars, onUpdateReview }: DictionaryEntryViewerProps) {
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [antonyms, setAntonyms] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<string[]>([]);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewText, setReviewText] = useState('');
  
  // For Comparison View
  const [compareTabs, setCompareTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>(entry.key);

  useEffect(() => {
    try { setSynonyms(JSON.parse(entry.synonyms)); } catch (e) { setSynonyms([]); }
    try { setAntonyms(JSON.parse(entry.antonyms)); } catch (e) { setAntonyms([]); }
    try { setComparisons(JSON.parse(entry.comparisons)); } catch (e) { setComparisons([]); }
    setReviewText(entry.review || '');
    setCompareTabs([entry.key]);
    setActiveTab(entry.key);
  }, [entry]);

  const handleJump = (key: string) => {
    const target = entries.find(e => e.key.toLowerCase() === key.toLowerCase());
    if (target) {
      onEntryClick(target.id);
    } else {
      alert(`词条 "${key}" 尚未收录。`);
    }
  };

  const handleCompare = (keyStr: string) => {
    const keys = keyStr.split(',').map(k => k.trim()).filter(k => k);
    const newTabs = [...compareTabs];
    let added = false;
    let firstValidKey = '';

    for (const key of keys) {
      const target = entries.find(e => e.key.toLowerCase() === key.toLowerCase());
      if (target) {
        if (!newTabs.includes(target.key)) {
          newTabs.push(target.key);
          added = true;
        }
        if (!firstValidKey) firstValidKey = target.key;
      } else {
        alert(`词条 "${key}" 尚未收录。`);
      }
    }

    if (added) {
      setCompareTabs(newTabs);
      if (firstValidKey) setActiveTab(firstValidKey);
    }
  };

  const renderStars = () => {
    return (
      <div className="flex items-center space-x-1 cursor-pointer" onClick={onUpdateStars}>
        {[1, 2, 3, 4, 5].map(i => (
          <Star 
            key={i} 
            className={`h-5 w-5 ${i <= entry.stars ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300'}`} 
          />
        ))}
      </div>
    );
  };

  const renderEntryContent = (currentEntry: DictionaryEntry) => {
    let currentParsed: EntryDefinition[] = [];
    try { currentParsed = JSON.parse(currentEntry.entries); } catch (e) {}

    return (
      <div className="space-y-6">
        {currentParsed.map((def, i) => (
          <div key={def.id} className="border-l-4 border-indigo-500 pl-4 py-1">
            {def.type === 'index' ? (
              <div>
                <div className="font-bold text-lg text-zinc-900 mb-2">
                  <span className="text-indigo-600 mr-2">{i + 1}.</span>
                  {def.meaning}
                </div>
                {def.example && (
                  <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed bg-zinc-50 p-3 rounded-md">
                    {def.example}
                  </div>
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-zinc-800 leading-relaxed">
                {def.content}
              </div>
            )}
          </div>
        ))}
        {currentParsed.length === 0 && (
          <div className="text-zinc-400 italic">暂无释义内容</div>
        )}
      </div>
    );
  };

  const activeEntryData = entries.find(e => e.key === activeTab) || entry;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row justify-between items-start shrink-0 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-zinc-900 mb-2">{entry.key}</h1>
          <div className="flex items-center space-x-4 md:space-x-6 text-sm text-zinc-500">
            <span className="flex items-center"><Eye className="h-4 w-4 mr-1" /> {entry.query_count} 次查询</span>
            {renderStars()}
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end w-full md:w-auto">
          {isEditingReview ? (
            <div className="flex flex-col items-end space-y-2 w-full md:w-64">
              <Textarea 
                value={reviewText} 
                onChange={e => setReviewText(e.target.value)} 
                placeholder="添加评价..."
                className="text-sm min-h-[80px]"
              />
              <div className="flex space-x-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditingReview(false)}>取消</Button>
                <Button size="sm" onClick={() => { onUpdateReview(reviewText); setIsEditingReview(false); }}>保存</Button>
              </div>
            </div>
          ) : (
            <div 
              className="group cursor-pointer flex flex-col items-start md:items-end w-full"
              onClick={() => setIsEditingReview(true)}
            >
              <div className="flex items-center text-zinc-400 group-hover:text-indigo-600 transition-colors mb-1">
                <MessageSquare className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">评价</span>
                <Edit3 className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100" />
              </div>
              {entry.review && (
                <div className="text-sm text-zinc-600 bg-zinc-50 p-2 rounded max-w-xs text-left md:text-right italic border w-full md:w-auto">
                  "{entry.review}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs for Comparison */}
      {compareTabs.length > 1 && (
        <div className="flex border-b bg-zinc-50 px-4 md:px-8 pt-2 space-x-1 shrink-0 overflow-x-auto">
          {compareTabs.map(tab => (
            <div 
              key={tab}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium cursor-pointer flex items-center ${activeTab === tab ? 'bg-white border-t border-l border-r text-indigo-700' : 'text-zinc-500 hover:bg-zinc-100'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab !== entry.key && (
                <button 
                  className="ml-2 text-zinc-400 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newTabs = compareTabs.filter(t => t !== tab);
                    setCompareTabs(newTabs);
                    if (activeTab === tab) setActiveTab(newTabs[newTabs.length - 1]);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white">
        {renderEntryContent(activeEntryData)}

        {/* Jump Links */}
        <div className="mt-12 pt-8 border-t space-y-4">
          {synonyms.length > 0 && (
            <div className="flex items-start">
              <span className="text-sm font-bold text-zinc-400 w-16 shrink-0 mt-1">近义词</span>
              <div className="flex flex-wrap gap-2">
                {synonyms.map((syn, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleJump(syn)}
                    className="text-sm text-indigo-600 hover:underline hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                  >
                    {syn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {antonyms.length > 0 && (
            <div className="flex items-start">
              <span className="text-sm font-bold text-zinc-400 w-16 shrink-0 mt-1">反义词</span>
              <div className="flex flex-wrap gap-2">
                {antonyms.map((ant, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleJump(ant)}
                    className="text-sm text-rose-600 hover:underline hover:text-rose-800 bg-rose-50 px-2 py-1 rounded"
                  >
                    {ant}
                  </button>
                ))}
              </div>
            </div>
          )}

          {comparisons.length > 0 && (
            <div className="flex items-start">
              <span className="text-sm font-bold text-zinc-400 w-16 shrink-0 mt-1">对比</span>
              <div className="flex flex-wrap gap-2">
                {comparisons.map((comp, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleCompare(comp)}
                    className="text-sm text-emerald-600 hover:underline hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
                  >
                    对比({entry.key}, {comp})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
