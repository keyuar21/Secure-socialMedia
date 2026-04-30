import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Camera, Mail, Calendar, Edit3 } from 'lucide-react';
import Navbar from '../components/Navbar';
import ProfileView from '../components/ProfileView';

const API = import.meta.env.VITE_API_URL || '/api';

const Profile = ({ setIsAuthenticated }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const myId = Number(localStorage.getItem('userId') || '0');
  const headers = { Authorization: `Bearer ${token}` };

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwnProfile = !userId || Number(userId) === myId;

  const handleLogout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { headers }); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/profiles/me`, { headers });
      setProfile(res.data);
      setDisplayName(res.data.display_name || '');
      setBio(res.data.bio || '');
    } catch (e) {
      if (e.response?.status === 401) handleLogout();
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwnProfile) fetchProfile();
  }, [isOwnProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await axios.put(`${API}/profiles/me`, { display_name: displayName, bio }, { headers });
      setProfile(prev => ({ ...prev, ...res.data }));
      setEditing(false);
      setSuccess('Profile updated!');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      setError('');
      await axios.post(`${API}/profiles/me/avatar`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Avatar updated!');
      fetchProfile();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to upload avatar');
    }
  };

  // Auto-clear
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // If viewing another user's profile, delegate to ProfileView
  if (!isOwnProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar onLogout={handleLogout} token={token} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <ProfileView
            userId={Number(userId)}
            token={token}
            onBack={() => navigate(-1)}
            onViewProfile={(id) => navigate(`/profile/${id}`)}
          />
        </main>
      </div>
    );
  }

  const initials = (displayName || profile?.email?.split('@')[0] || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLogout={handleLogout} token={token} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">My Profile</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Manage your identity on SecureVault</p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">{error}</div>
        )}
        {success && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-sm animate-slide-up">{success}</div>
        )}

        {loading ? (
          <div className="glass-card p-8 text-center animate-pulse">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-elevated)] mx-auto mb-4" />
            <div className="h-5 w-32 bg-[var(--color-bg-elevated)] rounded mx-auto" />
          </div>
        ) : profile && (
          <div className="glass-card p-6 sm:p-8">
            <div className="flex flex-col items-center mb-6">
              {/* Avatar with upload */}
              <div className="relative group mb-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center text-white font-bold text-3xl shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                  {initials}
                </div>
                <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>

              {/* Info */}
              {!editing ? (
                <>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{displayName || 'Set your name'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm text-center">{bio || 'No bio yet'}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} className="text-[var(--color-accent-cyan)]" />
                      {profile.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      Joined {new Date(profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-outline-custom !px-4 !py-2 text-xs flex items-center gap-2 mt-4"
                  >
                    <Edit3 size={14} /> Edit Profile
                  </button>
                </>
              ) : (
                <form onSubmit={handleSave} className="w-full max-w-sm space-y-4 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
                    <input
                      className="input-field"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={100}
                      placeholder="Your name"
                      id="profile-display-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Bio</label>
                    <textarea
                      className="input-field resize-none min-h-[80px]"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      placeholder="Tell people about yourself…"
                      id="profile-bio"
                    />
                    <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-1">{bio.length}/500</div>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditing(false)} className="btn-outline-custom flex-1 text-xs">Cancel</button>
                    <button type="submit" disabled={saving} className="btn-gradient flex-1 text-xs flex items-center justify-center gap-2">
                      <Save size={14} />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
