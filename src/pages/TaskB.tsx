import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { NodeTree } from '../components/NodeTree';

export default function TaskB() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<any[]>([]);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);

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

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">{location.state?.title || 'Knowledge Outline'}</h1>
        </div>
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

      <Card className="p-6 bg-white shadow-sm border-zinc-200">
        <NodeTree nodes={nodes} taskId={id!} onUpdate={fetchNodes} />
      </Card>
    </div>
  );
}
