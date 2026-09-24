import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Toast from '../../components/Toast';
import { User, Phone, Save, Shield } from 'lucide-react';

const DriverProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licenseNumber: ''
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/auth/me');
      const account = res.data.data;
      const profile = account.driverProfile || {};

      setFormData({
        name: account.name || '',
        phone: account.phone || '',
        licenseNumber: profile.licenseNumber || ''
      });
    } catch (err) {
      setError('Failed to load profile settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/api/driver/profile', formData);
      setSuccess('Driver profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-primary-500" />
          Driver Profile Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your basic account profile and driving license logs.</p>
      </div>

      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleUpdate} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Phone</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Commercial Driver License (CDL) / License Number</label>
          <div className="relative">
            <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              required
              placeholder="e.g. DL-1234567890"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-mono font-semibold"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DriverProfile;
