import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Search } from 'lucide-react';

export default function Home() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    api.getSubjects().then(setSubjects);
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const delay = setTimeout(() => {
        api.search(query).then(setResults);
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setResults([]);
    }
  }, [query]);

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
        <Input 
          placeholder="Global Search..." 
          className="pl-9"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {query.trim() && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          {results.length === 0 ? (
            <p className="text-sm text-zinc-500">No results found.</p>
          ) : (
            results.map((r: any) => (
              <Link key={r.rowid} to={`/tasks/${r.task_id}`} className="block">
                <Card className="hover:bg-zinc-50">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm font-medium text-zinc-900">
                      [{r.entity_type.toUpperCase()}]
                    </CardTitle>
                    <p className="text-xs text-zinc-600 mt-1" dangerouslySetInnerHTML={{ __html: r.content_snippet }} />
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}

      {!query.trim() && (
        <div className="grid grid-cols-2 gap-4">
          {subjects.map(sub => (
            <Link key={sub.id} to={`/subjects/${sub.id}`}>
              <Card className="hover:bg-zinc-50 transition-colors">
                <CardHeader className="p-6 text-center">
                  <CardTitle>{sub.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
