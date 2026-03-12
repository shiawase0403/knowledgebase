import { useState, useEffect } from 'react';
import { DictionaryEntry, EntryDefinition } from '../types';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface DictionaryEntryEditorProps {
  entry?: DictionaryEntry;
  onSave: (data: any) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function DictionaryEntryEditor({ entry, onSave, onCancel, onDelete }: DictionaryEntryEditorProps) {
  const [key, setKey] = useState(entry?.key || '');
  const [entries, setEntries] = useState<EntryDefinition[]>([]);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [antonyms, setAntonyms] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<string[]>([]);

  useEffect(() => {
    if (entry) {
      setKey(entry.key);
      try { setEntries(JSON.parse(entry.entries)); } catch (e) { setEntries([]); }
      try { setSynonyms(JSON.parse(entry.synonyms)); } catch (e) { setSynonyms([]); }
      try { setAntonyms(JSON.parse(entry.antonyms)); } catch (e) { setAntonyms([]); }
      try { setComparisons(JSON.parse(entry.comparisons)); } catch (e) { setComparisons([]); }
    } else {
      setKey('');
      setEntries([]);
      setSynonyms([]);
      setAntonyms([]);
      setComparisons([]);
    }
  }, [entry]);

  const handleSave = () => {
    if (!key.trim()) return alert('请输入词条名称');
    onSave({ key, entries, synonyms, antonyms, comparisons });
  };

  const addEntry = (type: 'index' | 'free') => {
    setEntries([...entries, { id: crypto.randomUUID(), type, meaning: '', example: '', content: '' }]);
  };

  const updateEntry = (id: string, field: keyof EntryDefinition, value: string) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const renderListEditor = (title: string, list: string[], setList: (l: string[]) => void) => {
    const [inputValue, setInputValue] = useState('');
    
    const handleAdd = () => {
      if (inputValue.trim() && !list.includes(inputValue.trim())) {
        setList([...list, inputValue.trim()]);
        setInputValue('');
      }
    };

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">{title}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {list.map((item, i) => (
            <span key={i} className="bg-zinc-100 px-2 py-1 rounded-md text-sm flex items-center">
              {item}
              <button onClick={() => setList(list.filter((_, idx) => idx !== i))} className="ml-2 text-zinc-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <Input 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            placeholder={`添加${title}...`}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleAdd}>添加</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-bold">{entry ? '编辑词条' : '新增词条'}</h2>
        <div className="flex items-center space-x-2">
          {onDelete && (
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> 删除
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> 保存</Button>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-zinc-700">词条名称 (Key)</label>
        <Input 
          value={key} 
          onChange={e => setKey(e.target.value)} 
          placeholder="输入要查的内容，如单词或实词..."
          className="text-lg font-medium"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700">释义列表</label>
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={() => addEntry('index')}>
              <Plus className="h-3 w-3 mr-1" /> 索引条目
            </Button>
            <Button size="sm" variant="outline" onClick={() => addEntry('free')}>
              <Plus className="h-3 w-3 mr-1" /> 自由条目
            </Button>
          </div>
        </div>

        {entries.map((e, i) => (
          <div key={e.id} className="p-4 border rounded-lg bg-zinc-50 relative group">
            <button 
              onClick={() => removeEntry(e.id)}
              className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            
            <div className="mb-2 text-xs font-bold text-zinc-400 uppercase">
              {e.type === 'index' ? '索引条目' : '自由条目'} #{i + 1}
            </div>

            {e.type === 'index' ? (
              <div className="space-y-3">
                <Input 
                  placeholder="释义..." 
                  value={e.meaning || ''} 
                  onChange={ev => updateEntry(e.id, 'meaning', ev.target.value)} 
                />
                <Textarea 
                  placeholder="例句 (支持换行)..." 
                  value={e.example || ''} 
                  onChange={ev => updateEntry(e.id, 'example', ev.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            ) : (
              <Textarea 
                placeholder="自由编辑内容 (支持换行)..." 
                value={e.content || ''} 
                onChange={ev => updateEntry(e.id, 'content', ev.target.value)}
                className="min-h-[120px]"
              />
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-8 text-zinc-400 border-2 border-dashed rounded-lg">
            暂无释义，点击上方按钮添加。
          </div>
        )}
      </div>

      <div className="space-y-6 pt-6 border-t">
        <h3 className="text-lg font-semibold">跳查设置</h3>
        {renderListEditor('近义词', synonyms, setSynonyms)}
        {renderListEditor('反义词', antonyms, setAntonyms)}
        {renderListEditor('对比', comparisons, setComparisons)}
      </div>
    </div>
  );
}
