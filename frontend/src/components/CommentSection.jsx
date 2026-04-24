import React, { useState, useEffect } from 'react';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const CommentSection = ({ postId, isOpen, token }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const myId = Number(localStorage.getItem('userId') || '0');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/posts/${postId}/comments`, { headers });
      setComments(res.data);
    } catch (e) {
      console.error('fetch comments error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchComments();
  }, [isOpen, postId]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await axios.post(`${API}/posts/${postId}/comments`, { content: newComment.trim() }, { headers });
      setNewComment('');
      fetchComments();
    } catch (e) {
      console.error('post comment error', e);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await axios.delete(`${API}/posts/comments/${commentId}`, { headers });
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error('delete comment error', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)] animate-slide-up">
      {/* Comment input */}
      <form onSubmit={handlePost} className="flex gap-2 mb-3">
        <input
          className="input-field flex-1 !py-2 !text-sm"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment…"
          maxLength={2000}
          id={`comment-input-${postId}`}
        />
        <button
          type="submit"
          disabled={posting || !newComment.trim()}
          className="btn-gradient !px-3 !py-2 shrink-0"
          id={`comment-submit-${postId}`}
        >
          <Send size={14} />
        </button>
      </form>

      {/* Comments list */}
      {loading ? (
        <div className="text-center py-3">
          <span className="w-4 h-4 border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)] rounded-full animate-spin inline-block" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-4 text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-2">
          <MessageCircle size={14} />
          No comments yet. Be the first!
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {comments.map((c) => {
            const name = c.author_display_name || c.author_email?.split('@')[0] || 'User';
            const isMine = c.author_id === myId;
            return (
              <div key={c.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-accent-cyan)] to-[var(--color-accent-blue)] flex items-center justify-center text-white text-[10px] font-bold">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">{name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                {isMine && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="shrink-0 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
