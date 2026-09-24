import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Shield, Clock, User, Calendar } from 'lucide-react';

const SystemAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/admin/audit-logs');
      setLogs(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary-500" />
          System Activity & Audit Logs
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Historical log of administrative activities and system events.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Shield className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Logs Available</h3>
          <p className="text-slate-500 text-sm mt-1">Audit logs will appear here as administrative actions occur.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Action Type</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div>
                          <p>{formatDate(log.createdAt)}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatTime(log.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{log.user?.name || 'System Admin'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold uppercase">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {log.user?.role || 'System'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {log.details}
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

export default SystemAudit;
