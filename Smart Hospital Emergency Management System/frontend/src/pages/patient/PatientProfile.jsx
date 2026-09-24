import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/Toast';
import { User, Phone, MapPin, ShieldAlert, Heart, Save, Calendar, Info } from 'lucide-react';

const PatientProfile = () => {
  const { user, login } = useAuth(); // login helper can be used to re-update session data if needed
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    dob: '',
    bloodGroup: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    latitude: 19.0760,
    longitude: 72.8777
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/auth/me');
      const account = res.data.data;
      const profile = account.patientProfile || {};
      
      setFormData({
        name: account.name || '',
        phone: account.phone || '',
        gender: profile.gender || '',
        dob: profile.dob ? new Date(profile.dob).toISOString().split('T')[0] : '',
        bloodGroup: profile.bloodGroup || '',
        address: profile.address || '',
        emergencyContactName: profile.emergencyContactName || '',
        emergencyContactPhone: profile.emergencyContactPhone || '',
        latitude: profile.latitude || 19.0760,
        longitude: profile.longitude || 72.8777
      });
    } catch (err) {
      setErrorMsg('Failed to load profile details.');
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
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.put('/api/patient/profile', formData);
      setSuccessMsg('Profile updated successfully.');
      // Refresh Auth Context to sync name change if applicable
      if (res.data.user) {
        // Option to trigger a local state refresh/sync
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
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
          setSuccessMsg('GPS coordinates captured from browser.');
        },
        (err) => {
          setErrorMsg('Failed to fetch browser location. Check permissions.');
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
          Profile Settings & Medical Info
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Keep your medical info, emergency contacts, and default GPS home location up to date.
        </p>
      </div>

      {successMsg && <Toast type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {errorMsg && <Toast type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Section: Basic Account Info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800">
              Basic Account Info
            </h3>
            
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
              <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Number</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Medical & Safety Info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-100 dark:border-slate-800">
              Medical & Emergency Info
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Blood Group</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-medium text-rose-600 dark:text-rose-400"
              >
                <option value="">Select Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Emergency Contact Person</label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                  placeholder="Phone"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Home Address</label>
              <textarea
                rows="2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                placeholder="Street address, city, state"
              />
            </div>
          </div>
        </div>

        {/* Section: GPS Center Reference */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
              Default GPS Home Center
            </h3>
            <button
              type="button"
              onClick={handleLocationDetect}
              className="text-xs text-primary-600 font-semibold hover:underline"
            >
              Get Browser Location
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

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientProfile;
