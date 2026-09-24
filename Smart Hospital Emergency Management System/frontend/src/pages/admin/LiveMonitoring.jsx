import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import InteractiveMap from '../../components/InteractiveMap';
import { MapSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { ShieldAlert, Navigation, Building, User, Activity } from 'lucide-react';

const LiveMonitoring = () => {
  const { socket } = useSocket();
  const [activeRequests, setActiveRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Local state for tracking coordinates of selected run
  const [ambulancePos, setAmbulancePos] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('pending');

  const fetchActive = async () => {
    try {
      const res = await api.get('/api/admin/emergencies/live');
      const data = res.data.data || [];
      setActiveRequests(data);
      
      // Default select the first request if none selected or if previously selected request is not in the list anymore
      if (data.length > 0) {
        const stillActive = data.find(r => r._id === selectedRequest?._id);
        if (!stillActive) {
          handleSelectRequest(data[0]);
        }
      } else {
        setSelectedRequest(null);
        setAmbulancePos(null);
      }
    } catch (err) {
      setError('Failed to load active system dispatches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    setCurrentStatus(req.status);
    setEta(req.eta);
    setDistance(req.distance);
    if (req.ambulance && req.ambulance.currentLatitude) {
      setAmbulancePos([req.ambulance.currentLatitude, req.ambulance.currentLongitude]);
    } else {
      setAmbulancePos(null);
    }
  };

  // Join the selected emergency room for live GPS telemetry
  useEffect(() => {
    if (!socket || !selectedRequest?._id) return;

    socket.emit('join_emergency', { emergencyId: selectedRequest._id });

    socket.on('gps_location_updated', (data) => {
      console.log('Admin live GPS update:', data);
      if (data.lat && data.lng) {
        setAmbulancePos([data.lat, data.lng]);
      }
      if (data.eta !== undefined) setEta(data.eta);
      if (data.distance !== undefined) setDistance(data.distance);
      if (data.status) setCurrentStatus(data.status);
    });

    socket.on('ride_status_updated', (data) => {
      console.log('Admin ride status update:', data);
      if (data.status) {
        setCurrentStatus(data.status);
        // Refresh active list if a job completes/terminates
        if (data.status === 'completed' || data.status === 'rejected') {
          fetchActive();
        }
      }
      if (data.eta !== undefined) setEta(data.eta);
      if (data.distance !== undefined) setDistance(data.distance);
    });

    return () => {
      socket.emit('leave_emergency', { emergencyId: selectedRequest._id });
      socket.off('gps_location_updated');
      socket.off('ride_status_updated');
    };
  }, [socket, selectedRequest?._id]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] p-6">
        <MapSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 h-[calc(100vh-88px)] overflow-hidden">
      
      {/* List of active emergency requests */}
      <div className="lg:col-span-1 space-y-5 overflow-y-auto pr-2 max-h-[85vh]">
        {error && <Toast type="error" message={error} onClose={() => setError('')} />}

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <h3 className="font-extrabold text-sm pb-2 border-b border-slate-50 dark:border-slate-800 flex items-center gap-1.5">
            <Activity className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
            Active Dispatch Operations
          </h3>

          <div className="space-y-3 mt-4">
            {activeRequests.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No active emergency runs right now.
              </div>
            ) : (
              activeRequests.map((req) => (
                <div
                  key={req._id}
                  onClick={() => handleSelectRequest(req)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedRequest?._id === req._id
                      ? 'bg-primary-50/50 border-primary-500 dark:bg-primary-950/20'
                      : 'bg-slate-50 dark:bg-slate-950 border-transparent hover:border-slate-200 dark:hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{req.patientName}</span>
                    <span className="text-[10px] font-bold text-rose-500 uppercase">{req.priority}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">{req.complaint}</p>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
                    <span>Facility: {req.hospital?.name}</span>
                    <span className="capitalize font-semibold text-primary-500">{req.status?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected run details */}
        {selectedRequest && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-slate-700 dark:text-slate-200">Selected Telemetry details</h4>
            <div>
              <span className="text-slate-400">Patient:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedRequest.patientName} ({selectedRequest.patientPhone})</p>
            </div>
            <div>
              <span className="text-slate-400">Destination Facility:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedRequest.hospital?.name}</p>
            </div>
            {selectedRequest.ambulance && (
              <div>
                <span className="text-slate-400">Assigned Vehicle:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedRequest.ambulance?.vehicleNumber} (Driver: {selectedRequest.ambulance?.driver?.name || 'Assigned'})
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <span className="text-slate-400">Live ETA:</span>
                <p className="font-bold text-sm text-primary-500">{eta !== null ? `${eta} mins` : '--'}</p>
              </div>
              <div>
                <span className="text-slate-400">Live Distance:</span>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{distance !== null ? `${distance.toFixed(2)} km` : '--'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main monitoring map */}
      <div className="lg:col-span-2 relative h-full rounded-2xl overflow-hidden shadow-md">
        {selectedRequest ? (
          <InteractiveMap
            patientLocation={[selectedRequest.patientLatitude, selectedRequest.patientLongitude]}
            hospitalLocation={[selectedRequest.hospital?.latitude, selectedRequest.hospital?.longitude]}
            ambulanceLocation={ambulancePos}
            patientName={selectedRequest.patientName}
            hospitalName={selectedRequest.hospital?.name}
            ambulanceVehicle={selectedRequest.ambulance?.vehicleNumber || 'Ambulance'}
            status={currentStatus}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-400">
            <span className="text-sm font-semibold">Select an active dispatch from the side panel to begin map tracking.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMonitoring;
