const API_BASE = '/api';

export const api = {
  getSubjects: async () => {
    const res = await fetch(`${API_BASE}/subjects`);
    return res.json();
  },
  getTasks: async (subjectId: string) => {
    const res = await fetch(`${API_BASE}/subjects/${subjectId}/tasks`);
    return res.json();
  },
  createTask: async (data: { subject_id: string, title: string, type: 'A' | 'B' }) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  getTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    return res.json();
  },
  getQuestions: async (taskId: string) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/questions`);
    return res.json();
  },
  createQuestion: async (data: any) => {
    const res = await fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteQuestion: async (id: string) => {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  getNodes: async (taskId: string) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/nodes`);
    return res.json();
  },
  createNode: async (data: any) => {
    const res = await fetch(`${API_BASE}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateNode: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteNode: async (id: string) => {
    const res = await fetch(`${API_BASE}/nodes/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  importNodes: async (taskId: string, parentId: string | null, tree: any[]) => {
    const res = await fetch(`${API_BASE}/nodes/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, parent_id: parentId, tree })
    });
    return res.json();
  },
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },
  search: async (q: string, subjectId?: string) => {
    const url = new URL(`${window.location.origin}${API_BASE}/search`);
    url.searchParams.append('q', q);
    if (subjectId) url.searchParams.append('subject_id', subjectId);
    const res = await fetch(url.toString());
    return res.json();
  }
};
