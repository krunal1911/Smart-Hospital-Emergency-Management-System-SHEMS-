import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { History, Calendar, Clock, MapPin, Building, ShieldAlert } from 'lucide-react';

const PatientHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/patient/emergency/history');
      setHistory(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load booking history.');
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

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
      high: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${styles[priority] || styles.medium}`}>
        {priority}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
      driver_assigned: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-400',
      enroute_to_patient: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400',
      arrived_at_patient: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
      enroute_to_hospital: 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
      rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${styles[status] || styles.pending}`}>
        {status?.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6 text-primary-500" />
          Emergency Ride History
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review all your historical emergency ambulance bookings and admitting details.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <History className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No History Available</h3>
          <p className="text-slate-500 text-sm mt-1">You haven't requested any emergency ambulance runs yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Hospital Facility</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Complaint</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Priority</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Ambulance</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {history.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold">{formatDate(record.createdAt)}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatTime(record.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-semibold">{record.hospital?.name || 'Assigning...'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{record.hospital?.address || '--'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {record.complaint}
                    </td>
                    <td className="px-6 py-4">
                      {getPriorityBadge(record.priority)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {record.ambulance ? (
                        <div className="flex items-center gap-1">
                          <ShieldAlert className="h-3.5 w-3.5 text-primary-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {record.ambulance.vehicleNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(record.status)}
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

export default PatientHistory;
