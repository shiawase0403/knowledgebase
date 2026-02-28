import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { api } from '../services/api';
import TaskA from './TaskA';
import TaskB from './TaskB';

export default function TaskRouter() {
  const { id } = useParams();
  const location = useLocation();
  const [type, setType] = useState<'A' | 'B' | null>(location.state?.type || null);

  useEffect(() => {
    if (!type && id) {
      api.getTask(id).then(task => {
        if (task) setType(task.type);
      });
    }
  }, [id, type]);

  if (type === 'A') return <TaskA />;
  if (type === 'B') return <TaskB />;
  
  return <div className="p-4 text-center">Loading task...</div>;
}
