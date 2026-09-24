import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { History, Calendar, Clock, Building, User, Activity } from 'lucide-react';

const DriverHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/driver/history');
      setHistory(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load historical logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6 text-primary-500" />
          Completed Emergency Runs
        </h1>
        <p className="text-slate-500 text-sm mt-1">Review historical jobs completed and patient admissions.</p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <History className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Job Logs</h3>
          <p className="text-slate-500 text-sm mt-1">Completed emergency dispatches will appear here.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Patient</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Intake Complaint</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Admitted Hospital</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Route Coordinates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {history.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{formatDate(record.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{record.patientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {record.complaint}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.hospital?.name || 'Unknown Facility'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <span className="block">Pickup: {record.pickupAddress}</span>
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

export default DriverHistory;
