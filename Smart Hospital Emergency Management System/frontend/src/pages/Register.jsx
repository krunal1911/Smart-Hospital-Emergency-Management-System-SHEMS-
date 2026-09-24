import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, Mail, Lock, User, Phone, Heart, Building2, Truck } from 'lucide-react';

const ROLES = [
  { value: 'patient', label: 'Patient', icon: Heart },
  { value: 'hospital', label: 'Hospital', icon: Building2 },
  { value: 'driver', label: 'Ambulance Driver', icon: Truck },
];

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient',
    // Hospital-specific
    hospitalName: '',
    address: '',
    // Driver-specific
    licenseNumber: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await register(form);
      if (res.success) {
        navigate('/login');
      } else {
        setError(res.message || 'Registration failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2 mb-2">
            <Activity className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-indigo-400">
              SHEMS Portal
            </span>
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Join as a patient, hospital, or ambulance driver</p>
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

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">I am registering as a</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = form.role === r.value;
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                      active
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {form.role === 'hospital' ? 'Contact Person Name' : 'Full Name'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Full name"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          {form.role === 'hospital' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Hospital Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  name="hospitalName"
                  required
                  value={form.hospitalName}
                  onChange={handleChange}
                  placeholder="e.g. City Care Hospital"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
            </div>
          )}

          {form.role === 'driver' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Driving License Number</label>
              <div className="relative">
                <Truck className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  name="licenseNumber"
                  value={form.licenseNumber}
                  onChange={handleChange}
                  placeholder="e.g. DL-1420110012345"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
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
            <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 px-4 py-2.5 text-sm font-bold text-white shadow transition"
          >
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
