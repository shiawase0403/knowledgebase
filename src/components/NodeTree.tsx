import React, { useState } from 'react';
import { api } from '../services/api';
import { extractTextFromImage } from '../services/ocr';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChevronRight, ChevronDown, Plus, Image as ImageIcon, FileText, Trash2, Loader2 } from 'lucide-react';

interface Node {
  id: string;
  parent_id: string | null;
  content: string;
  image_url: string | null;
  pdf_url: string | null;
  ocr_text: string | null;
  children?: Node[];
}

interface NodeTreeProps {
  nodes: Node[];
  taskId: string;
  onUpdate: () => void;
}

export function NodeTree({ nodes, taskId, onUpdate }: NodeTreeProps) {
  const rootNodes = nodes.filter(n => !n.parent_id);
  
  const buildTree = (parent: Node): Node => {
    return {
      ...parent,
      children: nodes.filter(n => n.parent_id === parent.id).map(buildTree)
    };
  };

  const tree = rootNodes.map(buildTree);

  return (
    <div className="space-y-1">
      {tree.map(node => (
        <TreeNode key={node.id} node={node} taskId={taskId} onUpdate={onUpdate} />
      ))}
      <div className="pl-6 pt-2">
        <AddNode parentId={null} taskId={taskId} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function TreeNode({ node, taskId, onUpdate }: { key?: string, node: Node, taskId: string, onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(node.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleUpdate = async () => {
    if (content !== node.content) {
      await api.updateNode(node.id, { content });
      onUpdate();
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await api.deleteNode(node.id);
    onUpdate();
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      const imageUrls: string[] = [];
      const pdfUrls: string[] = [];
      let combinedOcrText = '';

      // Parse existing URLs if any
      try {
        if (node.image_url) {
          const parsed = JSON.parse(node.image_url);
          if (Array.isArray(parsed)) imageUrls.push(...parsed);
          else imageUrls.push(node.image_url);
        }
      } catch (e) {
        if (node.image_url) imageUrls.push(node.image_url);
      }

      try {
        if (node.pdf_url) {
          const parsed = JSON.parse(node.pdf_url);
          if (Array.isArray(parsed)) pdfUrls.push(...parsed);
          else pdfUrls.push(node.pdf_url);
        }
      } catch (e) {
        if (node.pdf_url) pdfUrls.push(node.pdf_url);
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { url } = await api.uploadFile(file);
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          imageUrls.push(url);
          const ocr_text = await extractTextFromImage(file);
          if (ocr_text) combinedOcrText += ocr_text + '\n';
        } else {
          pdfUrls.push(url);
        }
      }

      await api.updateNode(node.id, { 
        content: node.content,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : node.image_url,
        pdf_url: pdfUrls.length > 0 ? JSON.stringify(pdfUrls) : node.pdf_url,
        ocr_text: combinedOcrText ? ((node.ocr_text || '') + '\n' + combinedOcrText).trim() : node.ocr_text
      });
      onUpdate();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  const renderMedia = (urlData: string | null, isPdf: boolean = false) => {
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
        <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-xs mt-2">
          <FileText className="h-3 w-3 mr-1" /> View PDF {urls.length > 1 ? i + 1 : ''}
        </a>
      ));
    }
    
    return urls.map((url, i) => (
      <img key={i} src={url} alt="Node attachment" className="mt-2 rounded-md max-w-full h-auto max-h-48 object-cover" />
    ));
  };

  return (
    <div className="pl-6 relative">
      <div className="flex items-start group py-1">
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="absolute left-0 top-2 p-0.5 text-zinc-400 hover:text-zinc-900"
        >
          {node.children?.length ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="h-4 w-4 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
            </div>
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input 
              value={content}
              onChange={e => setContent(e.target.value)}
              onBlur={handleUpdate}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <div 
              className="text-sm py-1 px-2 hover:bg-zinc-100 rounded cursor-text"
              onClick={() => setEditing(true)}
            >
              {node.content || <span className="text-zinc-400 italic">Empty node</span>}
            </div>
          )}

          {renderMedia(node.image_url, false)}
          {renderMedia(node.pdf_url, true)}
        </div>

        <div className="flex items-center space-x-1 ml-2 text-zinc-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {isUploading ? (
            <div className="p-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>
          ) : (
            <label className="cursor-pointer p-1 hover:text-zinc-900 rounded">
              <input type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
              <ImageIcon className="h-3.5 w-3.5" />
            </label>
          )}
          <button onClick={handleDelete} className={`p-1 rounded ${confirmDelete ? 'text-red-600 font-bold text-xs' : 'hover:text-red-600'}`}>
            {confirmDelete ? 'Sure?' : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-l border-zinc-200 ml-2">
          {node.children?.map(child => (
            <TreeNode key={child.id} node={child} taskId={taskId} onUpdate={onUpdate} />
          ))}
          <div className="pl-6 pt-1">
            <AddNode parentId={node.id} taskId={taskId} onUpdate={onUpdate} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddNode({ parentId, taskId, onUpdate }: { parentId: string | null, taskId: string, onUpdate: () => void }) {
  const [content, setContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!content.trim()) {
      setIsAdding(false);
      return;
    }
    await api.createNode({ task_id: taskId, parent_id: parentId, content });
    setContent('');
    setIsAdding(false);
    onUpdate();
  };

  if (!isAdding) {
    return (
      <button 
        onClick={() => setIsAdding(true)}
        className="flex items-center text-xs text-zinc-400 hover:text-zinc-900 py-1"
      >
        <Plus className="h-3 w-3 mr-1" /> Add node
      </button>
    );
  }

  return (
    <Input 
      value={content}
      onChange={e => setContent(e.target.value)}
      onBlur={handleAdd}
      onKeyDown={e => e.key === 'Enter' && handleAdd()}
      autoFocus
      placeholder="Type to add..."
      className="h-8 text-sm"
    />
  );
}
