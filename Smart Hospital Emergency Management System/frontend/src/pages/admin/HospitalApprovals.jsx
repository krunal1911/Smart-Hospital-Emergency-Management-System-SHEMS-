import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Building, CheckCircle, ShieldAlert, Phone, Mail } from 'lucide-react';

const HospitalApprovals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchHospitals = async () => {
    try {
      const res = await api.get('/api/admin/hospitals');
      setHospitals(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch hospital registration list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const handleApprove = async (id) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/admin/hospitals/${id}/approve`);
      setSuccess(res.data.message || 'Hospital approved successfully.');
      fetchHospitals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve hospital.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Building className="h-6 w-6 text-primary-500" />
          Hospital Registration Approvals
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review and approve registered medical facilities so they can join the active emergency routing pool.
        </p>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : hospitals.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Building className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Hospitals Registered</h3>
          <p className="text-slate-500 text-sm mt-1">Registered facilities will appear here for verification.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Hospital Facility</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Reception Details</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Bed capacity</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Verification Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {hospitals.map((hosp) => (
                  <tr key={hosp._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-semibold">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{hosp.name}</p>
                        <p className="text-xs text-slate-400 font-normal mt-0.5">{hosp.address}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Reception: {hosp.contact}</span>
                        <span className="flex items-center gap-1 text-rose-500 font-semibold"><ShieldAlert className="h-3 w-3" /> Hotline: {hosp.emergencyContact}</span>
                        {hosp.user && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email: {hosp.user.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col gap-0.5 text-xs font-medium">
                        <span>General: {hosp.availableBeds} / {hosp.totalBeds}</span>
                        <span>ICU: {hosp.icuBedsAvailable} / {hosp.icuBedsTotal}</span>
                        <span>Oxygen: {hosp.oxygenBedsAvailable} / {hosp.oxygenBedsTotal}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        hosp.isApproved
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse'
                      }`}>
                        {hosp.isApproved ? 'Approved & Active' : 'Pending Approval'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {!hosp.isApproved ? (
                        <button
                          onClick={() => handleApprove(hosp._id)}
                          disabled={actionLoading}
                          className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                        >
                          <CheckCircle className="h-4.5 w-4.5" /> Approve Facility
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold">Verified</span>
                      )}
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

export default HospitalApprovals;
