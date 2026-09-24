import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { CardSkeleton, TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { ClipboardList, Users, ShieldAlert, Heart, Activity, CheckCircle, XCircle } from 'lucide-react';

const HospitalOverview = () => {
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      const statsRes = await api.get('/api/hospital/stats');
      setStats(statsRes.data.data);

      const requestsRes = await api.get('/api/hospital/requests');
      setRequests(requestsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load hospital dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to new requests real-time
  useEffect(() => {
    if (!socket) return;

    socket.on('new_emergency_request', (newRequest) => {
      setRequests((prev) => [newRequest, ...prev]);
      setSuccess(`URGENT: New emergency request from ${newRequest.patientName}!`);
      // Update stats counts
      setStats((prev) => prev ? {
        ...prev,
        activeEmergencies: prev.activeEmergencies + 1
      } : null);
    });

    socket.on('ride_status_updated', (data) => {
      // Re-fetch data on status update
      fetchData();
    });

    return () => {
      socket.off('new_emergency_request');
      socket.off('ride_status_updated');
    };
  }, [socket]);

  const handleAccept = async (requestId) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/hospital/requests/${requestId}/accept`);
      setSuccess(res.data.message || 'Request accepted. Ambulance dispatched.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept emergency request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/hospital/requests/${requestId}/reject`);
      setSuccess('Emergency request declined.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject emergency request.');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityStyle = (priority) => {
    if (priority === 'high') return 'text-rose-600 bg-rose-50 dark:bg-rose-950/20';
    if (priority === 'medium') return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
    return 'text-slate-600 bg-slate-50 dark:bg-slate-800';
  };

  const getStatusStyle = (status) => {
    if (status === 'completed') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
    if (status === 'rejected') return 'text-rose-600 bg-rose-50 dark:bg-rose-950/20';
    if (status === 'pending') return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse';
    return 'text-primary-600 bg-primary-50 dark:bg-primary-950/20';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hospital Administration Console</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time emergency intake, bed control, and fleet stats.</p>
        </div>
      </div>

      {/* Ambulance-initiated Emergency Cases quick access */}
      <Link
        to="/hospital/incoming"
        className="block bg-emergency-600 hover:bg-emergency-700 text-white rounded-2xl p-5 shadow-sm transition"
      >
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-bold text-sm">Incoming Ambulance Emergency Cases</h3>
            <p className="text-xs text-white/80 mt-0.5">
              View accident-scene cases in real time and prepare before the patient arrives.
            </p>
          </div>
        </div>
      </Link>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Available General Beds</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.beds?.general?.available} <span className="text-xs text-slate-400 font-medium">/ {stats?.beds?.general?.total}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/30 rounded-xl text-primary-600">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">ICU & Oxygen Beds</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.beds?.icu?.available} ICU <span className="text-xs text-slate-400 font-medium">| {stats?.beds?.oxygen?.available} O₂</span>
              </h3>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-rose-600">
              <Heart className="h-5 w-5 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Active Emergencies</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.activeEmergencies || 0}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
              <ShieldAlert className="h-5 w-5 animate-bounce" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400">Ambulances Available</span>
              <h3 className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">
                {stats?.ambulances?.available} <span className="text-xs text-slate-400 font-medium">/ {stats?.ambulances?.total}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Request Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-extrabold text-base">Emergency Intake / Active Bookings</h3>
          <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-semibold text-slate-500">
            Total {requests.length} Requests
          </span>
        </div>

        <div className="overflow-x-auto">
          {requests.length === 0 ? (
            <div className="text-center py-16">
              <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-600 dark:text-slate-400">No requests handled yet</h4>
              <p className="text-slate-400 text-xs mt-1">Pending requests will appear here in real time.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Patient</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Pickup Address</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Complaint</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Priority</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {requests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-semibold">
                      <div>
                        <p>{req.patientName}</p>
                        <p className="text-xs text-slate-400 font-normal mt-0.5">{req.patientPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {req.pickupAddress}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {req.complaint}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${getPriorityStyle(req.priority)}`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {req.ambulance?.vehicleNumber || <span className="text-slate-400 font-normal">--</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getStatusStyle(req.status)}`}>
                        {req.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {req.status === 'pending' ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleAccept(req._id)}
                            disabled={actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Accept
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={actionLoading}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-slate-400">
                          Processed
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default HospitalOverview;
