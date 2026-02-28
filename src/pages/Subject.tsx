import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, ArrowLeft } from 'lucide-react';

export default function Subject() {
  const { id } = useParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'A' | 'B'>('A');

  useEffect(() => {
    if (id) {
      api.getTasks(id).then(setTasks);
    }
  }, [id]);

  const handleCreate = async () => {
    if (!title.trim() || !id) return;
    const newTask = await api.createTask({ subject_id: id, title, type });
    setTasks([newTask, ...tasks]);
    setTitle('');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Tasks</h1>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="text-sm font-semibold">Create New Task</h2>
        <Input 
          placeholder="Task Title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
        />
        <div className="flex space-x-2">
          <Button 
            variant={type === 'A' ? 'default' : 'outline'} 
            onClick={() => setType('A')}
            className="flex-1"
          >
            Type A (Questions)
          </Button>
          <Button 
            variant={type === 'B' ? 'default' : 'outline'} 
            onClick={() => setType('B')}
            className="flex-1"
          >
            Type B (Outline)
          </Button>
        </div>
        <Button onClick={handleCreate} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Create Task
        </Button>
      </Card>

      <div className="space-y-3">
        {tasks.map(task => (
          <Link key={task.id} to={`/tasks/${task.id}`} state={{ type: task.type, title: task.title }}>
            <Card className="hover:bg-zinc-50 transition-colors mb-3">
              <CardHeader className="p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{task.title}</CardTitle>
                <span className="text-xs px-2 py-1 bg-zinc-100 rounded-full font-medium">
                  Type {task.type}
                </span>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
