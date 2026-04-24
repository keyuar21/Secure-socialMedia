import React, { useState } from 'react';
import { Send, Globe, Users, Lock, Image as ImageIcon } from 'lucide-react';

const VISIBILITIES = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, color: 'var(--color-accent-emerald)' },
  { value: 'FRIENDS_ONLY', label: 'Friends', icon: Users, color: 'var(--color-accent-blue)' },
  { value: 'PRIVATE', label: 'Only Me', icon: Lock, color: 'var(--color-accent-rose)' },
];

const CreatePost = ({ onPost }) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('FRIENDS_ONLY');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setError('');
    try {
      await onPost({ content: content.trim(), visibility });
      setContent('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const currentVis = VISIBILITIES.find(v => v.value === visibility) || VISIBILITIES[1];
  const CurrentIcon = currentVis.icon;

  return (
    <div className="glass-card p-5 sm:p-6 animate-fade-in">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">Create Post</h3>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          className="input-field resize-none min-h-[100px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind? Share securely…"
          maxLength={5000}
          id="create-post-content"
        />

        <div className="flex items-center justify-between mt-3 gap-3">
          {/* Visibility selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                className="select-field !py-2 !text-xs !w-auto !min-w-[130px]"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                id="create-post-visibility"
              >
                {VISIBILITIES.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 text-[11px]" style={{ color: currentVis.color }}>
              <CurrentIcon size={12} />
            </div>
          </div>

          {/* Post button */}
          <button
            type="submit"
            disabled={posting || !content.trim()}
            className="btn-gradient !px-5 !py-2 text-sm flex items-center gap-2"
            id="create-post-submit"
          >
            {posting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting…
              </span>
            ) : (
              <>
                <Send size={14} />
                Post
              </>
            )}
          </button>
        </div>

        <div className="mt-2 text-right text-[10px] text-[var(--color-text-muted)]">
          {content.length}/5000
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
