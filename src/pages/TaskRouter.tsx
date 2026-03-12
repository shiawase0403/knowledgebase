import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import TaskA from './TaskA';
import TaskB from './TaskB';
import DictionaryView from './DictionaryView';

export default function TaskRouter() {
  const { id } = useParams();
  const [task, setTask] = useState<any>(null);

  useEffect(() => {
    if (id) {
      api.getTask(id).then(t => {
        if (t) setTask(t);
      });
    }
  }, [id]);

  if (!task) return <div className="p-4 text-center">Loading task...</div>;

  if (task.category === 'dictionary') return <DictionaryView task={task} />;
  if (task.type === 'A') return <TaskA />;
  if (task.type === 'B') return <TaskB />;
  
  return <div className="p-4 text-center">Unknown task type</div>;
}
