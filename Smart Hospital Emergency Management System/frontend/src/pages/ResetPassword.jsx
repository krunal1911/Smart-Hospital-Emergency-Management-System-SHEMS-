import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Activity, Lock, ChevronLeft, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/auth/reset-password/${token}`, { password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed. The link may have expired.');
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Reset password</h1>
          <p className="text-sm text-slate-500 mt-1">Choose a new password for your account</p>
        </div>

        <div className="w-full space-y-4 rounded-2xl bg-white p-6 shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
          {error && (
            <div className="rounded-xl border border-emergency-500/20 bg-emergency-500/10 px-4 py-2.5 text-sm font-medium text-emergency-600 dark:text-emergency-500">
              {error}
            </div>
          )}

          {done ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500" />
              <p className="font-semibold text-slate-800 dark:text-slate-100">Password reset successful.</p>
              <p className="text-xs text-slate-500">Redirecting you to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 px-4 py-2.5 text-sm font-bold text-white shadow transition"
              >
                {submitting ? 'Resetting…' : 'Reset Password'}
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

export default ResetPassword;
