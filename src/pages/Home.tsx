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
            results.map((r: any) => {
              let firstImageUrl = r.image_url;
              if (firstImageUrl && firstImageUrl.startsWith('[')) {
                try {
                  const parsed = JSON.parse(firstImageUrl);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    firstImageUrl = parsed[0];
                  }
                } catch (e) {
                  // ignore
                }
              }
              
              const thumbUrl = firstImageUrl ? firstImageUrl.replace(/(\.[^.]+)$/, '-thumb$1') : null;
              
              return (
                <Link key={r.rowid} to={`/tasks/${r.task_id}`} className="block">
                  <Card className="hover:bg-zinc-50 transition-colors">
                    <div className="flex items-start p-4 gap-4">
                      {thumbUrl && (
                        <div className="shrink-0 w-16 h-16 bg-zinc-100 rounded overflow-hidden border border-zinc-200">
                          <img 
                            src={thumbUrl} 
                            alt="Thumbnail" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to original image if thumbnail doesn't exist (for old uploads)
                              if (e.currentTarget.src !== firstImageUrl) {
                                e.currentTarget.src = firstImageUrl;
                              }
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded">
                            {r.entity_type.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {r.task_title || 'Unknown Task'}
                          </span>
                        </div>
                        {r.content_snippet && (
                          <p className="text-xs text-zinc-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: r.content_snippet }} />
                        )}
                        {r.ocr_snippet && (
                          <p className="text-xs text-zinc-500 line-clamp-2 mt-1 italic" dangerouslySetInnerHTML={{ __html: r.ocr_snippet }} />
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
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
