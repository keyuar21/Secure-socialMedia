import React from 'react';
import { Heart, MessageCircle, Globe, Users, Lock, Trash2, Clock } from 'lucide-react';

const VISIBILITY_BADGE = {
  PUBLIC: { icon: Globe, label: 'Public', color: 'var(--color-accent-emerald)' },
  FRIENDS_ONLY: { icon: Users, label: 'Friends', color: 'var(--color-accent-blue)' },
  PRIVATE: { icon: Lock, label: 'Private', color: 'var(--color-accent-rose)' },
};

const formatTime = (ts) => {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
};

const PostCard = ({ post, currentUserId, onLike, onUnlike, onComment, onDelete, onViewProfile }) => {
  const vis = VISIBILITY_BADGE[post.visibility] || VISIBILITY_BADGE.PUBLIC;
  const VisIcon = vis.icon;
  const isMine = post.author_id === currentUserId;

  const authorName = post.author_display_name || post.author_email?.split('@')[0] || 'User';
  const initials = authorName.slice(0, 2).toUpperCase();

  return (
    <div className="glass-card p-5 sm:p-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <button
            onClick={() => onViewProfile && onViewProfile(post.author_id)}
            className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:scale-105 transition-transform"
          >
            {initials}
          </button>
          <div className="min-w-0">
            <button
              onClick={() => onViewProfile && onViewProfile(post.author_id)}
              className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent-blue)] transition-colors truncate block"
            >
              {authorName}
            </button>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              <Clock size={10} />
              <span>{formatTime(post.created_at)}</span>
              <span className="flex items-center gap-1" style={{ color: vis.color }}>
                <VisIcon size={10} />
                {vis.label}
              </span>
            </div>
          </div>
        </div>

        {isMine && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="shrink-0 p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.1)] transition-all"
            title="Delete post"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-relaxed">
          {post.content}
        </p>
      </div>

      {/* Post image placeholder if present */}
      {post.image_file_id && (
        <div className="mb-4 rounded-xl overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
          <Lock size={14} className="mr-2" />
          Encrypted Image Attached
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center gap-1 pt-3 border-t border-[var(--color-border)]">
        <button
          onClick={() => post.liked_by_me ? onUnlike(post.id) : onLike(post.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
            post.liked_by_me
              ? 'text-[var(--color-accent-rose)] bg-[rgba(244,63,94,0.1)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.05)]'
          }`}
          id={`like-btn-${post.id}`}
        >
          <Heart size={16} fill={post.liked_by_me ? 'currentColor' : 'none'} className={post.liked_by_me ? 'animate-like-pop' : ''} />
          <span>{parseInt(post.like_count) || 0}</span>
        </button>

        <button
          onClick={() => onComment(post.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent-blue)] hover:bg-[rgba(59,130,246,0.05)] transition-all duration-200"
          id={`comment-btn-${post.id}`}
        >
          <MessageCircle size={16} />
          <span>{parseInt(post.comment_count) || 0}</span>
        </button>
      </div>
    </div>
  );
};

export default PostCard;
