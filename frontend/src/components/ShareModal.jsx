import React, { useState } from 'react';
import { Users, X, Send } from 'lucide-react';

const ShareModal = ({ file, users, onShare, onClose }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSharing(true);
    setError('');
    try {
      await onShare(file.id, selectedUser);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card p-6 sm:p-8 w-full max-w-md animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          id="share-modal-close"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold gradient-text mb-1">Share File</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Sharing: <strong className="text-[var(--color-text-primary)]">{file?.original_name}</strong>
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Select User
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
              <select
                className="select-field !pl-10"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
                id="share-user-select"
              >
                <option value="" disabled>Choose a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.email}>{u.email}</option>
                ))}
                {users.length === 0 && <option disabled>No other users found</option>}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline-custom flex-1 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sharing || !selectedUser}
              className="btn-gradient flex-1 text-sm flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareModal;
