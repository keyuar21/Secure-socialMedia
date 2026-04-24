import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';

const FileUpload = ({ onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      await onUpload(file);
      setUploadResult({ success: true, name: file.name });
    } catch (err) {
      setUploadResult({ success: false, error: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    processFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
    e.target.value = '';
  };

  return (
    <div className="animate-fade-in">
      <div
        className={`
          relative overflow-hidden rounded-xl border-2 border-dashed p-8 sm:p-12
          text-center cursor-pointer transition-all duration-300
          ${dragActive
            ? 'border-[var(--color-accent-blue)] bg-[rgba(59,130,246,0.08)]'
            : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-[var(--color-border-hover)] hover:bg-[rgba(255,255,255,0.02)]'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {/* Animated background gradient on drag */}
        {dragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(59,130,246,0.05)] to-[rgba(139,92,246,0.05)] animate-pulse-glow" />
        )}

        <div className="relative z-10">
          <UploadCloud
            size={48}
            className={`mx-auto mb-4 transition-all duration-500 ${
              dragActive
                ? 'text-[var(--color-accent-blue)] -translate-y-2 scale-110'
                : uploading
                  ? 'text-[var(--color-accent-purple)] animate-pulse'
                  : 'text-[var(--color-text-muted)]'
            }`}
          />
          <h3 className="text-lg font-semibold mb-2">
            {uploading ? 'Encrypting & Uploading…' : dragActive ? 'Drop to encrypt & upload' : 'Drop files or click to upload'}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Max 50 MB · SHA-256 hashed · ClamAV scanned · AES-256-GCM encrypted at rest
          </p>

          {uploading && (
            <div className="mt-6 w-48 mx-auto">
              <div className="h-1 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] rounded-full animate-shimmer" style={{ width: '70%', backgroundSize: '200% 100%' }} />
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
          id="file-upload-input"
        />
      </div>

      {/* Upload result toast */}
      {uploadResult && (
        <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-lg border animate-slide-up ${
          uploadResult.success
            ? 'bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)]'
            : 'bg-[rgba(244,63,94,0.08)] border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)]'
        }`}>
          {uploadResult.success
            ? <><CheckCircle size={18} /><span className="text-sm">Securely uploaded: <strong>{uploadResult.name}</strong></span></>
            : <><AlertTriangle size={18} /><span className="text-sm">{uploadResult.error}</span></>
          }
        </div>
      )}
    </div>
  );
};

export default FileUpload;
