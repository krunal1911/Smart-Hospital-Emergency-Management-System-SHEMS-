import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Users, Truck, User, ShieldAlert, Phone } from 'lucide-react';

const DriverRoster = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/api/admin/drivers');
      setDrivers(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch system-wide driver roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-500" />
          System Driver Roster
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor system-wide responders, commercial driver licenses, and live duty availability.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : drivers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Responders Registered</h3>
          <p className="text-slate-500 text-sm mt-1">No driver accounts have been verified in the system directory.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Driver Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">License ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Vehicle</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Console Duty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {drivers.map((drv) => (
                  <tr key={drv._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4.5 w-4.5 text-slate-400" />
                        <div>
                          <p>{drv.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-400 font-normal mt-0.5">{drv.user?.phone || '--'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {drv.user?.email || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {drv.licenseNumber || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {drv.currentAmbulance ? (
                        <div className="flex items-center gap-1 text-primary-600 font-semibold">
                          <Truck className="h-4 w-4" />
                          <span>{drv.currentAmbulance?.vehicleNumber}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        drv.status === 'offline'
                          ? 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                          : drv.status === 'available'
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse'
                      }`}>
                        {drv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverRoster;
