import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, RefreshCw, Newspaper, FolderOpen, Users, User, MessageCircle } from 'lucide-react';
import NotificationBell from './NotificationBell';

const NAV_LINKS = [
  { path: '/feed', label: 'Feed', icon: Newspaper },
  { path: '/dashboard', label: 'Vault', icon: FolderOpen },
  { path: '/profile', label: 'Profile', icon: User },
];

const Navbar = ({ onLogout, onRefresh, loading, token }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(15,17,21,0.85)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Brand */}
          <button
            onClick={() => navigate('/feed')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] opacity-20 blur-md" />
              <ShieldCheck className="relative text-[var(--color-accent-blue)]" size={26} />
            </div>
            <span className="text-lg font-bold tracking-tight gradient-text hidden sm:block">SecureVault</span>
          </button>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {NAV_LINKS.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path || (path === '/feed' && location.pathname === '/');
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[rgba(139,92,246,0.15)] text-[var(--color-accent-purple)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                  id={`nav-${label.toLowerCase()}`}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            {token && <NotificationBell token={token} />}

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.05)] transition-all"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent-rose)] hover:bg-[rgba(244,63,94,0.08)] transition-all"
              title="Logout"
              id="nav-logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
