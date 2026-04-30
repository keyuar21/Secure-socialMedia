import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';

import Navbar from '../components/Navbar';
import CreatePost from '../components/CreatePost';
import PostCard from '../components/PostCard';
import CommentSection from '../components/CommentSection';
import ProfileView from '../components/ProfileView';

const API = import.meta.env.VITE_API_URL || '/api';

const Feed = ({ setIsAuthenticated }) => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openComments, setOpenComments] = useState({});
  const [viewingProfile, setViewingProfile] = useState(null);
  const navigate = useNavigate();

  const myId = Number(localStorage.getItem('userId') || '0');
  const token = localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token}` });

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await axios.get(`${API}/posts/feed?page=${pageNum}&limit=20`, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      const newPosts = res.data.posts || [];
      if (append) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }
      setHasMore(newPosts.length === 20);
      setPage(pageNum);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      setError('Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { headers: headers() });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const handleCreatePost = async ({ content, visibility }) => {
    await axios.post(`${API}/posts`, { content, visibility }, { headers: headers() });
    setSuccess('Post created!');
    fetchFeed(1);
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${API}/posts/${postId}/like`, {}, { headers: headers() });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked_by_me: true, like_count: res.data.like_count } : p));
    } catch (e) { console.error(e); }
  };

  const handleUnlike = async (postId) => {
    try {
      const res = await axios.delete(`${API}/posts/${postId}/like`, { headers: headers() });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked_by_me: false, like_count: res.data.like_count } : p));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API}/posts/${postId}`, { headers: headers() });
      setPosts(prev => prev.filter(p => p.id !== postId));
      setSuccess('Post deleted');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete post');
    }
  };

  const toggleComments = (postId) => {
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  // Auto-clear notifications
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // If viewing a profile
  if (viewingProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar onLogout={handleLogout} onRefresh={() => fetchFeed(1)} loading={loading} token={token} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <ProfileView
            userId={viewingProfile}
            token={token}
            onBack={() => setViewingProfile(null)}
            onViewProfile={setViewingProfile}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLogout={handleLogout} onRefresh={() => fetchFeed(1)} loading={loading} token={token} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">Feed</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Share securely · Privacy enforced · All content stored encrypted
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-sm animate-slide-up">
            {success}
          </div>
        )}

        {/* Create Post */}
        <div className="mb-6">
          <CreatePost onPost={handleCreatePost} />
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-[var(--color-bg-elevated)]" />
                  <div>
                    <div className="h-3 w-24 bg-[var(--color-bg-elevated)] rounded mb-1.5" />
                    <div className="h-2 w-16 bg-[var(--color-bg-elevated)] rounded" />
                  </div>
                </div>
                <div className="h-4 w-full bg-[var(--color-bg-elevated)] rounded mb-2" />
                <div className="h-4 w-3/4 bg-[var(--color-bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="text-[var(--color-text-muted)]">No posts yet. Create your first post or add some friends!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <div key={p.id}>
                <PostCard
                  post={p}
                  currentUserId={myId}
                  onLike={handleLike}
                  onUnlike={handleUnlike}
                  onComment={toggleComments}
                  onDelete={handleDelete}
                  onViewProfile={setViewingProfile}
                />
                <CommentSection postId={p.id} isOpen={!!openComments[p.id]} token={token} />
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchFeed(page + 1, true)}
                  disabled={loadingMore}
                  className="btn-outline-custom text-sm flex items-center gap-2 mx-auto"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Loading…
                    </>
                  ) : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Feed;
