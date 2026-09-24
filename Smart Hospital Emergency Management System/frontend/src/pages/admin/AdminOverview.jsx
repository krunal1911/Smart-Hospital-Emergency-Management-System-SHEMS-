import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { CardSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Shield, Users, Building, Truck, Activity, Heart, ClipboardList, ShieldAlert, UserX } from 'lucide-react';

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/admin/stats');
      setStats(res.data.data);
    } catch (err) {
      setError('Failed to fetch system-wide statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary-500" />
          System Administration Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">Cross-platform fleet tracking, hospitals approval, and bed counters.</p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Total Registered Users</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.users?.total || 0}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Patients: {stats?.users?.patients} | Drivers: {stats?.users?.drivers}
              </p>
            </div>
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/30 rounded-xl text-primary-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Approved Hospitals</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.hospitals?.approved || 0} <span className="text-xs text-slate-400 font-normal">/ {stats?.hospitals?.total || 0}</span>
              </h3>
              <p className="text-[10px] text-amber-600 font-semibold mt-1">
                {stats?.hospitals?.pending || 0} Pending Approvals
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
              <Building className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Ambulance Fleet Status</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.ambulances?.available || 0} <span className="text-xs text-slate-400 font-normal">/ {stats?.ambulances?.total || 0} Online</span>
              </h3>
              <p className="text-[10px] text-rose-500 font-semibold mt-1">
                {stats?.ambulances?.active || 0} Active Runs
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-rose-600">
              <Truck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">System Emergencies</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.emergencies?.active || 0} <span className="text-xs text-slate-400 font-normal">Active</span>
              </h3>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                {stats?.emergencies?.completed || 0} Completed Runs
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Ambulance-initiated Emergency Cases quick access */}
      <Link
        to="/admin/emergency-cases"
        className="block bg-emergency-600 hover:bg-emergency-700 text-white rounded-2xl p-5 shadow-sm transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6" />
            <div>
              <h3 className="font-bold text-sm">Ambulance Emergency Cases</h3>
              <p className="text-xs text-white/80 mt-0.5">
                {stats?.emergencyCases?.active || 0} active · {stats?.emergencyCases?.total || 0} total system-wide
              </p>
            </div>
          </div>
          {stats?.emergencyCases?.unknownPatients > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-xl">
              <UserX className="h-3.5 w-3.5" /> {stats.emergencyCases.unknownPatients} Unknown Patient{stats.emergencyCases.unknownPatients > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </Link>

      {/* Global Bed Capacity Widget */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 pb-3 border-b border-slate-50 dark:border-slate-800 flex items-center gap-1.5">
          <ClipboardList className="h-4.5 w-4.5 text-primary-500" />
          Global Hospital Bed Occupancy Counters
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="block text-xs text-slate-400 uppercase font-semibold">General Beds Total available</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              {stats?.beds?.availableGeneral || 0}
            </span>
            <span className="block text-xs text-slate-400">System capacity: {stats?.beds?.totalGeneral || 0}</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="block text-xs text-slate-400 uppercase font-semibold">ICU Beds Total available</span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats?.beds?.availableICU || 0}
            </span>
            <span className="block text-xs text-slate-400">System capacity: {stats?.beds?.totalICU || 0}</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="block text-xs text-slate-400 uppercase font-semibold">Oxygen Beds Total available</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats?.beds?.availableOxygen || 0}
            </span>
            <span className="block text-xs text-slate-400">System capacity: {stats?.beds?.totalOxygen || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
