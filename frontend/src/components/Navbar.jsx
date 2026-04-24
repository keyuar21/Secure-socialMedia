import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, RefreshCw, Newspaper, FolderOpen, User } from 'lucide-react';
import NotificationBell from './NotificationBell';

const NAV_LINKS = [
  { path: '/feed', label: 'Feed', icon: Newspaper },
  { path: '/dashboard', label: 'Vault', icon: FolderOpen },
  { path: '/profile', label: 'Profile', icon: User },
];

const Navbar = ({ onLogout, onRefresh, loading, token }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredLink, setHoveredLink] = useState(null);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(10,10,10,0.94)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <button
            onClick={() => navigate('/feed')}
            className="flex items-center gap-2.5 group relative"
          >
            <div className="w-9 h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] flex items-center justify-center shadow-[var(--shadow-card)]">
              <ShieldCheck className="text-[var(--color-accent-amber)]" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block gradient-text">
              SecureVault
            </span>
          </button>

          <div className="flex items-center gap-1">
            {NAV_LINKS.map(({ path, label, icon: IconComponent }) => {
              const isActive = location.pathname === path || (path === '/feed' && location.pathname === '/');
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  onMouseEnter={() => setHoveredLink(label)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[rgba(212,183,139,0.16)] border border-[var(--color-border-hover)] text-[var(--color-text-primary)]'
                      : 'bg-transparent border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)] hover:bg-[rgba(212,183,139,0.08)]'
                  }`}
                  id={`nav-${label.toLowerCase()}`}
                >
                  <div className="relative flex items-center gap-2">
                    <IconComponent size={15} className={`${hoveredLink === label ? 'scale-105' : ''}`} />
                    <span className="hidden md:inline">{label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            {token && <NotificationBell token={token} />}

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 rounded-lg border border-transparent hover:border-[var(--color-border)] hover:bg-[rgba(212,183,139,0.08)] transition-all duration-200 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={16} className={`${loading ? 'animate-spin text-[var(--color-accent-amber)]' : 'text-[var(--color-text-muted)]'} transition-all`} />
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 rounded-lg border border-transparent hover:border-[var(--color-border)] hover:bg-[rgba(179,122,86,0.1)] transition-all duration-200"
              title="Logout"
              id="nav-logout"
            >
              <LogOut size={16} className="text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] transition-all" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
