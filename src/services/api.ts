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
  createTask: async (data: { subject_id: string, title: string, type: 'A' | 'B', category?: string }) => {
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
  deleteTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE'
    });
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
  updateQuestion: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: 'PUT',
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
  updateQuestionStats: async (id: string, isCorrect: boolean) => {
    const res = await fetch(`${API_BASE}/questions/${id}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCorrect })
    });
    return res.json();
  },
  toggleQuestionMark: async (id: string, isMarked: boolean) => {
    const res = await fetch(`${API_BASE}/questions/${id}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMarked })
    });
    return res.json();
  },
  importQuestions: async (taskId: string, questions: any[]) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/questions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions })
    });
    return res.json();
  },
  recognizePaper: async (formData: FormData, onProgress?: (text: string) => void, signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE}/ai/recognize-paper`, {
        method: 'POST',
        body: formData,
        signal
      });
      
      if (!res.body) throw new Error('No response body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
          const eventStr = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 2);
          
          const lines = eventStr.split('\n');
          let eventType = 'message';
          let dataStr = '';
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }
          
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'error') {
                return { error: data.error, details: data.details, raw: data.raw };
              } else if (eventType === 'chunk') {
                result += data.text;
                if (onProgress) onProgress(result);
              } else if (eventType === 'done') {
                return { data: data.data };
              }
            } catch (e) {
              console.error('Failed to parse SSE data', dataStr);
            }
          }
        }
      }
      
      return { error: 'Stream ended unexpectedly', raw: result };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      throw error;
    }
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
  deleteFile: async (url: string) => {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return res.json();
  },
  search: async (q: string, subjectId?: string) => {
    const url = new URL(`${window.location.origin}${API_BASE}/search`);
    url.searchParams.append('q', q);
    if (subjectId) url.searchParams.append('subject_id', subjectId);
    const res = await fetch(url.toString());
    return res.json();
  },
  
  // Dictionary APIs
  getDictionaryEntries: async (taskId: string) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/dictionary_entries`);
    return res.json();
  },
  createDictionaryEntry: async (taskId: string, data: any) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/dictionary_entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  bulkCreateDictionaryEntries: async (taskId: string, data: any[]) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/dictionary_entries/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateDictionaryEntry: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteDictionaryEntry: async (id: string) => {
    const res = await fetch(`${API_BASE}/entries/${id}`, { method: 'DELETE' });
    return res.json();
  },
  queryDictionaryEntry: async (id: string) => {
    const res = await fetch(`${API_BASE}/entries/${id}/query`, { method: 'POST' });
    return res.json();
  },
  updateEntryStars: async (id: string) => {
    const res = await fetch(`${API_BASE}/entries/${id}/stars`, { method: 'PUT' });
    return res.json();
  },
  updateEntryReview: async (id: string, review: string) => {
    const res = await fetch(`${API_BASE}/entries/${id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review })
    });
    return res.json();
  }
};
