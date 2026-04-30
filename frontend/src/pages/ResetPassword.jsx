import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Shield, Key, Lock, Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const location = useLocation();
  const [email] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!email) {
    navigate('/login');
    return null;
  }

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/reset-password', { email, otp, newPassword });
      navigate('/login', { state: { message: res.data.message } });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-accent-amber)] opacity-[0.03] blur-3xl" />
      </div>

      <div className="relative glass-card p-8 sm:p-10 w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-rose)] opacity-20 blur-xl scale-150" />
            <Shield className="relative" size={48} color="var(--color-accent-amber)" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Reset Password</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Enter the recovery code sent to <span className="text-[var(--color-text-primary)] font-medium">{email}</span>
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">
            {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2" htmlFor="reset-code">
              Recovery Code
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
              <input
                id="reset-code"
                type="text"
                className="input-field !pl-10 text-center tracking-[0.2em] font-semibold"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength="6"
                required
                placeholder="123456"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2" htmlFor="reset-new-password">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
              <input
                id="reset-new-password"
                type={showPass ? 'text' : 'password'}
                className="input-field !pl-10 !pr-10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
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

          <button
            type="submit"
            className="btn-gradient w-full text-sm"
            disabled={loading || otp.length < 6}
            id="reset-submit"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Resetting…
              </span>
            ) : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
