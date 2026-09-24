import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import InteractiveMap from '../../components/InteractiveMap';
import { MapSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Navigation, Phone, MapPin, Check, X, ShieldAlert, Activity, Power } from 'lucide-react';

const DriverOverview = () => {
  const { socket } = useSocket();
  const [driverProfile, setDriverProfile] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Location — start null so map doesn't snap to Mumbai before GPS resolves
  const [currentCoords, setCurrentCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'locating' | 'success' | 'denied'

  // Real-time broadcast dispatch modal state
  const [broadcastModal, setBroadcastModal] = useState(null);
  // After driver accepts a public SOS, keep the patient location for map display
  const [claimedCase, setClaimedCase] = useState(null);

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords([lat, lng]);
        setGpsStatus('success');
        api.put('/api/driver/location', { lat, lng }).catch(() => {});
      },
      (err) => {
        console.warn('[GPS] Permission denied or error:', err.message);
        setGpsStatus('denied');
        setError('Location access denied. Click "Refresh My Location" and allow location access in your browser.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const fetchData = async () => {
    try {
      const meRes = await api.get('/api/auth/me');
      // Backend returns profile under both res.data.profile and res.data.data.driverProfile
      let profile = meRes.data.data?.driverProfile || meRes.data.profile || null;

      setDriverProfile(profile);
      if (profile && profile.currentLatitude && !isNaN(profile.currentLatitude)) {
        setCurrentCoords([profile.currentLatitude, profile.currentLongitude]);
      }
      // Always also request fresh GPS — stored DB location may be stale

      // Force driver status to available (unconditionally, regardless of stored status)
      try {
        const toggleRes = await api.put('/api/driver/availability', { status: 'available' });
        setDriverProfile(toggleRes.data.data);
      } catch (tErr) {
        console.warn('Could not auto-set driver online:', tErr.message);
      }

      // Request browser geolocation
      requestGps();

      const rideRes = await api.get('/api/driver/active-ride');
      setActiveRide(rideRes.data.data || null);
    } catch (err) {
      setError('Failed to load driver console data.');
      console.error('[DriverOverview] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Socket setup for real-time driver dispatch broadcasts & active ride tracking
  useEffect(() => {
    if (!socket) return;

    const onDispatchBroadcast = (data) => {
      console.log('[DriverConsole] ✅ Emergency Dispatch Broadcast received:');
      console.log('  Patient Location:', data.accidentLatitude, data.accidentLongitude);
      console.log('  Address:', data.accidentAddress);
      console.log('  Case:', data.caseNumber);
      setBroadcastModal(data);

      // Audio alert chime
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-84.wav');
        audio.volume = 0.8;
        audio.play();
      } catch (e) {
        // audio policy ignored
      }
    };

    const onCaseClaimedByOther = (data) => {
      console.log('[DriverConsole] Case claimed by another responder:', data);
      setBroadcastModal((prev) => (prev?.caseNumber === data.caseNumber ? null : prev));
      setSuccess(data.message);
    };

    socket.on('new_emergency_dispatch_broadcast', onDispatchBroadcast);
    socket.on('case_claimed_by_other', onCaseClaimedByOther);

    if (activeRide?._id) {
      socket.emit('join_emergency', { emergencyId: activeRide._id });
    }

    return () => {
      socket.off('new_emergency_dispatch_broadcast', onDispatchBroadcast);
      socket.off('case_claimed_by_other', onCaseClaimedByOther);
      if (activeRide?._id) {
        socket.emit('leave_emergency', { emergencyId: activeRide._id });
      }
    };
  }, [socket, activeRide?._id]);

  // GPS heartbeat — every 20 seconds, push live location to backend
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords([lat, lng]);
        setGpsStatus('success');
        api.put('/api/driver/location', { lat, lng }).catch(() => {});
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleClaimBroadcastCase = async (caseId) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/driver/claim-case/${caseId}`);
      const claimedData = res.data.data?.case;
      setSuccess(`✅ Accepted! Navigating to patient — ${claimedData?.accidentAddress || 'location on map'}`);
      if (claimedData) setClaimedCase(claimedData);
      setBroadcastModal(null);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to accept dispatch.';
      if (err.response?.status === 409) {
        // Already claimed by another driver
        setError('⚠️ This case was just accepted by another ambulance. Waiting for next dispatch...');
        setBroadcastModal(null);
      } else if (err.response?.status === 400) {
        setError('❌ No ambulance assigned to your profile. Contact admin.');
      } else {
        setError(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineBroadcastCase = async (caseId) => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/driver/decline-case/${caseId}`);
      setBroadcastModal(null);
      setSuccess('Dispatch declined. Patient has been notified to select another ambulance.');
    } catch (err) {
      // Even if API fails, close the modal so driver isn't stuck
      setBroadcastModal(null);
      console.warn('[Decline] API error (non-blocking):', err.message);
    } finally {
      setActionLoading(false);
    }
  };


  const handleToggleOnline = async () => {
    if (!driverProfile) return;
    const targetStatus = driverProfile.status === 'offline' ? 'available' : 'offline';
    setError('');
    setSuccess('');
    try {
      const res = await api.put('/api/driver/availability', { status: targetStatus });
      setDriverProfile(res.data.data);
      setSuccess(`Console status updated to ${targetStatus}.`);
    } catch (err) {
      setError('Failed to update status.');
    }
  };

  const handleAcceptRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/driver/ride/${activeRide._id}/accept`);
      setSuccess('Journey assignment accepted.');
      setActiveRide(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept ride.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRide = async () => {
    if (!activeRide) return;
    if (!window.confirm('Decline this emergency run assignment?')) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/driver/ride/${activeRide._id}/reject`);
      setSuccess('Assignment rejected.');
      setActiveRide(null);
    } catch (err) {
      setError('Failed to decline ride.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStepProgress = async (nextStatus) => {
    if (!activeRide) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.put(`/api/driver/ride/${activeRide._id}/step`, { status: nextStatus });
      setActiveRide(res.data.data);
      setSuccess(`Journey status progressed.`);

      // Broadcast on sockets directly
      if (socket) {
        socket.emit('ride_status_changed', {
          emergencyId: activeRide._id,
          status: nextStatus,
          eta: activeRide.eta,
          distance: activeRide.distance
        });
      }
    } catch (err) {
      setError('Failed to progress journey.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/driver/ride/${activeRide._id}/complete`);
      setSuccess('Patient admitted. Job completed.');
      setActiveRide(null);
    } catch (err) {
      setError('Failed to finalize record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate movement towards target
  const handleSimulateGPSMove = async () => {
    if (!activeRide) return;
    
    // Determine target based on status
    let targetLat = activeRide.patientLatitude;
    let targetLng = activeRide.patientLongitude;
    
    if (activeRide.status === 'enroute_to_hospital' && activeRide.hospital) {
      targetLat = activeRide.hospital.latitude;
      targetLng = activeRide.hospital.longitude;
    }

    // Step size ~ 0.002 degrees (~ 220 meters)
    const step = 0.002;
    const currentLat = currentCoords[0];
    const currentLng = currentCoords[1];

    const deltaLat = targetLat - currentLat;
    const deltaLng = targetLng - currentLng;

    const distanceToTarget = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);

    let nextLat = currentLat;
    let nextLng = currentLng;

    if (distanceToTarget <= step) {
      nextLat = targetLat;
      nextLng = targetLng;
      setSuccess('You have arrived at your target coordinates!');
    } else {
      nextLat = currentLat + (deltaLat / distanceToTarget) * step;
      nextLng = currentLng + (deltaLng / distanceToTarget) * step;
    }

    setCurrentCoords([nextLat, nextLng]);

    try {
      // Sync on API
      const res = await api.put('/api/driver/location', { lat: nextLat, lng: nextLng });
      
      // Update local ride eta/distance if returned
      if (res.data.distance !== null) {
        setActiveRide(prev => prev ? {
          ...prev,
          distance: res.data.distance,
          eta: res.data.eta
        } : null);
      }

      // Sync on Sockets
      if (socket) {
        socket.emit('update_gps_location', {
          emergencyId: activeRide._id,
          lat: nextLat,
          lng: nextLng,
          distance: res.data.distance || activeRide.distance,
          eta: res.data.eta || activeRide.eta,
          status: activeRide.status
        });
      }
    } catch (err) {
      console.error('GPS update failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-80px)] p-6">
        <MapSkeleton />
      </div>
    );
  }

  const isOnline = driverProfile?.status === 'available';

  return (
    <div className="p-6 max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 h-[calc(100vh-88px)] overflow-hidden relative">
      {/* Emergency Dispatch Alert — shown INSIDE left panel so map stays visible */}
      {/* (moved below, rendered at top of left col-span-1) */}


      {/* Control panel details */}
      <div className="lg:col-span-1 space-y-5 overflow-y-auto pr-2 max-h-[85vh]">
        {error && <Toast type="error" message={error} onClose={() => setError('')} />}
        {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

        {/* ═══ EMERGENCY DISPATCH ALERT — inside panel so map stays visible ═══ */}
        {broadcastModal && (
          <div className="rounded-2xl border-2 border-red-500 bg-red-950/60 shadow-2xl p-4 space-y-3 animate-pulse-border">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-red-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-red-300 uppercase tracking-wide">🚨 Emergency Dispatch!</p>
                  <p className="text-[10px] text-slate-400 font-mono">#{broadcastModal.caseNumber}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                broadcastModal.triageCategory === 'CRITICAL'
                  ? 'bg-red-500/30 text-red-300 border-red-500/50'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {broadcastModal.triageCategory || 'URGENT'}
              </span>
            </div>

            {/* Patient info */}
            <div className="bg-slate-900/70 rounded-xl p-3 space-y-1.5 text-xs border border-slate-700/50">
              {broadcastModal.reason === 'reassigned' && (
                <p className="text-[11px] text-amber-300 font-bold bg-amber-950/50 border border-amber-500/40 rounded-lg px-2 py-1.5">
                  ⚠️ {broadcastModal.message || 'The previous ambulance is busy — please respond immediately if you can reach this location.'}
                </p>
              )}
              <div className="flex items-start gap-2 text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="font-bold text-white break-all">{broadcastModal.accidentAddress || 'Location on map →'}</span>
              </div>
              {broadcastModal.accidentLatitude && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Navigation className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${broadcastModal.accidentLatitude},${broadcastModal.accidentLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-400 hover:text-blue-300 underline"
                  >
                    {broadcastModal.accidentLatitude?.toFixed(4)}, {broadcastModal.accidentLongitude?.toFixed(4)} ↗
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-300">
                <Activity className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <span className="capitalize font-semibold">{broadcastModal.patientCondition?.replace(/_/g, ' ') || 'Unknown Condition'}</span>
              </div>
              <p className="text-[10px] text-green-400 font-semibold pt-1">
                👉 Look at the map → 🆘 red pin shows patient location
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDeclineBroadcastCase(broadcastModal.caseId)}
                disabled={actionLoading}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold py-2.5 text-xs transition"
              >
                {actionLoading ? '...' : '✗ Decline'}
              </button>
              <button
                type="button"
                onClick={() => handleClaimBroadcastCase(broadcastModal.caseId)}
                disabled={actionLoading}
                className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold py-2.5 text-xs shadow-lg transition flex items-center justify-center gap-1.5"
              >
                <Navigation className="h-3.5 w-3.5" />
                {actionLoading ? 'Processing…' : '✓ ACCEPT & GO'}
              </button>
            </div>
          </div>
        )}

        {/* Claimed case banner — shows patient location after accepting */}
        {claimedCase && !broadcastModal && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/40 p-3 text-xs space-y-1">
            <p className="font-bold text-emerald-400">✅ Case Accepted — En Route to Patient</p>
            <p className="text-slate-300">{claimedCase.accidentAddress || 'Location on map'}</p>
            {claimedCase.accidentLatitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${claimedCase.accidentLatitude},${claimedCase.accidentLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-400 underline hover:text-blue-300"
              >
                📍 {claimedCase.accidentLatitude?.toFixed(4)}, {claimedCase.accidentLongitude?.toFixed(4)} — Open in Maps ↗
              </a>
            )}
          </div>
        )}

        {/* Toggle Status Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Ambulance Service Console</h3>
            <p className="text-xs text-slate-400 mt-0.5">Toggle duty availability status.</p>
          </div>
          <button
            onClick={handleToggleOnline}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
            }`}
          >
            <Power className="h-4 w-4" />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>

        {/* GPS Location Card */}
        <div className={`rounded-2xl p-4 border shadow-sm flex items-center justify-between gap-3 ${
          gpsStatus === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
            : gpsStatus === 'denied'
            ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <MapPin className={`h-4 w-4 shrink-0 ${
              gpsStatus === 'success' ? 'text-emerald-600' : gpsStatus === 'denied' ? 'text-red-500' : 'text-slate-400'
            }`} />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {gpsStatus === 'success'
                  ? `📍 Live GPS: ${currentCoords[0].toFixed(4)}, ${currentCoords[1].toFixed(4)}`
                  : gpsStatus === 'locating'
                  ? '📡 Getting your location...'
                  : gpsStatus === 'denied'
                  ? '⚠️ Location Permission Denied'
                  : '📍 Location not yet fetched'}
              </p>
              {gpsStatus === 'denied' && (
                <p className="text-[10px] text-red-400 mt-0.5">Allow location in browser → address bar → 🔒 → Location → Allow</p>
              )}
            </div>
          </div>
          <button
            onClick={requestGps}
            disabled={gpsStatus === 'locating'}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 disabled:opacity-50 transition"
          >
            {gpsStatus === 'locating' ? 'Locating…' : '🔄 Refresh'}
          </button>
        </div>

        {/* Accident Scene Emergency Case CTA */}
        <Link
          to="/driver/emergency-case"
          className="block bg-emergency-600 hover:bg-emergency-700 text-white rounded-2xl p-5 shadow-sm transition"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6" />
            <div>
              <h3 className="font-bold text-sm">Reached an Accident Scene?</h3>
              <p className="text-xs text-white/80 mt-0.5">Create an Emergency Case — no patient login required.</p>
            </div>
          </div>
        </Link>

        {/* Active Emergency Card */}
        {activeRide ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping"></span>
                Emergency Dispatch Job
              </span>
              <span className="text-xs text-slate-400">Run: {activeRide._id.slice(-6)}</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Patient Intake</span>
                <p className="text-sm font-bold mt-0.5">{activeRide.patientName}</p>
                <p className="text-xs text-slate-500">{activeRide.patientPhone}</p>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Pickup Address</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-start gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                  {activeRide.pickupAddress}
                </p>
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">Medical Complaint</span>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold bg-rose-50 dark:bg-rose-950/20 p-2 rounded-xl border border-rose-100/50 mt-1">
                  {activeRide.complaint}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                  <span className="block text-[10px] text-slate-400">ETA</span>
                  <span className="font-bold text-sm text-primary-500">{activeRide.eta ?? '--'} mins</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Distance</span>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{activeRide.distance?.toFixed(2) ?? '--'} km</span>
                </div>
              </div>
            </div>

            {/* Actions for Ride Stages */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              {activeRide.status === 'accepted' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleAcceptRide}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                  >
                    Accept Run
                  </button>
                  <button
                    onClick={handleRejectRide}
                    disabled={actionLoading}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRide.status === 'driver_assigned' && (
                    <button
                      onClick={() => handleStepProgress('enroute_to_patient')}
                      disabled={actionLoading}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                    >
                      Start Journey to Patient
                    </button>
                  )}
                  {activeRide.status === 'enroute_to_patient' && (
                    <button
                      onClick={() => handleStepProgress('arrived_at_patient')}
                      disabled={actionLoading}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                    >
                      Mark Arrived at Patient Location
                    </button>
                  )}
                  {activeRide.status === 'arrived_at_patient' && (
                    <button
                      onClick={() => handleStepProgress('enroute_to_hospital')}
                      disabled={actionLoading}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                    >
                      Depart for Admitting Hospital
                    </button>
                  )}
                  {activeRide.status === 'enroute_to_hospital' && (
                    <button
                      onClick={handleCompleteRide}
                      disabled={actionLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                    >
                      Complete Admission / End Run
                    </button>
                  )}

                  {/* Simulator Trigger */}
                  <button
                    type="button"
                    onClick={handleSimulateGPSMove}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Navigation className="h-3.5 w-3.5 animate-spin" /> Simulate GPS Movement
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
            <Activity className="h-10 w-10 text-slate-300 mx-auto mb-2 animate-pulse" />
            <h4 className="font-bold text-slate-600 dark:text-slate-400">Idle / Monitoring</h4>
            <p className="text-slate-400 text-xs mt-1">
              {isOnline ? 'Awaiting incoming emergency dispatches...' : 'Turn on Console status to receive job requests.'}
            </p>
          </div>
        )}
      </div>

      {/* Map tracking View */}
      <div className="lg:col-span-2 relative h-full rounded-2xl overflow-hidden shadow-md">
        {/* Patient location banner when dispatch is active but no ride accepted yet */}
        {broadcastModal && !activeRide && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg animate-pulse flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            🚨 PATIENT LOCATION: {broadcastModal.accidentAddress || `${broadcastModal.accidentLatitude?.toFixed(4)}, ${broadcastModal.accidentLongitude?.toFixed(4)}`}
          </div>
        )}
        <InteractiveMap
          patientLocation={
            // Priority: active ride > claimed public SOS case > broadcast modal
            activeRide && activeRide.patientLatitude && !isNaN(activeRide.patientLatitude)
              ? [activeRide.patientLatitude, activeRide.patientLongitude]
              : claimedCase && claimedCase.accidentLatitude && !isNaN(claimedCase.accidentLatitude)
              ? [claimedCase.accidentLatitude, claimedCase.accidentLongitude]
              : broadcastModal && broadcastModal.accidentLatitude && !isNaN(broadcastModal.accidentLatitude)
              ? [broadcastModal.accidentLatitude, broadcastModal.accidentLongitude]
              : null
          }
          hospitalLocation={activeRide && activeRide.hospital ? [activeRide.hospital.latitude, activeRide.hospital.longitude] : null}
          ambulanceLocation={currentCoords}
          patientName={activeRide?.patientName || (broadcastModal || claimedCase ? '🚨 Emergency Patient' : 'Patient')}
          hospitalName={activeRide?.hospital?.name || 'Hospital'}
          status={activeRide?.status || 'pending'}
        />
      </div>
    </div>
  );
};

export default DriverOverview;
