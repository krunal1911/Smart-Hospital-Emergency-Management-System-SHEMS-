import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CardSkeleton as LoaderSkeletons } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';

const PatientOverview = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await api.get('/api/patient/emergency/active');
        setRequest(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load active request');
      } finally {
        setLoading(false);
      }
    };
    fetchActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoaderSkeletons />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome, {user?.name || 'Patient'}</h1>
      {error && <Toast type="error" message={error} />}
      {request ? (
        <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Current Emergency Request</h2>
          <p><strong>Status:</strong> {request.status}</p>
          <p><strong>Hospital:</strong> {request.hospital?.name || 'Assigning...'}</p>
          <p><strong>Ambulance:</strong> {request.ambulance?.vehicleNumber || 'Pending'}</p>
          <p><strong>ETA:</strong> {request.eta ?? '--'} minutes</p>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-300">You have no active emergency requests.</p>
      )}
    </div>
  );
};

export default PatientOverview;
