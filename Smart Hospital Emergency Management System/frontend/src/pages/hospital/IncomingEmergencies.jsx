import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { AlertTriangle, Ambulance, Clock, MapPin, ArrowRight, History } from 'lucide-react';

const conditionLabel = (c) => (c || '').replace(/_/g, ' ');

const statusBadge = (status) => {
  switch (status) {
    case 'hospital_selected':
    case 'hospital_notified':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
    case 'enroute_to_hospital':
      return 'text-primary-600 bg-primary-50 dark:bg-primary-950/20 animate-pulse';
    case 'arrived_at_hospital':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
    default:
      return 'text-slate-600 bg-slate-50 dark:bg-slate-800';
  }
};

const IncomingEmergencies = () => {
  const { socket } = useSocket();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCases = async () => {
    try {
      const res = await api.get('/api/emergency-case/hospital/incoming');
      setCases(res.data.data || []);
    } catch (err) {
      setError('Failed to load incoming emergency cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onNewCase = (payload) => {
      setSuccess(`Incoming: Case ${payload.caseNumber} — ${conditionLabel(payload.patientCondition)}, ETA ${payload.eta} min.`);
      fetchCases();
    };
    const onUpdate = () => fetchCases();

    socket.on('new_emergency_case', onNewCase);
    socket.on('emergency_case_status_updated', onUpdate);
    socket.on('emergency_case_location_updated', onUpdate);

    return () => {
      socket.off('new_emergency_case', onNewCase);
      socket.off('emergency_case_status_updated', onUpdate);
      socket.off('emergency_case_location_updated', onUpdate);
    };
  }, [socket]);

  const handleAcknowledge = async (caseId) => {
    try {
      await api.put(`/api/emergency-case/${caseId}/acknowledge`);
      setSuccess('Acknowledged. Doctors are prepping for arrival.');
    } catch (err) {
      setError('Failed to acknowledge.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emergency-600 flex items-center justify-center text-white shadow-md">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Incoming Emergency Cases</h1>
            <p className="text-xs text-slate-400">Prepare before the patient arrives. No registration required to begin treatment.</p>
          </div>
        </div>
        <Link
          to="/hospital/emergency-cases"
          className="text-xs font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1"
        >
          <History className="h-3.5 w-3.5" /> View All Cases
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
          <Ambulance className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No incoming emergency cases right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <div
              key={c._id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.caseNumber}</span>
                  {c.triageCategory && (
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        c.triageCategory === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-500 border-red-500/30 animate-pulse'
                          : c.triageCategory === 'URGENT'
                          ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                      }`}
                    >
                      {c.triageCategory} TRIAGE
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge(c.status)}`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-full">
                    {conditionLabel(c.patientCondition)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ETA {c.eta ?? '--'} min</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.distance?.toFixed?.(2) ?? '--'} km away</span>
                  <span>Ambulance: {c.ambulance?.vehicleNumber || '—'}</span>
                  <span>Staff: {c.createdBy?.name || '—'}</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={() => handleAcknowledge(c._id)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold transition"
                >
                  Acknowledge
                </button>
                <Link
                  to={`/hospital/emergency-cases/${c._id}`}
                  className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition flex items-center gap-1"
                >
                  Open Case <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncomingEmergencies;
