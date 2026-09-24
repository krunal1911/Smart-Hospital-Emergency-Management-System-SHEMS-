import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Toast from '../../components/Toast';
import { User, Phone, MapPin, Save, ShieldAlert } from 'lucide-react';

const HospitalProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contact: '',
    emergencyContact: '',
    latitude: 19.0760,
    longitude: 72.8777
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/auth/me');
      const account = res.data.data;
      const profile = account.hospitalProfile || {};

      setFormData({
        name: account.name || '',
        phone: account.phone || '',
        address: profile.address || '',
        contact: profile.contact || '',
        emergencyContact: profile.emergencyContact || '',
        latitude: profile.latitude || 19.0760,
        longitude: profile.longitude || 72.8777
      });
    } catch (err) {
      setErrorMsg('Failed to load hospital profile details.');
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
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.put('/api/hospital/profile', formData);
      setSuccessMsg('Hospital details updated successfully.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update hospital profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationDetect = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          setSuccessMsg('Captured current GPS coordinates.');
        },
        (err) => {
          setErrorMsg('Failed to detect browser location. Check permissions.');
        }
      );
    } else {
      setErrorMsg('Browser does not support geolocation.');
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-primary-500" />
          Hospital Profile Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Keep your emergency lines, street address, and coordinates updated for tracking systems.
        </p>
      </div>

      {successMsg && <Toast type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {errorMsg && <Toast type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Basic Account / Detail Info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-50 dark:border-slate-800">
              Facility Info
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Hospital Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Administrative Contact Phone</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Street Address</label>
              <textarea
                required
                rows="2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Hotline & Coordinate Config */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-50 dark:border-slate-800">
              Hotlines & Location
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Reception / Front Desk Contact</label>
              <input
                type="tel"
                required
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">24/7 Emergency Hotline Number</label>
              <input
                type="tel"
                required
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500 font-bold text-rose-600 dark:text-rose-400"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-400">GPS Coordinates:</span>
              <button
                type="button"
                onClick={handleLocationDetect}
                className="text-xs text-primary-600 font-semibold hover:underline"
              >
                Get Browser Geolocation
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Profile...' : 'Save Profile Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HospitalProfile;
