import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Toast from '../../components/Toast';
import { ClipboardList, Save, Activity, Heart } from 'lucide-react';

const HospitalBeds = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    totalBeds: 0,
    availableBeds: 0,
    icuBedsTotal: 0,
    icuBedsAvailable: 0,
    oxygenBedsTotal: 0,
    oxygenBedsAvailable: 0,
    doctorsAvailable: 0,
    emergencyBedsTotal: 0,
    emergencyBedsAvailable: 0,
    hasTraumaCenter: false
  });

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/hospital/stats');
      const stats = res.data.data;
      setFormData({
        totalBeds: stats.beds.general.total || 0,
        availableBeds: stats.beds.general.available || 0,
        icuBedsTotal: stats.beds.icu.total || 0,
        icuBedsAvailable: stats.beds.icu.available || 0,
        oxygenBedsTotal: stats.beds.oxygen.total || 0,
        oxygenBedsAvailable: stats.beds.oxygen.available || 0,
        doctorsAvailable: stats.doctorsAvailable || 0,
        emergencyBedsTotal: stats.beds.emergency?.total || 0,
        emergencyBedsAvailable: stats.beds.emergency?.available || 0,
        hasTraumaCenter: stats.hasTraumaCenter || false
      });
    } catch (err) {
      setError('Failed to fetch current bed capacity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validations: available beds cannot exceed total beds
    if (formData.availableBeds > formData.totalBeds) {
      setError('Available general beds cannot exceed total general beds.');
      setSaving(false);
      return;
    }
    if (formData.icuBedsAvailable > formData.icuBedsTotal) {
      setError('Available ICU beds cannot exceed total ICU beds.');
      setSaving(false);
      return;
    }
    if (formData.oxygenBedsAvailable > formData.oxygenBedsTotal) {
      setError('Available Oxygen beds cannot exceed total Oxygen beds.');
      setSaving(false);
      return;
    }
    if (formData.emergencyBedsAvailable > formData.emergencyBedsTotal) {
      setError('Available Emergency beds cannot exceed total Emergency beds.');
      setSaving(false);
      return;
    }

    try {
      await api.put('/api/hospital/beds', formData);
      setSuccess('Bed capacity stats updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update beds capacity.');
    } finally {
      setSaving(false);
    }
  };

  const getOccupancyPercentage = (available, total) => {
    if (!total || total <= 0) return 0;
    const occupied = total - available;
    return Math.max(0, Math.min(100, Math.round((occupied / total) * 100)));
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
          <ClipboardList className="h-6 w-6 text-primary-500" />
          Beds & Intake Capacity Management
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Dynamically adjust available counts. These values are used to matches incoming ambulance bookings.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* General Beds Control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">General Ward</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-primary-50 text-primary-600 dark:bg-primary-950/20 rounded-full">
                {getOccupancyPercentage(formData.availableBeds, formData.totalBeds)}% Occupied
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total General Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.totalBeds}
                onChange={(e) => setFormData({ ...formData, totalBeds: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Available General Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.availableBeds}
                onChange={(e) => setFormData({ ...formData, availableBeds: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold text-emerald-600"
              />
            </div>
          </div>

          {/* ICU Beds Control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">ICU Ward</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/20 rounded-full">
                {getOccupancyPercentage(formData.icuBedsAvailable, formData.icuBedsTotal)}% Occupied
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total ICU Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.icuBedsTotal}
                onChange={(e) => setFormData({ ...formData, icuBedsTotal: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Available ICU Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.icuBedsAvailable}
                onChange={(e) => setFormData({ ...formData, icuBedsAvailable: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold text-emerald-600"
              />
            </div>
          </div>

          {/* Oxygen Beds Control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Oxygen Support Ward</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-950/20 rounded-full">
                {getOccupancyPercentage(formData.oxygenBedsAvailable, formData.oxygenBedsTotal)}% Occupied
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total Oxygen Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.oxygenBedsTotal}
                onChange={(e) => setFormData({ ...formData, oxygenBedsTotal: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Available Oxygen Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.oxygenBedsAvailable}
                onChange={(e) => setFormData({ ...formData, oxygenBedsAvailable: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold text-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Emergency Bay & Trauma Center */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Emergency Bay (Accident/Trauma Cases)</h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emergency-50 text-emergency-600 dark:bg-emergency-950/20 rounded-full">
              {getOccupancyPercentage(formData.emergencyBedsAvailable, formData.emergencyBedsTotal)}% Occupied
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Total Emergency Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.emergencyBedsTotal}
                onChange={(e) => setFormData({ ...formData, emergencyBedsTotal: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Available Emergency Beds</label>
              <input
                type="number"
                min="0"
                required
                value={formData.emergencyBedsAvailable}
                onChange={(e) => setFormData({ ...formData, emergencyBedsAvailable: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold text-emerald-600"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.hasTraumaCenter}
                  onChange={(e) => setFormData({ ...formData, hasTraumaCenter: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                This hospital has a Trauma Center
              </label>
            </div>
          </div>
        </div>

        {/* Section: Medical Staffing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-2 border-b border-slate-50 dark:border-slate-800">
            Medical Staff Availability
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Doctors Currently On-Duty</label>
            <input
              type="number"
              min="0"
              required
              value={formData.doctorsAvailable}
              onChange={(e) => setFormData({ ...formData, doctorsAvailable: parseInt(e.target.value) || 0 })}
              className="w-full max-w-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Stats...' : 'Save Capacity Stats'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HospitalBeds;
