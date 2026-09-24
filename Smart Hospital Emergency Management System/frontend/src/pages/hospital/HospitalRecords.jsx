import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Users, FileText, Calendar, ShieldAlert, UserCheck } from 'lucide-react';

const HospitalRecords = () => {
  const [records, setRecords] = useState([]);
  const [walkInPatients, setWalkInPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walkInLoading, setWalkInLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecords = async () => {
    try {
      const res = await api.get('/api/hospital/patient-records');
      setRecords(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch admitted patient records.');
    } finally {
      setLoading(false);
    }
  };

  // Patients converted from the ambulance-initiated Emergency Case workflow
  // (accident-scene intake, identified later, no login/registration required).
  const fetchWalkInPatients = async () => {
    try {
      const res = await api.get('/api/emergency-case/hospital/all');
      const converted = (res.data.data || []).filter((c) => c.convertedPatient);
      setWalkInPatients(converted);
    } catch (err) {
      // Non-fatal: the legacy patient-records table above still works.
    } finally {
      setWalkInLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchWalkInPatients();
  }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-500" />
          Admitted Patient Logs
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Historical log of patients transported and admitted via the emergency dispatch network.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : records.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Patient Records</h3>
          <p className="text-slate-500 text-sm mt-1">Patients admitted via ambulance will appear here.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Date Admitted</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Patient Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Contact Phone</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Medical Complaint</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Ambulance Route</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {records.map((rec) => (
                  <tr key={rec._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{formatDate(rec.updatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {rec.patientName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {rec.patientPhone}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium max-w-[200px] truncate">
                      {rec.complaint}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">From: {rec.pickupAddress}</span>
                        <span className="mt-0.5">Vehicle: {rec.ambulance?.vehicleNumber || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        rec.priority === 'high'
                          ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                          : rec.priority === 'medium'
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                          : 'text-slate-600 bg-slate-50 dark:bg-slate-800'
                      }`}>
                        {rec.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency Case walk-in patients (ambulance-initiated, identified later) */}
      <div className="pt-2">
        <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-emergency-600" />
          Emergency Case Walk-in Patients
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Patients converted from ambulance-initiated Emergency Cases — treated first, identified afterwards.
        </p>
      </div>

      {walkInLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : walkInPatients.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <UserCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">No emergency cases have been converted to patient records yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Case #</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Patient</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Condition at Scene</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Converted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {walkInPatients.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">{c.caseNumber}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {c.convertedPatient?.fullName || c.identification?.patientName || 'Unknown Patient'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 capitalize">
                      {(c.patientCondition || '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {c.convertedAt ? formatDate(c.convertedAt) : '—'}
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

export default HospitalRecords;
