import React from 'react';
import { ScrollText, AlertTriangle, CheckCircle, Clock, Globe, Shield, Download, Heart, MessageCircle, UserPlus, UserCheck, Upload, Share2, FileText } from 'lucide-react';

const EVENT_STYLES = {
  LOGIN_SUCCESS: { color: 'var(--color-accent-emerald)', icon: CheckCircle },
  LOGIN_FAILED: { color: 'var(--color-accent-rose)', icon: AlertTriangle },
  LOGIN_BLOCKED_LOCKOUT: { color: 'var(--color-accent-rose)', icon: AlertTriangle },
  LOGIN_OTP_SENT: { color: 'var(--color-accent-blue)', icon: Shield },
  LOGIN_PASSWORD_OK_TOTP_REQUIRED: { color: 'var(--color-accent-purple)', icon: Shield },
  PASSWORD_CHANGED: { color: 'var(--color-accent-amber)', icon: Shield },
  PASSWORD_RESET_REQUESTED: { color: 'var(--color-accent-amber)', icon: Clock },
  TOTP_ENABLED: { color: 'var(--color-accent-purple)', icon: Shield },
  TOTP_FAILED: { color: 'var(--color-accent-rose)', icon: AlertTriangle },
  EMAIL_VERIFIED: { color: 'var(--color-accent-emerald)', icon: CheckCircle },
  REGISTRATION_OTP_RESENT: { color: 'var(--color-accent-blue)', icon: Clock },
  LOGOUT: { color: 'var(--color-text-muted)', icon: Clock },
  MESSAGE_SENT: { color: 'var(--color-accent-blue)', icon: MessageCircle },
  E2EE_PUBLIC_KEY_UPDATED: { color: 'var(--color-accent-cyan)', icon: Shield },
  PRIVACY_SETTINGS_UPDATED: { color: 'var(--color-accent-purple)', icon: Shield },
  PROFILE_UPDATED: { color: 'var(--color-accent-blue)', icon: Shield },
  AVATAR_UPLOADED: { color: 'var(--color-accent-blue)', icon: Upload },
  FILE_UPLOADED: { color: 'var(--color-accent-emerald)', icon: Upload },
  FILE_SHARED: { color: 'var(--color-accent-cyan)', icon: Share2 },
  POST_CREATED: { color: 'var(--color-accent-emerald)', icon: FileText },
  POST_DELETED: { color: 'var(--color-accent-rose)', icon: FileText },
  COMMENT_ADDED: { color: 'var(--color-accent-blue)', icon: MessageCircle },
  FRIEND_REQUEST_SENT: { color: 'var(--color-accent-blue)', icon: UserPlus },
  FRIEND_REQUEST_ACCEPTED: { color: 'var(--color-accent-emerald)', icon: UserCheck },
  FRIEND_ACCEPTED: { color: 'var(--color-accent-emerald)', icon: UserCheck },
  USER_BLOCKED: { color: 'var(--color-accent-rose)', icon: AlertTriangle },
};

const SecurityLogs = ({ logs, alerts, onDownloadCSV }) => {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Alerts Section */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[rgba(244,63,94,0.15)] flex items-center justify-center">
            <AlertTriangle size={18} className="text-[var(--color-accent-rose)]" />
          </div>
          <h3 className="text-lg font-bold gradient-text">Security Alerts</h3>
        </div>

        {alerts?.alerts?.length > 0 ? (
          <div className="space-y-3">
            {alerts.alerts.map((a, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 rounded-xl bg-[rgba(244,63,94,0.06)] border border-[rgba(244,63,94,0.15)]"
              >
                <AlertTriangle size={18} className="text-[var(--color-accent-rose)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[var(--color-accent-rose)]">{a.type}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{a.detail}</div>
                </div>
                <span className="ml-auto shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(244,63,94,0.15)] text-[var(--color-accent-rose)]">
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.15)]">
            <CheckCircle size={18} className="text-[var(--color-accent-emerald)] shrink-0" />
            <span className="text-sm text-[var(--color-accent-emerald)]">No high-severity alerts detected.</span>
          </div>
        )}

        {alerts?.known_ips_last_7_days?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
              <Globe size={12} />
              <span>Known IPs (last 7 days)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.known_ips_last_7_days.map((ip, i) => (
                <span key={i} className="text-xs font-mono px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logs Timeline */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
              <ScrollText size={18} className="text-[var(--color-accent-blue)]" />
            </div>
            <h3 className="text-lg font-bold gradient-text">Event Timeline</h3>
          </div>
          {onDownloadCSV && (
            <button
              onClick={onDownloadCSV}
              className="btn-outline-custom !px-3 !py-1.5 text-xs flex items-center gap-2 hover:!border-[var(--color-accent-blue)] hover:!text-[var(--color-accent-blue)]"
              title="Download Logs as CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No security events recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((l) => {
              const style = EVENT_STYLES[l.event_type] || { color: 'var(--color-text-muted)', icon: Clock };
              const Icon = style.icon;
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-200"
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${style.color}15` }}
                  >
                    <Icon size={14} style={{ color: style.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{l.event_type}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2 mt-0.5">
                      <span>{l.ip_address || 'unknown ip'}</span>
                      <span>·</span>
                      <span>{new Date(l.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-[11px] text-[var(--color-text-muted)] max-w-[200px] truncate shrink-0">
                    {l.user_agent || ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityLogs;
