import React from 'react';
import { File, Download, Share2, Shield, Hash, Lock } from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileCard = ({ file, onDownload, onShare, showSender }) => (
  <div className="glass-card-hover p-4 sm:p-5 animate-slide-up">
    <div className="flex items-start justify-between gap-4">
      {/* File info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-[rgba(59,130,246,0.15)] to-[rgba(139,92,246,0.1)] flex items-center justify-center">
          <File size={20} className="text-[var(--color-accent-blue)]" />
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm truncate">{file.original_name}</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {formatBytes(file.size)} · {new Date(file.created_at).toLocaleDateString()}
            {showSender && file.sender_email && <> · From: <span className="text-[var(--color-accent-cyan)]">{file.sender_email}</span></>}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onShare && (
          <button
            onClick={() => onShare(file)}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-blue)] hover:bg-[rgba(59,130,246,0.1)] transition-all duration-200"
            title="Share File"
            id={`share-btn-${file.id}`}
          >
            <Share2 size={16} />
          </button>
        )}
        <button
          onClick={() => onDownload(file.id, file.original_name)}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-emerald)] hover:bg-[rgba(16,185,129,0.1)] transition-all duration-200"
          title="Decrypt & Download"
          id={`download-btn-${file.id}`}
        >
          <Download size={16} />
        </button>
      </div>
    </div>

    {/* Security metadata */}
    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Shield size={12} className="text-[var(--color-accent-emerald)] shrink-0" />
          <span>ClamAV: <span className="text-[var(--color-accent-emerald)]">Clean</span></span>
        </div>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Lock size={12} className="text-[var(--color-accent-purple)] shrink-0" />
          <span>AES-256-GCM Encrypted</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] sm:col-span-2">
          <Hash size={12} className="text-[var(--color-accent-cyan)] shrink-0" />
          <span className="font-mono truncate">{file.file_hash || 'Legacy (unhashed)'}</span>
        </div>
      </div>
    </div>
  </div>
);

const FileList = ({ files, title, emptyMsg, onDownload, onShare, showSender = false, loading }) => {
  if (loading) {
    return (
      <div className="glass-card p-8 text-center animate-pulse">
        <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] mx-auto mb-4" />
        <div className="h-4 w-40 bg-[var(--color-bg-elevated)] rounded mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {files.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <File size={40} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
          <p className="text-[var(--color-text-muted)]">{emptyMsg}</p>
        </div>
      ) : (
        files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onDownload={onDownload}
            onShare={onShare}
            showSender={showSender}
          />
        ))
      )}
    </div>
  );
};

export default FileList;
