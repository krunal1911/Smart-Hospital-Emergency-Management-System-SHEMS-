import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import InteractiveMap from '../../components/InteractiveMap';
import { MapSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Activity, Phone, MapPin, Building, ShieldAlert, Heart, Calendar } from 'lucide-react';

const PatientLiveTracking = () => {
  const { socket } = useSocket();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Real-time tracking coordinates
  const [ambulancePos, setAmbulancePos] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('pending');

  const fetchActiveBooking = async () => {
    try {
      const res = await api.get('/api/patient/emergency/active');
      if (res.data.data) {
        const book = res.data.data;
        setBooking(book);
        setCurrentStatus(book.status);
        setEta(book.eta);
        setDistance(book.distance);
        if (book.ambulance && book.ambulance.currentLatitude) {
          setAmbulancePos([book.ambulance.currentLatitude, book.ambulance.currentLongitude]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tracking details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket Room integration
  useEffect(() => {
    if (!socket || !booking?._id) return;

    socket.emit('join_emergency', { emergencyId: booking._id });

    socket.on('gps_location_updated', (data) => {
      console.log('GPS Updated:', data);
      if (data.lat && data.lng) {
        setAmbulancePos([data.lat, data.lng]);
      }
      if (data.eta !== undefined) setEta(data.eta);
      if (data.distance !== undefined) setDistance(data.distance);
      if (data.status) setCurrentStatus(data.status);
    });

    socket.on('ride_status_updated', (data) => {
      console.log('Status Updated:', data);
      if (data.status) setCurrentStatus(data.status);
      if (data.eta !== undefined) setEta(data.eta);
      if (data.distance !== undefined) setDistance(data.distance);
    });

    return () => {
      socket.emit('leave_emergency', { emergencyId: booking._id });
      socket.off('gps_location_updated');
      socket.off('ride_status_updated');
    };
  }, [socket, booking?._id]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] p-6">
        <MapSkeleton />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-10 shadow-sm">
          <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">No Active Emergency</h2>
          <p className="text-slate-400 text-sm mt-2">
            You do not currently have any active emergency ambulance requests. If you need urgent medical transport, please book an ambulance immediately.
          </p>
          <div className="mt-8">
            <Link
              to="/patient/search"
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow transition inline-flex items-center gap-2"
            >
              <Heart className="h-4 w-4 animate-pulse" />
              Find & Book Ambulance
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate coordinates for pins
  const patientCoords = [booking.patientLatitude, booking.patientLongitude];
  const hospitalCoords = [booking.hospital?.latitude, booking.hospital?.longitude];

  // Helper status map
  const statusTexts = {
    pending: 'Awaiting Hospital Acceptance',
    accepted: 'Accepted by Hospital',
    driver_assigned: 'Driver Dispatched',
    enroute_to_patient: 'Ambulance Enroute to You',
    arrived_at_patient: 'Ambulance Arrived at Your Location',
    enroute_to_hospital: 'Enroute to Hospital',
    completed: 'Admission Completed'
  };

  const steps = [
    { key: 'pending', label: 'Requested' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'enroute_to_patient', label: 'Enroute' },
    { key: 'arrived_at_patient', label: 'Arrived' },
    { key: 'enroute_to_hospital', label: 'Admitting' }
  ];

  const getStepIndex = (status) => {
    if (['pending'].includes(status)) return 0;
    if (['accepted', 'driver_assigned'].includes(status)) return 1;
    if (['enroute_to_patient'].includes(status)) return 2;
    if (['arrived_at_patient'].includes(status)) return 3;
    if (['enroute_to_hospital', 'completed'].includes(status)) return 4;
    return 0;
  };

  const activeStepIdx = getStepIndex(currentStatus);

  return (
    <div className="p-6 max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 h-[calc(100vh-88px)] overflow-hidden">
      {/* Sidebar Details Card */}
      <div className="lg:col-span-1 space-y-5 overflow-y-auto pr-2 max-h-[85vh]">
        {error && <Toast type="error" message={error} onClose={() => setError('')} />}

        {/* Real-time Status Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping"></span>
              Live Tracking Stream
            </span>
            <span className="text-xs text-slate-400">ID: {booking._id.slice(-6)}</span>
          </div>

          <h2 className="text-xl font-bold mt-3 text-slate-800 dark:text-slate-100">
            {statusTexts[currentStatus] || 'Processing request...'}
          </h2>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
              <span className="block text-xs text-slate-400">Estimated Arrival</span>
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1 block">
                {eta !== null ? `${eta} mins` : '--'}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
              <span className="block text-xs text-slate-400">Distance Away</span>
              <span className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                {distance !== null ? `${distance.toFixed(2)} km` : '--'}
              </span>
            </div>
          </div>

          {/* Step Timeline */}
          <div className="mt-8 relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800"></div>
            <div className="space-y-6">
              {steps.map((step, idx) => {
                const isCompleted = idx < activeStepIdx;
                const isActive = idx === activeStepIdx;
                return (
                  <div key={step.key} className="flex items-start gap-4 relative">
                    <div
                      className={`h-6.5 w-6.5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isActive
                          ? 'bg-primary-500 border-primary-500 text-white animate-pulse'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div>
                      <h4 className={`text-xs font-semibold ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {step.label}
                      </h4>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Care Circle details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">Emergency Details</h3>
          
          <div className="flex items-start gap-3 text-xs">
            <Building className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="font-bold">{booking.hospital?.name}</p>
              <p className="text-slate-400 mt-0.5">{booking.hospital?.address}</p>
              <p className="text-rose-500 font-semibold mt-1">📞 Hotline: {booking.hospital?.emergencyContact}</p>
            </div>
          </div>

          {booking.ambulance && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-3 text-xs">
              <ShieldAlert className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="font-bold">Ambulance: {booking.ambulance.vehicleNumber}</p>
                {booking.ambulance.driver && (
                  <>
                    <p className="text-slate-400 mt-0.5">Driver: {booking.ambulance.driver.name}</p>
                    <p className="text-primary-600 font-semibold mt-1">📞 Contact: {booking.ambulance.driver.phone}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Map Box */}
      <div className="lg:col-span-2 relative h-full rounded-2xl overflow-hidden shadow-md">
        <InteractiveMap
          patientLocation={patientCoords}
          hospitalLocation={hospitalCoords}
          ambulanceLocation={ambulancePos}
          patientName={booking.patientName}
          hospitalName={booking.hospital?.name}
          ambulanceVehicle={booking.ambulance?.vehicleNumber || 'Ambulance'}
          status={currentStatus}
        />
      </div>
    </div>
  );
};

export default PatientLiveTracking;
