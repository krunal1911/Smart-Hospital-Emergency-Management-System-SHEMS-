import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { ShieldAlert, UserX, UserCheck, FilePlus2 } from 'lucide-react';

const conditionLabel = (c) => (c || '').replace(/_/g, ' ');

const statusBadge = (status) => {
  switch (status) {
    case 'converted':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
    case 'in_treatment':
    case 'identified':
      return 'text-primary-600 bg-primary-50 dark:bg-primary-950/20';
    case 'closed':
      return 'text-slate-500 bg-slate-100 dark:bg-slate-800';
    default:
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse';
  }
};

const AdminEmergencyCases = () => {
  const { socket } = useSocket();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCases = async () => {
    try {
      const res = await api.get('/api/emergency-case/admin/all');
      setCases(res.data.data || []);
    } catch (err) {
      setError('Failed to load system-wide emergency cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // Live refresh whenever any case is created/updated anywhere in the system
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchCases();
    const onNew = (payload) => {
      setSuccess(`New Emergency Case ${payload.caseNumber} created.`);
      fetchCases();
    };
    socket.on('new_emergency_case', onNew);
    socket.on('emergency_case_status_updated', refresh);
    return () => {
      socket.off('new_emergency_case', onNew);
      socket.off('emergency_case_status_updated', refresh);
    };
  }, [socket]);

  const total = cases.length;
  const active = cases.filter((c) => !['converted', 'closed'].includes(c.status)).length;
  const unknown = cases.filter((c) => c.identification?.markedUnknown && !c.convertedPatient).length;
  const converted = cases.filter((c) => c.status === 'converted').length;

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-emergency-600 flex items-center justify-center text-white shadow-md">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">System-Wide Emergency Cases</h1>
          <p className="text-xs text-slate-400">All ambulance-initiated accident cases across every hospital.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Total Cases</span>
          <h3 className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{total}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Active</span>
          <h3 className="text-2xl font-bold mt-1 text-amber-600">{active}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><UserX className="h-3.5 w-3.5" /> Unknown Patients</span>
          <h3 className="text-2xl font-bold mt-1 text-rose-600">{unknown}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><FilePlus2 className="h-3.5 w-3.5" /> Converted to Patient</span>
          <h3 className="text-2xl font-bold mt-1 text-emerald-600">{converted}</h3>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">No emergency cases have been created yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400 uppercase text-[10px]">
                <th className="p-4">Case #</th>
                <th className="p-4">Condition</th>
                <th className="p-4">Status</th>
                <th className="p-4">Hospital</th>
                <th className="p-4">Ambulance</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Identity</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c._id} className="border-b border-slate-50 dark:border-slate-800/50">
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{c.caseNumber}</td>
                  <td className="p-4 capitalize text-slate-500">{conditionLabel(c.patientCondition)}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge(c.status)}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{c.hospital?.name || '—'}</td>
                  <td className="p-4 text-slate-500">{c.ambulance?.vehicleNumber || '—'}</td>
                  <td className="p-4 text-slate-500">{c.createdBy?.name || '—'}</td>
                  <td className="p-4">
                    {c.identification?.isIdentified ? (
                      <span className="flex items-center gap-1 text-primary-600"><UserCheck className="h-3.5 w-3.5" /> Identified</span>
                    ) : c.identification?.markedUnknown ? (
                      <span className="flex items-center gap-1 text-rose-600"><UserX className="h-3.5 w-3.5" /> Unknown</span>
                    ) : (
                      <span className="text-slate-400">Pending</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminEmergencyCases;
