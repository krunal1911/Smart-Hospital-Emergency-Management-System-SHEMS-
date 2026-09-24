import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Activity, Mail, ChevronLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sentInfo, setSentInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      // The demo backend returns the reset token directly (and logs it server-side)
      // so the flow can be completed end-to-end without a real mail server.
      setSentInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2 mb-2">
            <Activity className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-indigo-400">
              SHEMS Portal
            </span>
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Forgot password</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your email and we'll help you reset it</p>
        </div>

        <div className="w-full space-y-4 rounded-2xl bg-white p-6 shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
          {error && (
            <div className="rounded-xl border border-emergency-500/20 bg-emergency-500/10 px-4 py-2.5 text-sm font-medium text-emergency-600 dark:text-emergency-500">
              {error}
            </div>
          )}

          {sentInfo ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-success-500/20 bg-success-500/10 px-4 py-3 text-sm text-success-600 dark:text-success-400">
                {sentInfo.message || 'Password reset link generated.'}
              </div>
              {sentInfo.token && (
                <Link
                  to={`/reset-password/${sentInfo.token}`}
                  className="block w-full text-center rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-bold text-white shadow transition"
                >
                  Continue to Reset Password
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 px-4 py-2.5 text-sm font-bold text-white shadow transition"
              >
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary-600 transition">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
