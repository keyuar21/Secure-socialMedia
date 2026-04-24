import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserCheck, UserX, Ban, Check, X, Search } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

const FriendsList = ({ token, onViewProfile }) => {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('friends'); // 'friends' | 'requests' | 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        axios.get(`${API}/friends`, { headers }),
        axios.get(`${API}/friends/requests`, { headers }),
      ]);
      setFriends(f.data);
      setRequests(r.data);
    } catch (e) {
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await axios.get(`${API}/profiles/search?q=${encodeURIComponent(q)}`, { headers });
      setSearchResults(res.data);
    } catch (e) {
      console.error('search error', e);
    }
  };

  const sendRequest = async (userId) => {
    try {
      setError(''); setSuccess('');
      const res = await axios.post(`${API}/friends/request`, { user_id: userId }, { headers });
      setSuccess(res.data.message);
      fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send request');
    }
  };

  const acceptRequest = async (userId) => {
    try {
      setError(''); setSuccess('');
      await axios.post(`${API}/friends/accept`, { user_id: userId }, { headers });
      setSuccess('Friend request accepted!');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to accept request');
    }
  };

  const rejectRequest = async (userId) => {
    try {
      await axios.post(`${API}/friends/reject`, { user_id: userId }, { headers });
      fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to reject request');
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await axios.delete(`${API}/friends/${friendId}`, { headers });
      setSuccess('Friend removed');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove friend');
    }
  };

  const blockUser = async (userId) => {
    try {
      await axios.post(`${API}/friends/block`, { user_id: userId }, { headers });
      setSuccess('User blocked');
      fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to block user');
    }
  };

  // Auto-clear notifications
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const TABS = [
    { id: 'friends', label: 'Friends', icon: Users, count: friends.length },
    { id: 'requests', label: 'Requests', icon: UserPlus, count: requests.length },
    { id: 'search', label: 'Find People', icon: Search },
  ];

  const UserCard = ({ user, actions }) => {
    const name = user.display_name || user.email?.split('@')[0] || 'User';
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onViewProfile && onViewProfile(user.id)}
            className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center text-white font-bold text-xs hover:scale-105 transition-transform"
          >
            {initials}
          </button>
          <div className="min-w-0">
            <button
              onClick={() => onViewProfile && onViewProfile(user.id)}
              className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent-blue)] transition-colors truncate block"
            >
              {name}
            </button>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {actions}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
            <Users size={18} className="text-[var(--color-accent-blue)]" />
          </div>
          <h3 className="text-lg font-bold gradient-text">Friends</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Manage your connections. Friends can see your FRIENDS_ONLY posts and profile.
        </p>

        {/* Notifications */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-xs animate-slide-up">{error}</div>
        )}
        {success && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-xs animate-slide-up">{success}</div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                tab === id
                  ? 'bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)]'
                  : 'bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Icon size={14} />
              {label}
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab === id ? 'bg-white/20 text-white' : 'bg-[var(--color-accent-blue)] text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'friends' && (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <span className="w-6 h-6 border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)] rounded-full animate-spin inline-block" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8">
                <Users size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">No friends yet. Use "Find People" to connect!</p>
              </div>
            ) : (
              friends.map(f => (
                <UserCard key={f.id} user={f} actions={
                  <>
                    <button onClick={() => removeFriend(f.id)} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.1)] transition-all" title="Remove Friend">
                      <UserX size={14} />
                    </button>
                    <button onClick={() => blockUser(f.id)} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.1)] transition-all" title="Block User">
                      <Ban size={14} />
                    </button>
                  </>
                } />
              ))
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">No pending friend requests</p>
              </div>
            ) : (
              requests.map(r => (
                <UserCard key={r.id} user={r} actions={
                  <>
                    <button onClick={() => acceptRequest(r.id)} className="p-2 rounded-lg text-[var(--color-accent-emerald)] hover:bg-[rgba(16,185,129,0.1)] transition-all" title="Accept">
                      <Check size={16} />
                    </button>
                    <button onClick={() => rejectRequest(r.id)} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.1)] transition-all" title="Reject">
                      <X size={16} />
                    </button>
                  </>
                } />
              ))
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
              <input
                className="input-field !pl-10"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email…"
                id="friend-search-input"
              />
            </div>
            <div className="space-y-2">
              {searchResults.length === 0 && searchQuery.length >= 2 && (
                <p className="text-center py-4 text-sm text-[var(--color-text-muted)]">No users found</p>
              )}
              {searchResults.map(u => (
                <UserCard key={u.id} user={u} actions={
                  <button onClick={() => sendRequest(u.id)} className="p-2 rounded-lg text-[var(--color-accent-blue)] hover:bg-[rgba(59,130,246,0.1)] transition-all" title="Send Friend Request">
                    <UserPlus size={16} />
                  </button>
                } />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsList;
