import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle2, AlertCircle, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '../services/api';
import { QuestionRenderer } from './QuestionRenderer';
import { QuestionEditor } from './QuestionEditor';

interface AIPaperImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
}

export function AIPaperImportModal({ isOpen, onClose, onImport }: AIPaperImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [strategy, setStrategy] = useState<'extract' | 'generate' | 'blank'>('extract');
  const [aiModel, setAiModel] = useState<'glm' | 'gemini'>('glm');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [userInstruction, setUserInstruction] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // For preview pane
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Reset state when modal opens and cleanup on close
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFiles([]);
      setStrategy('extract');
      setAiModel('glm');
      setParsedData([]);
      setEditingIndex(null);
      setError(null);
      setRawAiResponse(null);
      setShowRaw(false);
      setStreamingText('');
      setUserInstruction('');
      setActiveFileIndex(0);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  // Handle object URL cleanup
  React.useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setStep(2);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setError(null);
    setRawAiResponse(null);
    setShowRaw(false);
    setStreamingText('');
    setStep(3);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      formData.append('strategy', strategy);
      formData.append('aiModel', aiModel);
      formData.append('userInstruction', userInstruction);

      const res = await api.recognizePaper(formData, (text) => {
        setStreamingText(text);
      }, controller.signal);
      
      if (res.error) {
        if (res.raw) {
          setRawAiResponse(res.raw);
        }
        throw new Error(res.error + (res.details ? ` (${JSON.stringify(res.details)})` : ''));
      }

      if (res.data && Array.isArray(res.data)) {
        setParsedData(res.data);
        setStep(4);
      } else {
        throw new Error('AI 返回的数据格式不正确，期望一个数组。');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error(err);
      setError(err.message || '识别失败，请重试。');
      setStep(2); // Go back to strategy selection on error
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleConfirmImport = () => {
    onImport(parsedData);
    onClose();
  };

  const updateQuestion = (index: number, updatedQuestion: any) => {
    const newData = [...parsedData];
    newData[index] = updatedQuestion;
    setParsedData(newData);
    setEditingIndex(null);
  };

  const deleteQuestion = (index: number) => {
    const newData = [...parsedData];
    newData.splice(index, 1);
    setParsedData(newData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-800 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" />
            AI 智能识图导入
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 1 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div 
                className="w-full max-w-2xl border-2 border-dashed border-zinc-300 rounded-2xl p-12 flex flex-col items-center justify-center bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-zinc-400 mb-4" />
                <h3 className="text-lg font-medium text-zinc-700 mb-2">点击或拖拽上传试卷图片</h3>
                <p className="text-sm text-zinc-500 text-center max-w-md">
                  支持上传多张图片（如试卷页、答案页）。请尽量保证图片清晰、端正，以获得最佳识别效果。
                </p>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 overflow-y-auto bg-zinc-50">
              <div className="min-h-full flex items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-100">
                  <h3 className="text-lg font-bold text-zinc-800 mb-6 text-center">选择识别配置</h3>
                
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-zinc-700 mb-3">1. 选择 AI 模型</h4>
                  <div className="space-y-3">
                    <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${aiModel === 'glm' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input type="radio" name="aiModel" value="glm" checked={aiModel === 'glm'} onChange={() => setAiModel('glm')} className="mt-1 mr-3" />
                      <div>
                        <div className="font-medium text-zinc-800">智谱 GLM-4.6v</div>
                        <div className="text-sm text-zinc-500 mt-1">支持 32k 超长输出，适合复杂长试卷解析。（需配置 GLM_API_KEY）</div>
                      </div>
                    </label>
                    <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${aiModel === 'gemini' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input type="radio" name="aiModel" value="gemini" checked={aiModel === 'gemini'} onChange={() => setAiModel('gemini')} className="mt-1 mr-3" />
                      <div>
                        <div className="font-medium text-zinc-800">Google Gemini 3.1 Pro</div>
                        <div className="text-sm text-zinc-500 mt-1">支持 200万 Token 极致上下文，免费且强大。（需配置 GEMINI_API_KEY）</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-medium text-zinc-700 mb-3">2. 选择答案处理策略</h4>
                  <div className="space-y-3">
                    <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${strategy === 'extract' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input type="radio" name="strategy" value="extract" checked={strategy === 'extract'} onChange={() => setStrategy('extract')} className="mt-1 mr-3" />
                      <div>
                        <div className="font-medium text-zinc-800">答案在上传的图片中</div>
                        <div className="text-sm text-zinc-500 mt-1">AI 会自动从图片中寻找答案并匹配给题目。</div>
                      </div>
                    </label>

                    <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${strategy === 'generate' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input type="radio" name="strategy" value="generate" checked={strategy === 'generate'} onChange={() => setStrategy('generate')} className="mt-1 mr-3" />
                      <div>
                        <div className="font-medium text-zinc-800">请 AI 帮我生成解析和答案</div>
                        <div className="text-sm text-zinc-500 mt-1">AI 只提取题目，并依靠自己的知识库解答。</div>
                      </div>
                    </label>

                    <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${strategy === 'blank' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-zinc-200 hover:border-zinc-300'}`}>
                      <input type="radio" name="strategy" value="blank" checked={strategy === 'blank'} onChange={() => setStrategy('blank')} className="mt-1 mr-3" />
                      <div>
                        <div className="font-medium text-zinc-800">留空，我稍后手动填写</div>
                        <div className="text-sm text-zinc-500 mt-1">AI 只提取题目，答案字段留空。</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-medium text-zinc-700 mb-3">3. 额外提示 (可选)</h4>
                  <textarea
                    className="w-full p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-zinc-700 placeholder-zinc-400 resize-none h-24"
                    placeholder="例如：请只识别选择题；或者，请把所有填空题的答案都设为“略”..."
                    value={userInstruction}
                    onChange={(e) => setUserInstruction(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="mb-6 flex flex-col gap-2">
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 break-all">{error}</div>
                    </div>
                    {rawAiResponse && (
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowRaw(!showRaw)}
                          className="self-start text-xs"
                        >
                          {showRaw ? '隐藏 AI 原始返回' : '查看 AI 原始返回 (供调试)'}
                        </Button>
                        {showRaw && (
                          <div className="p-4 bg-zinc-900 text-zinc-300 rounded-lg text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                            {rawAiResponse}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <Button variant="ghost" onClick={() => setStep(1)}>返回重选图片</Button>
                  <Button onClick={handleProcess} className="bg-indigo-600 hover:bg-indigo-700">
                    开始识别 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6 flex-shrink-0" />
              <h3 className="text-xl font-medium text-zinc-800 mb-2 flex-shrink-0">AI 正在努力识别中...</h3>
              <p className="text-zinc-500 text-center max-w-md mb-6 flex-shrink-0">
                这可能需要几十秒到几分钟的时间，具体取决于图片数量和复杂度。请耐心等待。
              </p>
              {streamingText && (
                <div className="w-full max-w-3xl flex-1 bg-zinc-900 rounded-xl p-4 overflow-auto font-mono text-sm text-zinc-300 shadow-inner">
                  <pre className="whitespace-pre-wrap break-words">{streamingText}</pre>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Image Viewer */}
              <div className="w-1/2 border-r border-zinc-200 bg-zinc-100 flex flex-col">
                <div className="p-3 bg-white border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">原图预览 ({activeFileIndex + 1}/{files.length})</span>
                  <div className="flex space-x-2">
                    {files.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveFileIndex(idx)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${activeFileIndex === idx ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                  {previewUrls[activeFileIndex] && (
                    <img 
                      src={previewUrls[activeFileIndex]} 
                      alt="Preview" 
                      className="max-w-full h-auto shadow-md rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Right Pane: JSON Editor */}
              <div className="w-1/2 bg-zinc-50 flex flex-col">
                <div className="p-3 bg-white border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">识别结果校对 (共 {parsedData.length} 题)</span>
                  <span className="text-xs text-zinc-500">请检查并修正识别错误</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {parsedData.map((q, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                      <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200 flex justify-between items-center">
                        <span className="text-sm font-bold text-zinc-600">题目 #{index + 1}</span>
                        <div className="space-x-2">
                          <button onClick={() => setEditingIndex(index)} className="text-indigo-600 hover:text-indigo-800 text-sm">编辑</button>
                          <button onClick={() => deleteQuestion(index)} className="text-red-500 hover:text-red-700 text-sm">删除</button>
                        </div>
                      </div>
                      <div className="p-4">
                        {editingIndex === index ? (
                          <QuestionEditor 
                            initialData={q} 
                            onSave={(updated) => updateQuestion(index, updated)} 
                            onCancel={() => setEditingIndex(null)}
                          />
                        ) : (
                          <QuestionRenderer 
                            question={q} 
                            userAnswers={[]} 
                            onAnswer={() => {}} 
                            showResult={true} 
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedData.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                      未能识别出任何题目。
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white border-t border-zinc-200 flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setStep(2)}>重新识别</Button>
                  <Button onClick={handleConfirmImport} className="bg-indigo-600 hover:bg-indigo-700" disabled={parsedData.length === 0}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> 确认无误，批量入库
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
