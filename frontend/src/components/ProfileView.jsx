import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, UserCheck, Ban, Calendar, Users, MapPin, Mail, Shield } from 'lucide-react';
import axios from 'axios';
import PostCard from './PostCard';
import CommentSection from './CommentSection';

const API = import.meta.env.VITE_API_URL || '/api';

const ProfileView = ({ userId, token, onBack, onViewProfile }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openComments, setOpenComments] = useState({});
  const myId = Number(localStorage.getItem('userId') || '0');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/profiles/${userId}`, { headers });
      setProfile(res.data);
    } catch (e) {
      if (e.response?.status === 403) {
        setError('This profile is private');
      } else if (e.response?.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [userId]);

  const sendFriendRequest = async () => {
    try {
      setError(''); setSuccess('');
      const res = await axios.post(`${API}/friends/request`, { user_id: userId }, { headers });
      setSuccess(res.data.message);
      fetchProfile();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send request');
    }
  };

  const acceptFriendRequest = async () => {
    try {
      setError(''); setSuccess('');
      await axios.post(`${API}/friends/accept`, { user_id: userId }, { headers });
      setSuccess('Friend request accepted!');
      fetchProfile();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed');
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(`${API}/posts/${postId}/like`, {}, { headers });
      fetchProfile();
    } catch (e) { console.error(e); }
  };

  const handleUnlike = async (postId) => {
    try {
      await axios.delete(`${API}/posts/${postId}/like`, { headers });
      fetchProfile();
    } catch (e) { console.error(e); }
  };

  // Auto-clear
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  if (loading) {
    return (
      <div className="glass-card p-8 text-center animate-pulse">
        <div className="w-20 h-20 rounded-full bg-[var(--color-bg-elevated)] mx-auto mb-4" />
        <div className="h-5 w-32 bg-[var(--color-bg-elevated)] rounded mx-auto mb-2" />
        <div className="h-3 w-48 bg-[var(--color-bg-elevated)] rounded mx-auto" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="glass-card p-8 text-center">
        <Shield size={40} className="mx-auto mb-3 text-[var(--color-accent-rose)]" />
        <p className="text-[var(--color-accent-rose)]">{error}</p>
        <button onClick={onBack} className="btn-outline-custom mt-4 text-sm flex items-center gap-2 mx-auto">
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const isSelf = profile.friend_status === 'SELF';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-2">
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Notifications */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-xs animate-slide-up">{error}</div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-xs animate-slide-up">{success}</div>
      )}

      {/* Profile header */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center text-white font-bold text-2xl shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            {initials}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold gradient-text">{displayName}</h2>

            {profile.bio && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{profile.bio}</p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
              {profile.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={12} className="text-[var(--color-accent-cyan)]" />
                  {profile.email}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={12} />
                Joined {new Date(profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-[var(--color-accent-blue)]" />
                {profile.friend_count} friends
              </span>
            </div>

            {/* Friend action buttons */}
            {!isSelf && (
              <div className="mt-4">
                {profile.friend_status === 'NONE' && (
                  <button onClick={sendFriendRequest} className="btn-gradient !px-4 !py-2 text-xs flex items-center gap-2">
                    <UserPlus size={14} /> Add Friend
                  </button>
                )}
                {profile.friend_status === 'PENDING' && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                    <UserPlus size={14} /> Request Sent
                  </span>
                )}
                {profile.friend_status === 'PENDING_INCOMING' && (
                  <button onClick={acceptFriendRequest} className="btn-gradient !px-4 !py-2 text-xs flex items-center gap-2">
                    <UserCheck size={14} /> Accept Request
                  </button>
                )}
                {profile.friend_status === 'ACCEPTED' && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-xs text-[var(--color-accent-emerald)]">
                    <UserCheck size={14} /> Friends
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Posts */}
      {profile.posts && profile.posts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Posts</h3>
          {profile.posts.map(p => (
            <div key={p.id}>
              <PostCard
                post={{ ...p, author_email: profile.email, author_display_name: displayName, author_id: userId }}
                currentUserId={myId}
                onLike={handleLike}
                onUnlike={handleUnlike}
                onComment={(id) => setOpenComments(prev => ({ ...prev, [id]: !prev[id] }))}
                onViewProfile={onViewProfile}
              />
              <CommentSection postId={p.id} isOpen={!!openComments[p.id]} token={token} />
            </div>
          ))}
        </div>
      )}

      {profile.posts && profile.posts.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-[var(--color-text-muted)]">
          No visible posts
        </div>
      )}
    </div>
  );
};

export default ProfileView;
