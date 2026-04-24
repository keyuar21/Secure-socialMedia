import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, Lock } from 'lucide-react';

const VerifyOTP = ({ type, setIsAuthenticated }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [totp, setTotp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 mins
  const inputRefs = useRef([]);

  const email = location.state?.email;
  const totpRequired = !!location.state?.totp_required;
  const isTotp = type === 'login' && totpRequired;

  useEffect(() => {
    if (!email) navigate('/login');
  }, [email, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleDigitChange = (index, value, arr, setArr) => {
    if (!/^\d?$/.test(value)) return;
    const newArr = [...arr];
    newArr[index] = value;
    setArr(newArr);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e, arr, setArr) => {
    if (e.key === 'Backspace' && !arr[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e, arr, setArr) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setArr(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const currentDigits = isTotp ? totp : digits;
  const setCurrentDigits = isTotp ? setTotp : setDigits;
  const code = currentDigits.join('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const endpoint = type === 'registration'
        ? '/auth/verify-registration'
        : '/auth/verify-login';

      const body = type === 'registration'
        ? { email, otp: code }
        : isTotp ? { email, totp: code } : { email, otp: code };

      const res = await axios.post(endpoint, body);

      if (type === 'registration') {
        setMessage('Verification successful! Redirecting…');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        localStorage.setItem('token', res.data.token);
        try {
          const payload = JSON.parse(atob(res.data.token.split('.')[1]));
          if (payload?.id) localStorage.setItem('userId', String(payload.id));
        } catch {}
        if (setIsAuthenticated) setIsAuthenticated(true);
        navigate('/feed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[var(--color-accent-purple)] opacity-[0.04] blur-3xl" />
      </div>

      <div className="relative glass-card p-8 sm:p-10 w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-cyan)] opacity-20 blur-xl scale-150" />
            {isTotp
              ? <Lock className="relative" size={48} color="var(--color-accent-purple)" />
              : <KeyRound className="relative" size={48} color="var(--color-accent-purple)" />
            }
          </div>
          <h1 className="text-2xl font-bold gradient-text">
            {isTotp ? 'Authenticator Code' : 'Verify Identity'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {isTotp ? 'Enter the 6-digit code from your authenticator app' : (
              <>Enter the code sent to <span className="text-[var(--color-text-primary)] font-medium">{email}</span></>
            )}
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.2)] text-[var(--color-accent-rose)] text-sm animate-slide-up">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[var(--color-accent-emerald)] text-sm animate-slide-up">
            {message}
          </div>
        )}

        <form onSubmit={handleVerify}>
          {/* Six digit boxes */}
          <div className="flex justify-center gap-2.5 sm:gap-3 mb-6">
            {currentDigits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none transition-all duration-200 focus:border-[var(--color-accent-purple)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]"
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value, currentDigits, setCurrentDigits)}
                onKeyDown={(e) => handleKeyDown(i, e, currentDigits, setCurrentDigits)}
                onPaste={(e) => handlePaste(e, currentDigits, setCurrentDigits)}
                autoFocus={i === 0}
                id={`otp-digit-${i}`}
              />
            ))}
          </div>

          {/* Countdown */}
          {!isTotp && countdown > 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)] mb-6">
              Code expires in <span className="text-[var(--color-accent-amber)] font-medium">{mins}:{secs.toString().padStart(2, '0')}</span>
            </p>
          )}
          {!isTotp && countdown <= 0 && (
            <p className="text-center text-xs text-[var(--color-accent-rose)] mb-6">
              Code has expired. Please request a new one.
            </p>
          )}

          <button
            type="submit"
            className="btn-gradient w-full text-sm"
            disabled={loading || code.length !== 6}
            id="otp-submit"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying…
              </span>
            ) : 'Verify Code'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOTP;
