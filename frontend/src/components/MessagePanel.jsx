import React, { useState } from 'react';
import { MessageCircle, Send, Lock, User } from 'lucide-react';

const MessagePanel = ({ users, messages, chatWith, setChatWith, chatText, setChatText, onSend, onLoadMessages }) => {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (sending || !chatWith || !chatText.trim()) return;
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[rgba(139,92,246,0.15)] flex items-center justify-center">
            <Lock size={18} className="text-[var(--color-accent-purple)]" />
          </div>
          <div>
            <h3 className="text-lg font-bold gradient-text">End-to-End Encrypted Messages</h3>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Messages are encrypted in your browser before upload. The server stores only ciphertext.
        </p>

        {/* User selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Chat with</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
            <select
              className="select-field !pl-10"
              value={chatWith}
              onChange={async (e) => {
                const v = e.target.value;
                setChatWith(v);
                if (v) await onLoadMessages(Number(v));
              }}
              id="chat-user-select"
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Message input */}
        <div className="flex gap-3 mb-6">
          <input
            className="input-field flex-1"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={!chatWith}
            id="chat-message-input"
          />
          <button
            onClick={handleSend}
            disabled={!chatWith || !chatText.trim() || sending}
            className="btn-gradient !px-4 flex items-center gap-2 shrink-0"
            id="chat-send-btn"
          >
            <Send size={16} />
            <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
          </button>
        </div>

        {/* Messages list */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {!chatWith ? (
            <div className="text-center py-10">
              <MessageCircle size={36} className="mx-auto mb-3 text-[var(--color-text-muted)] animate-float" />
              <p className="text-sm text-[var(--color-text-muted)]">Select a user to start chatting</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <Lock size={28} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">No messages yet. Send one to start the conversation.</p>
            </div>
          ) : (
            messages.map((m) => {
              const myId = Number(localStorage.getItem('userId') || '0');
              const isMine = m.sender_id === myId;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    isMine
                      ? 'bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-white rounded-br-md'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-md'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{m.plaintext}</div>
                    <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${isMine ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>
                      <Lock size={8} />
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagePanel;
