import React from 'react';
import { Eye, Users as FriendsIcon, EyeOff, Lock } from 'lucide-react';

const FIELDS = [
  { key: 'profile_visibility', label: 'Profile Visibility', desc: 'Who can see your profile page', icon: Eye },
  { key: 'post_visibility', label: 'Post Visibility', desc: 'Who can see your posts', icon: FriendsIcon },
  { key: 'contact_visibility', label: 'Contact Info', desc: 'Who can see your email & contact', icon: EyeOff },
];

const LEVELS = [
  { value: 'PUBLIC', label: 'Public', color: 'var(--color-accent-emerald)', desc: 'Anyone can view' },
  { value: 'FRIENDS_ONLY', label: 'Friends Only', color: 'var(--color-accent-blue)', desc: 'Only friends' },
  { value: 'PRIVATE', label: 'Private', color: 'var(--color-accent-rose)', desc: 'Only you' },
];

const PrivacySettings = ({ privacy, onUpdate }) => {
  if (!privacy) {
    return (
      <div className="glass-card p-8 text-center animate-pulse">
        <Lock size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
        <p className="text-[var(--color-text-muted)]">Loading privacy settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <Lock size={22} className="text-[var(--color-accent-purple)]" />
          <h3 className="text-lg font-bold gradient-text">Privacy Controls</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Configure who can see your information. Settings are enforced server-side.
        </p>

        <div className="space-y-5">
          {FIELDS.map(({ key, label, desc, icon: Icon }) => {
            const currentLevel = LEVELS.find(l => l.value === privacy[key]) || LEVELS[0];
            return (
              <div
                key={key}
                className="p-4 rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] transition-all duration-300 hover:border-[var(--color-border-hover)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${currentLevel.color}15` }}>
                      <Icon size={18} style={{ color: currentLevel.color }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{label}</h4>
                      <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                    </div>
                  </div>
                  <select
                    className="select-field !w-auto min-w-[140px]"
                    value={privacy[key]}
                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                    id={`privacy-${key}`}
                  >
                    {LEVELS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;
