import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, ArrowLeft, Book } from 'lucide-react';

export default function Subject() {
  const { id } = useParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'A' | 'B'>('A');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    if (id) {
      api.getTasks(id).then(setTasks);
    }
  }, [id]);

  const handleCreate = async () => {
    if (!title.trim() || !id) return;
    const newTask = await api.createTask({ subject_id: id, title, type, category });
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
        <h1 className="text-xl font-bold">任务列表</h1>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="text-sm font-semibold">创建新任务</h2>
        <Input 
          placeholder="任务标题" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
        />
        <div className="flex space-x-2">
          <Button 
            variant={type === 'A' && category !== 'dictionary' ? 'default' : 'outline'} 
            onClick={() => { setType('A'); setCategory(''); }}
            className="flex-1"
          >
            A 类 (试卷/错题)
          </Button>
          <Button 
            variant={type === 'B' && category !== 'dictionary' ? 'default' : 'outline'} 
            onClick={() => { setType('B'); setCategory(''); }}
            className="flex-1"
          >
            B 类 (知识点/导图)
          </Button>
          <Button 
            variant={category === 'dictionary' ? 'default' : 'outline'} 
            onClick={() => { setType('B'); setCategory('dictionary'); }}
            className="flex-1"
          >
            <Book className="h-4 w-4 mr-2" /> 字典
          </Button>
        </div>
        <Button onClick={handleCreate} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> 创建任务
        </Button>
      </Card>

      <div className="space-y-3">
        {tasks.map(task => (
          <Link key={task.id} to={`/tasks/${task.id}`} state={{ type: task.type, title: task.title }}>
            <Card className="hover:bg-zinc-50 transition-colors mb-3">
              <CardHeader className="p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{task.title}</CardTitle>
                <span className="text-xs px-2 py-1 bg-zinc-100 rounded-full font-medium">
                  {task.category === 'dictionary' ? '字典' : task.type === 'A' ? '试卷/错题' : '知识点/导图'}
                </span>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
