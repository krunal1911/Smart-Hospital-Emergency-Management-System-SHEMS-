import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { ArrowRight, AlertTriangle } from 'lucide-react';

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
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
  }
};

const HospitalEmergencyCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await api.get('/api/emergency-case/hospital/all');
        setCases(res.data.data || []);
      } catch (err) {
        setError('Failed to load emergency case history.');
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

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

      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-md">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">All Emergency Cases</h1>
          <p className="text-xs text-slate-400">Full history of ambulance-initiated emergency cases for this hospital.</p>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">No emergency cases recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400 uppercase text-[10px]">
                <th className="p-4">Case #</th>
                <th className="p-4">Condition</th>
                <th className="p-4">Status</th>
                <th className="p-4">Patient</th>
                <th className="p-4">Created</th>
                <th className="p-4"></th>
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
                  <td className="p-4 text-slate-500">
                    {c.identification?.isIdentified ? c.identification.patientName : c.identification?.markedUnknown ? 'Unknown Patient' : '—'}
                  </td>
                  <td className="p-4 text-slate-400">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="p-4">
                    <Link to={`/hospital/emergency-cases/${c._id}`} className="text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HospitalEmergencyCases;
