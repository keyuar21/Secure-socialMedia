import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('login');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('/auth/login', { email, password });
      navigate('/verify-login', { state: { email, totp_required: !!res.data?.totp_required } });
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.error === 'Please verify your email first') {
        try {
          await axios.post('/auth/resend-otp', { email });
          navigate('/verify-registration', { state: { email, message: 'We resent your verification code. Please check your email.' } });
        } catch {
          setError('Account unverified, but failed to resend code.');
        }
      } else if (!err.response) {
        setError('Network error: Cannot reach the backend server.');
      } else {
        setError(err.response?.data?.error || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('/auth/forgot-password', { email });
      setSuccessMsg(res.data.message);
      setTimeout(() => navigate('/reset-password', { state: { email } }), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[var(--color-accent-blue)] opacity-[0.03] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.03] blur-3xl" />
      </div>

      <div className="relative glass-card p-8 sm:p-10 w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] opacity-20 blur-xl scale-150" />
            <Shield className="relative animate-float" size={48} color="var(--color-accent-blue)" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">
            {view === 'login' ? 'Welcome Back' : 'Reset Password'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {view === 'login' ? 'Sign in to access your secure vault' : 'Enter your email to receive a recovery code'}
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-sm animate-slide-up">
            {successMsg}
          </div>
        )}

        {view === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2" htmlFor="login-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                <input
                  id="login-email"
                  type="email"
                  className="input-field !pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="input-field !pl-10 !pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-blue)] transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className="btn-gradient w-full text-sm"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2" htmlFor="forgot-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                <input
                  id="forgot-email"
                  type="email"
                  className="input-field !pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-gradient w-full text-sm mb-3"
              disabled={loading}
              id="forgot-submit"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : 'Send Recovery Code'}
            </button>
            <button
              type="button"
              className="btn-outline-custom w-full text-sm flex items-center justify-center gap-2"
              onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
            >
              <ArrowLeft size={14} />
              Back to Login
            </button>
          </form>
        )}

        {view === 'login' && (
          <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[var(--color-accent-blue)] hover:text-[var(--color-accent-purple)] font-medium transition-colors">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
