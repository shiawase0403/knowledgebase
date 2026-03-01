import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Trash2, FileJson, Printer } from 'lucide-react';
import { NodeTree } from '../components/NodeTree';

function PrintableView({ nodes, title }: { nodes: any[], title: string }) {
  const rootNodes = nodes.filter(n => !n.parent_id);
  
  const buildTree = (parent: any): any => {
    return {
      ...parent,
      children: nodes.filter(n => n.parent_id === parent.id).map(buildTree)
    };
  };

  const tree = rootNodes.map(buildTree);

  const renderPrintNode = (node: any, level: number = 0) => {
    let imageUrls: string[] = [];
    if (node.image_url) {
      try {
        imageUrls = JSON.parse(node.image_url);
        if (!Array.isArray(imageUrls)) imageUrls = [node.image_url];
      } catch (e) {
        imageUrls = [node.image_url];
      }
    }

    const isRoot = level === 0;

    return (
      <div key={node.id} className={`mb-6 break-inside-avoid ${isRoot ? 'border-t border-zinc-100 pt-6' : ''}`}>
        <div className="flex items-start gap-3">
          {!isRoot && (
            <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
          )}
          <div className="flex-1">
            <div className={`${
              isRoot 
                ? 'text-xl font-bold text-zinc-900 tracking-tight' 
                : level === 1 
                  ? 'text-lg font-semibold text-zinc-800' 
                  : 'text-base text-zinc-700 leading-relaxed'
            }`}>
              {node.content}
            </div>
            
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-4">
                {imageUrls.map((url, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-zinc-100 bg-zinc-50">
                    <img src={url} alt="attachment" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                  </div>
                ))}
              </div>
            )}

            {node.children && node.children.length > 0 && (
              <div className="mt-4 space-y-4 ml-4 pl-4 border-l border-zinc-100">
                {node.children.map((child: any) => renderPrintNode(child, level + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="hidden print:block p-12 max-w-4xl mx-auto bg-white text-zinc-900 font-sans leading-normal">
      <header className="mb-16 text-center">
        <div className="inline-block px-3 py-1 mb-4 text-[10px] font-bold tracking-widest uppercase text-zinc-400 border border-zinc-200 rounded-full">
          Knowledge Outline
        </div>
        <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight mb-4">{title}</h1>
        <div className="w-12 h-1 bg-zinc-900 mx-auto mb-6" />
        <p className="text-sm text-zinc-400 font-medium">
          Generated on {new Date().toLocaleDateString()}
        </p>
      </header>
      
      <main className="space-y-8">
        {tree.map((node: any) => renderPrintNode(node))}
      </main>

      <footer className="mt-20 pt-8 border-t border-zinc-100 text-center text-[10px] text-zinc-300 uppercase tracking-widest">
        End of Document • {title}
      </footer>
    </div>
  );
}

export default function TaskB() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<any[]>([]);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);

  const taskTitle = location.state?.title || 'Knowledge Outline';

  const fetchNodes = () => {
    if (id) api.getNodes(id).then(setNodes);
  };

  useEffect(() => {
    fetchNodes();
  }, [id]);

  const handleDeleteTask = async () => {
    if (!id) return;
    if (!confirmDeleteTask) {
      setConfirmDeleteTask(true);
      setTimeout(() => setConfirmDeleteTask(false), 3000);
      return;
    }
    await api.deleteTask(id);
    navigate(-1);
  };

  const handleExportJson = () => {
    const buildTree = (parent: any): any => {
      return {
        content: parent.content,
        image_url: parent.image_url,
        children: nodes.filter(n => n.parent_id === parent.id).map(buildTree)
      };
    };
    const rootNodes = nodes.filter(n => !n.parent_id);
    const tree = rootNodes.map(buildTree);
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tree, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${taskTitle}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <>
      <div className="print:hidden p-4 max-w-4xl mx-auto space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold truncate">{taskTitle}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleExportJson} title="Export JSON">
              <FileJson className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export JSON</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} title="Print / Export PDF">
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDeleteTask}
              className={confirmDeleteTask ? 'text-red-600 font-bold' : 'text-zinc-400 hover:text-red-600'}
              title="Delete Task"
            >
              {confirmDeleteTask ? 'Sure?' : <Trash2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <Card className="p-6 bg-white shadow-sm border-zinc-200">
          <NodeTree nodes={nodes} taskId={id!} onUpdate={fetchNodes} />
        </Card>
      </div>
      <PrintableView nodes={nodes} title={taskTitle} />
    </>
  );
}
