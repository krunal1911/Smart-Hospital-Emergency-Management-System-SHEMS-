import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, Eye, EyeOff, Siren } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await login(form.email, form.password);
      if (res.success) {
        // Redirect to the correct dashboard based on the logged-in user's role
        navigate(`/${res.user.role}`, { replace: true });
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to access your dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full space-y-4 rounded-2xl bg-white p-6 shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800"
        >
          {error && (
            <div className="rounded-xl border border-emergency-500/20 bg-emergency-500/10 px-4 py-2.5 text-sm font-medium text-emergency-600 dark:text-emergency-500">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-500">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Your password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 px-4 py-2.5 text-sm font-bold text-white shadow transition"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Sign up
            </Link>
          </p>
        </form>

        <Link
          to="/emergency"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-emergency-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emergency-700 transition"
        >
          <Siren className="h-4 w-4" /> Need help right now? Use Emergency SOS (no login)
        </Link>
      </div>
    </div>
  );
};

export default Login;
