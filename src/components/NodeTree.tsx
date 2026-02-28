import React, { useState } from 'react';
import { api } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChevronRight, ChevronDown, Plus, Image as ImageIcon, FileText, Trash2 } from 'lucide-react';

interface Node {
  id: string;
  parent_id: string | null;
  content: string;
  image_url: string | null;
  pdf_url: string | null;
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url } = await api.uploadFile(file);
    const isImage = file.type.startsWith('image/');
    await api.updateNode(node.id, { 
      content: node.content,
      image_url: isImage ? url : node.image_url,
      pdf_url: !isImage ? url : node.pdf_url
    });
    onUpdate();
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

          {node.image_url && (
            <img src={node.image_url} alt="Node attachment" className="mt-2 rounded-md max-w-full h-auto max-h-48 object-cover" />
          )}
          {node.pdf_url && (
            <a href={node.pdf_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 text-xs mt-2">
              <FileText className="h-3 w-3 mr-1" /> View PDF
            </a>
          )}
        </div>

        <div className="flex items-center space-x-1 ml-2 text-zinc-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <label className="cursor-pointer p-1 hover:text-zinc-900 rounded">
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
            <ImageIcon className="h-3.5 w-3.5" />
          </label>
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
