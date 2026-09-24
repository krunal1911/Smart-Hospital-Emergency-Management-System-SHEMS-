import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Truck, MapPin, Building, User, Phone } from 'lucide-react';

const AmbulanceFleet = () => {
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAmbulances = async () => {
    try {
      const res = await api.get('/api/admin/ambulances');
      setAmbulances(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch global ambulance fleet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmbulances();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary-500" />
          Global Ambulance Fleet Directory
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor system-wide emergency response vehicles, driver links, and active dispatch states.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : ambulances.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Truck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Fleet Records</h3>
          <p className="text-slate-500 text-sm mt-1">No emergency ambulance vehicles have been registered in the system.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">License Plate</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Facility</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Driver Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Driver Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Operational status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {ambulances.map((amb) => (
                  <tr key={amb._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {amb.vehicleNumber}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                        <Building className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold">{amb.hospitalAssigned?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{amb.driver?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{amb.driverContact || '--'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        amb.status === 'available'
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                      }`}>
                        {amb.status}
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

export default AmbulanceFleet;
