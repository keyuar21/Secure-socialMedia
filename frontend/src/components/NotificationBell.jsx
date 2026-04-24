import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Heart, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

const NOTIF_ICONS = {
  LIKE: Heart,
  COMMENT: MessageCircle,
  FRIEND_REQUEST: UserPlus,
  FRIEND_ACCEPTED: UserCheck,
};

const NotificationBell = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchCount = async () => {
    try {
      const res = await axios.get(`${API}/notifications/unread-count`, { headers });
      setUnreadCount(res.data.count);
    } catch (e) {
      console.error('notif count error', e);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notifications?limit=15`, { headers });
      setNotifications(res.data.notifications || []);
    } catch (e) {
      console.error('fetch notifs error', e);
    } finally {
      setLoading(false);
    }
  };

  // Poll for unread count every 30 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (newOpen) fetchNotifications();
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, { headers });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('mark all read error', e);
    }
  };

  const markRead = async (id) => {
    try {
      await axios.put(`${API}/notifications/${id}/read`, {}, { headers });
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('mark read error', e);
    }
  };

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.05)] transition-all"
        id="notification-bell"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--color-accent-rose)] text-white text-[10px] font-bold animate-slide-up">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[400px] glass-card overflow-hidden z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-[var(--color-accent-blue)] hover:text-[var(--color-accent-purple)] transition-colors flex items-center gap-1"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="text-center py-6">
                <span className="w-5 h-5 border-2 border-[var(--color-accent-blue)]/30 border-t-[var(--color-accent-blue)] rounded-full animate-spin inline-block" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const Icon = NOTIF_ICONS[n.type] || Bell;
                const fromName = n.from_display_name || n.from_email?.split('@')[0] || 'Someone';
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-[var(--color-border)] transition-all hover:bg-[rgba(255,255,255,0.03)] ${
                      !n.is_read ? 'bg-[rgba(59,130,246,0.04)]' : ''
                    }`}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center">
                      <Icon size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-primary)]">
                        <span className="font-semibold">{fromName}</span> {n.message}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="shrink-0 w-2 h-2 rounded-full bg-[var(--color-accent-blue)] mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
