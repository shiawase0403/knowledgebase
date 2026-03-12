import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { DictionaryEntry } from '../types';
import { ArrowLeft, Search, Edit3, List, Plus, Settings, Trash2, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import DictionaryEntryEditor from '../components/DictionaryEntryEditor';
import DictionaryEntryViewer from '../components/DictionaryEntryViewer';

type ViewMode = 'edit' | 'query' | 'index' | 'settings';

export default function DictionaryView({ task }: { task: any }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [mode, setMode] = useState<ViewMode>('query');
  const [query, setQuery] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hoveredReview, setHoveredReview] = useState<{ x: number, y: number, text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (task?.id) {
      loadData();
    }
  }, [task?.id]);

  const loadData = async () => {
    const data = await api.getDictionaryEntries(task.id);
    setEntries(data);
  };

  const handleSaveEntry = async (entryData: any) => {
    if (selectedEntryId) {
      await api.updateDictionaryEntry(selectedEntryId, entryData);
    } else {
      await api.createDictionaryEntry(task.id, entryData);
    }
    setIsEditing(false);
    setSelectedEntryId(null);
    loadData();
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm('确定要删除这个词条吗？')) {
      await api.deleteDictionaryEntry(entryId);
      if (selectedEntryId === entryId) {
        setSelectedEntryId(null);
        setIsEditing(false);
      }
      loadData();
    }
  };

  const handleEntryClick = async (entryId: string) => {
    setSelectedEntryId(entryId);
    setIsEditing(mode === 'edit');
    if (mode === 'query' || mode === 'index') {
      await api.queryDictionaryEntry(entryId);
      loadData(); // Refresh query count
    }
  };

  const handleDeleteDictionary = async () => {
    if (deleteConfirm === task.title) {
      await api.deleteTask(task.id);
      window.location.href = `/subjects/${task.subject_id}`;
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        alert('导入失败：JSON 格式不正确，应为一个数组。');
        return;
      }

      await api.bulkCreateDictionaryEntries(task.id, data);
      
      // Refresh entries
      const res = await api.getDictionaryEntries(task.id);
      setEntries(res);
      alert(`成功导入 ${data.length} 个词条！`);
      
      // Reset file input
      e.target.value = '';
    } catch (err) {
      console.error(err);
      alert('导入失败，请检查 JSON 文件格式。');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredEntries = entries.filter(e => {
    if (!query) return true;
    const q = query.toLowerCase();
    return e.key.toLowerCase().includes(q) || e.entries.toLowerCase().includes(q);
  });

  const groupedEntries = entries.reduce((acc, entry) => {
    const firstLetter = entry.key.charAt(0).toUpperCase();
    if (!acc[firstLetter]) acc[firstLetter] = [];
    acc[firstLetter].push(entry);
    return acc;
  }, {} as Record<string, DictionaryEntry[]>);

  if (!task) return <div className="p-8 text-center">加载中...</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-zinc-50">
      {/* Sidebar */}
      <div className={`w-full md:w-80 bg-white border-r flex-col ${selectedEntryId || isEditing ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2 mb-4">
            <Link to={`/subjects/${task.subject_id}`} className="p-2 hover:bg-zinc-100 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold truncate">{task.title}</h1>
          </div>
          
          <div className="flex bg-zinc-100 p-1 rounded-lg mb-4">
            <button 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${mode === 'query' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              onClick={() => { setMode('query'); setIsEditing(false); setSelectedEntryId(null); }}
            >
              <Search className="h-4 w-4 mx-auto mb-1" />
              查询
            </button>
            <button 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${mode === 'index' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              onClick={() => { setMode('index'); setIsEditing(false); setSelectedEntryId(null); }}
            >
              <List className="h-4 w-4 mx-auto mb-1" />
              索引
            </button>
            <button 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${mode === 'edit' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              onClick={() => { setMode('edit'); setIsEditing(false); setSelectedEntryId(null); }}
            >
              <Edit3 className="h-4 w-4 mx-auto mb-1" />
              编辑
            </button>
            <button 
              className={`flex-1 py-1 text-sm font-medium rounded-md ${mode === 'settings' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              onClick={() => { setMode('settings'); setIsEditing(false); setSelectedEntryId(null); }}
            >
              <Settings className="h-4 w-4 mx-auto mb-1" />
              设置
            </button>
          </div>

          {(mode === 'query' || mode === 'edit') && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="搜索词条..." 
                className="pl-9"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mode === 'edit' && (
            <Button 
              className="w-full mb-2" 
              variant="outline"
              onClick={() => { setSelectedEntryId(null); setIsEditing(true); }}
            >
              <Plus className="h-4 w-4 mr-2" /> 新增词条
            </Button>
          )}

          {(mode === 'query' || mode === 'edit') && (
            <div className="space-y-1">
              {filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleEntryClick(entry.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedEntryId === entry.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-zinc-100 text-zinc-700'}`}
                >
                  {entry.key}
                </button>
              ))}
              {filteredEntries.length === 0 && (
                <div className="text-center py-4 text-zinc-500 text-sm">无结果</div>
              )}
            </div>
          )}

          {mode === 'index' && (
            <div className="space-y-4 p-2">
              {Object.keys(groupedEntries).sort().map(letter => (
                <div key={letter}>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">{letter}</h3>
                  <div className="space-y-1">
                    {groupedEntries[letter].map(entry => (
                      <button
                        key={entry.id}
                        onClick={() => handleEntryClick(entry.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (entry.review) {
                            setHoveredReview({ x: e.clientX, y: e.clientY, text: entry.review });
                            setTimeout(() => setHoveredReview(null), 3000);
                          } else {
                            setHoveredReview({ x: e.clientX, y: e.clientY, text: '暂无评价' });
                            setTimeout(() => setHoveredReview(null), 2000);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedEntryId === entry.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-zinc-100 text-zinc-700'}`}
                      >
                        {entry.key}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {mode === 'settings' && (
            <div className="p-4 space-y-8">
              <div className="space-y-4">
                <h3 className="font-bold text-zinc-800 flex items-center">
                  <Upload className="h-4 w-4 mr-2" /> 批量导入
                </h3>
                <p className="text-sm text-zinc-600">
                  支持导入 JSON 格式的词条数据。文件应为一个包含词条对象的数组。
                </p>
                <div className="relative">
                  <Input 
                    type="file" 
                    accept=".json"
                    onChange={handleImportJson}
                    disabled={isImporting}
                    className="cursor-pointer"
                  />
                  {isImporting && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center text-sm font-medium text-indigo-600">
                      导入中...
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-bold text-red-600 flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" /> 删除字典
                </h3>
                <p className="text-sm text-zinc-600">
                  此操作不可恢复。请输入字典名称 <strong>{task.title}</strong> 以确认删除。
                </p>
                <Input 
                  placeholder="输入字典名称" 
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                />
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={deleteConfirm !== task.title}
                  onClick={handleDeleteDictionary}
                >
                  确认删除
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto bg-white flex-col ${!selectedEntryId && !isEditing ? 'hidden md:flex' : 'flex'}`}>
        <div className="md:hidden p-4 border-b flex items-center bg-zinc-50">
          <button onClick={() => { setSelectedEntryId(null); setIsEditing(false); }} className="mr-2 p-2 hover:bg-zinc-200 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-medium">{isEditing ? (selectedEntryId ? '编辑词条' : '新增词条') : '词条详情'}</span>
        </div>
        
        {isEditing ? (
          <DictionaryEntryEditor 
            entry={entries.find(e => e.id === selectedEntryId)}
            onSave={handleSaveEntry}
            onCancel={() => setIsEditing(false)}
            onDelete={selectedEntryId ? () => handleDeleteEntry(selectedEntryId) : undefined}
          />
        ) : selectedEntryId ? (
          <DictionaryEntryViewer 
            entry={entries.find(e => e.id === selectedEntryId)!}
            entries={entries}
            onEntryClick={handleEntryClick}
            onUpdateStars={async () => {
              const res = await api.updateEntryStars(selectedEntryId);
              setEntries(entries.map(e => e.id === selectedEntryId ? { ...e, stars: res.stars } : e));
            }}
            onUpdateReview={async (review) => {
              await api.updateEntryReview(selectedEntryId, review);
              setEntries(entries.map(e => e.id === selectedEntryId ? { ...e, review } : e));
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-400 flex-col hidden md:flex">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p>请在左侧选择或搜索词条</p>
          </div>
        )}
      </div>

      {hoveredReview && (
        <div 
          className="fixed z-50 bg-zinc-800 text-white text-sm px-3 py-2 rounded shadow-lg max-w-xs pointer-events-none"
          style={{ top: hoveredReview.y + 10, left: hoveredReview.x + 10 }}
        >
          {hoveredReview.text}
        </div>
      )}
    </div>
  );
}
