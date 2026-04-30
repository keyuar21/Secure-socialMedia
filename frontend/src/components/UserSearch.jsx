import React, { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

const UserSearch = ({ token, onViewProfile, onSendRequest }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debounce, setDebounce] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const doSearch = async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/profiles/search?q=${encodeURIComponent(q)}`, { headers });
      setResults(res.data);
    } catch (e) {
      console.error('search error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (debounce) clearTimeout(debounce);
    setDebounce(setTimeout(() => doSearch(v), 300));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
        <input
          className="input-field !pl-10"
          value={query}
          onChange={handleChange}
          placeholder="Search users by name or email…"
          id="user-search-input"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)] rounded-full animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(u => {
            const name = u.display_name || u.email?.split('@')[0] || 'User';
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => onViewProfile(u.id)}
                    className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center text-white font-bold text-xs hover:scale-105 transition-transform"
                  >
                    {initials}
                  </button>
                  <div className="min-w-0">
                    <button
                      onClick={() => onViewProfile(u.id)}
                      className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent-blue)] transition-colors truncate block"
                    >
                      {name}
                    </button>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onSendRequest && (
                    <button
                      onClick={() => onSendRequest(u.id)}
                      className="p-2 rounded-lg text-[var(--color-accent-blue)] hover:bg-[rgba(59,130,246,0.1)] transition-all"
                      title="Send Friend Request"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !loading && (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-4">No users found</p>
      )}
    </div>
  );
};

export default UserSearch;
