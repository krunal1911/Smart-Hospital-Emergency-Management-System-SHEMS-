import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import InteractiveMap from '../../components/InteractiveMap';
import Toast from '../../components/Toast';
import {
  MapPin,
  Clock,
  Camera,
  AlertTriangle,
  Hospital as HospitalIcon,
  Navigation,
  BellRing,
  CheckCircle2,
  Ambulance,
} from 'lucide-react';

const CONDITIONS = [
  { value: 'conscious', label: 'Conscious' },
  { value: 'unconscious', label: 'Unconscious' },
  { value: 'heavy_bleeding', label: 'Heavy Bleeding' },
  { value: 'fracture', label: 'Fracture' },
  { value: 'burns', label: 'Burns' },
  { value: 'cardiac_arrest', label: 'Cardiac Arrest' },
  { value: 'breathing_difficulty', label: 'Breathing Difficulty' },
  { value: 'head_injury', label: 'Head Injury' },
  { value: 'other', label: 'Other' },
];

const CreateEmergencyCase = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [step, setStep] = useState(1); // 1: scene capture, 2: hospital select, 3: live tracking
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [emergencyCase, setEmergencyCase] = useState(null);

  // --- Step 1 form state ---
  const [coords, setCoords] = useState({ lat: null, lng: null }); // null = not yet resolved
  const [locating, setLocating] = useState(false);
  const [accidentAddress, setAccidentAddress] = useState('');
  const [patientCondition, setPatientCondition] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [ambulanceStaffNotes, setAmbulanceStaffNotes] = useState('');
  const [photos, setPhotos] = useState([]);

  // --- Step 2 state ---
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);

  // Auto-request GPS helper — always called on load
  const requestLiveGPS = (caseId = null) => {
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setLocating(false);

        // If there's an existing case, update its GPS in the DB too
        if (caseId) {
          try {
            await api.put(`/api/emergency-case/${caseId}/location`, { lat, lng });
            console.log('[CreateEmergencyCase] Updated case location to GPS coords:', lat, lng);
          } catch (e) {
            console.warn('[CreateEmergencyCase] Could not update case location:', e.message);
          }
        }
      },
      (err) => {
        console.warn('[GPS] Permission denied:', err.message);
        setLocating(false);
        // GPS failed — coords stay null, map shows placeholder
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Check if this ambulance already has an open case (resume instead of duplicate)
  useEffect(() => {
    const checkActive = async () => {
      try {
        const res = await api.get('/api/emergency-case/active/mine');
        if (res.data.data) {
          const caseData = res.data.data;
          setEmergencyCase(caseData);
          if (caseData.status === 'created') setStep(2);
          else setStep(3);

          // Always get fresh GPS and update the case — never trust stale stored coords
          requestLiveGPS(caseData._id);
          return;
        }
      } catch (err) {
        // no-op; fine to start fresh
      }
      // No existing case — auto-request GPS for scene capture
      requestLiveGPS(null);
    };
    checkActive();
  }, []);


  // Live-track socket room join once a case exists
  useEffect(() => {
    if (!socket || !emergencyCase?._id) return;
    socket.emit('join_emergency_case', { caseId: emergencyCase._id });
    return () => socket.emit('leave_emergency_case', { caseId: emergencyCase._id });
  }, [socket, emergencyCase?._id]);

  const useDeviceGPS = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setError('GPS is not available on this device. Enter coordinates manually.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        setError('');
      },
      () => {
        setError('Could not read device GPS. Please allow location access in your browser.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!patientCondition) {
      setError('Select the patient condition before continuing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('lat', coords.lat);
      formData.append('lng', coords.lng);
      formData.append('accidentAddress', accidentAddress);
      formData.append('patientCondition', patientCondition);
      formData.append('conditionNotes', conditionNotes);
      formData.append('ambulanceStaffNotes', ambulanceStaffNotes);
      photos.forEach((file) => formData.append('photos', file));

      const res = await api.post('/api/emergency-case', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEmergencyCase(res.data.data);
      setSuccess(`Emergency Case ${res.data.data.caseNumber} created.`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create emergency case.');
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyHospitals = useCallback(async () => {
    if (!emergencyCase?._id) return;
    setHospitalsLoading(true);
    try {
      const res = await api.get(`/api/emergency-case/${emergencyCase._id}/nearby-hospitals`);
      setHospitals(res.data.data || []);
    } catch (err) {
      setError('Failed to load nearby hospitals.');
    } finally {
      setHospitalsLoading(false);
    }
  }, [emergencyCase?._id]);

  useEffect(() => {
    if (step === 2) loadNearbyHospitals();
  }, [step, loadNearbyHospitals]);

  const handleSelectAndNotify = async (hospitalId) => {
    setSelectedHospitalId(hospitalId);
    setLoading(true);
    setError('');
    try {
      const selectRes = await api.put(`/api/emergency-case/${emergencyCase._id}/select-hospital`, { hospitalId });
      setEmergencyCase(selectRes.data.data);

      const notifyRes = await api.post(`/api/emergency-case/${emergencyCase._id}/notify-hospital`);
      setEmergencyCase(notifyRes.data.data);
      setSuccess('Hospital notified. Doctors are preparing for arrival.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select/notify hospital.');
    } finally {
      setLoading(false);
    }
  };

  const handleProgress = async (nextStatus) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.put(`/api/emergency-case/${emergencyCase._id}/progress`, { status: nextStatus });
      setEmergencyCase(res.data.data);
      setSuccess(`Case status updated: ${nextStatus.replace(/_/g, ' ')}.`);
      if (nextStatus === 'arrived_at_hospital') {
        setTimeout(() => navigate('/driver'), 1500);
      }
    } catch (err) {
      setError('Failed to progress case.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateGPS = async () => {
    if (!emergencyCase?.hospital) return;
    const target = emergencyCase.hospital;
    const step_ = 0.002;
    const deltaLat = target.latitude - coords.lat;
    const deltaLng = target.longitude - coords.lng;
    const dist = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);

    let nextLat = coords.lat;
    let nextLng = coords.lng;
    if (dist <= step_) {
      nextLat = target.latitude;
      nextLng = target.longitude;
    } else {
      nextLat = coords.lat + (deltaLat / dist) * step_;
      nextLng = coords.lng + (deltaLng / dist) * step_;
    }
    setCoords({ lat: nextLat, lng: nextLng });

    try {
      const res = await api.put(`/api/emergency-case/${emergencyCase._id}/location`, { lat: nextLat, lng: nextLng });
      setEmergencyCase((prev) => (prev ? { ...prev, distance: res.data.distance, eta: res.data.eta } : prev));
    } catch (err) {
      console.error('GPS push failed', err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-emergency-600 flex items-center justify-center text-white shadow-md">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Create Emergency Case</h1>
          <p className="text-xs text-slate-400">Accident-scene intake — no patient login or registration required.</p>
        </div>
        {emergencyCase && (
          <span className="ml-auto text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl">
            Case: {emergencyCase.caseNumber}
          </span>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs font-semibold">
        {['Scene Capture', 'Select Hospital', 'Live Transport'].map((label, idx) => (
          <React.Fragment key={label}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                step === idx + 1
                  ? 'bg-emergency-600 text-white'
                  : step > idx + 1
                  ? 'bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              {step > idx + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{idx + 1}</span>}
              {label}
            </div>
            {idx < 2 && <div className="h-px w-6 bg-slate-200 dark:bg-slate-700" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Scene capture */}
      {step === 1 && (
        <form onSubmit={handleCreateCase} className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                <MapPin className="h-3.5 w-3.5" /> GPS Location
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="any"
                  value={coords.lat}
                  onChange={(e) => setCoords((c) => ({ ...c, lat: parseFloat(e.target.value) }))}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="any"
                  value={coords.lng}
                  onChange={(e) => setCoords((c) => ({ ...c, lng: parseFloat(e.target.value) }))}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Longitude"
                />
              </div>
              <button
                type="button"
                onClick={useDeviceGPS}
                disabled={locating}
                className="mt-2 text-xs font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1.5"
              >
                <Navigation className="h-3.5 w-3.5" /> {locating ? '📡 Detecting your location…' : '📍 Use current device GPS'}
              </button>
              {coords.lat === null && !locating && (
                <p className="text-[10px] text-amber-500 mt-1">⚠️ Location not detected yet. Click above to use GPS or enter manually.</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Accident Address (optional)</label>
              <input
                type="text"
                value={accidentAddress}
                onChange={(e) => setAccidentAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="e.g. Near Andheri Flyover, Mumbai"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                <Clock className="h-3.5 w-3.5" /> Accident Time
              </label>
              <p className="text-xs text-slate-400">Recorded automatically as the moment this case is created.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Patient Condition *</label>
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPatientCondition(c.value)}
                    className={`text-xs font-semibold rounded-xl px-3 py-2 border transition ${
                      patientCondition === c.value
                        ? 'bg-emergency-600 border-emergency-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Condition Notes</label>
              <textarea
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="Visible injuries, vitals if measured, etc."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-2 block">Ambulance Staff Notes</label>
              <textarea
                value={ambulanceStaffNotes}
                onChange={(e) => setAmbulanceStaffNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="Anything the hospital should know before arrival."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                <Camera className="h-3.5 w-3.5" /> Accident Photos (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files).slice(0, 5))}
                className="text-xs w-full text-slate-500"
              />
              {photos.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">{photos.length} photo(s) selected.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emergency-600 hover:bg-emergency-700 text-white rounded-xl py-3 text-sm font-bold shadow-sm transition"
            >
              {loading ? 'Creating Case…' : 'Create Emergency Case'}
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: Hospital selection */}
      {step === 2 && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {hospitalsLoading && <p className="text-sm text-slate-400">Searching nearby hospitals…</p>}
            {!hospitalsLoading && hospitals.length === 0 && (
              <p className="text-sm text-slate-400">No approved hospitals found nearby.</p>
            )}
            {hospitals.map((h) => (
              <div
                key={h._id}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <HospitalIcon className="h-4 w-4 text-primary-500" />
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{h.name}</h4>
                    {h.hasTraumaCenter && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        Trauma Center
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{h.address}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{h.distance} km</span>
                    <span className="font-semibold text-primary-600 dark:text-primary-400">ETA {h.eta} min</span>
                    <span className="text-slate-500">ICU: {h.icuBedsAvailable}/{h.icuBedsTotal}</span>
                    <span className="text-slate-500">Emergency Beds: {h.emergencyBedsAvailable}/{h.emergencyBedsTotal}</span>
                    <span className="text-slate-500">General: {h.generalBedsAvailable}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleSelectAndNotify(h._id)}
                  disabled={loading}
                  className="flex-shrink-0 bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {loading && selectedHospitalId === h._id ? 'Notifying…' : 'Select & Notify'}
                </button>
              </div>
            ))}
          </div>
          <div className="h-[420px] lg:h-full rounded-2xl overflow-hidden shadow-md">
            {coords.lat !== null ? (
              <InteractiveMap
                patientLocation={[coords.lat, coords.lng]}
                ambulanceLocation={[coords.lat, coords.lng]}
                patientName="Accident Scene"
                status="pending"
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-2xl">
                <p className="text-sm text-slate-400 animate-pulse">📡 Waiting for GPS location…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: Live transport tracking */}
      {step === 3 && emergencyCase && (
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-260px)]">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emergency-600">
                <Ambulance className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wide">{emergencyCase.status.replace(/_/g, ' ')}</span>
              </div>

              {/* GPS Location Status */}
              <div className={`rounded-xl p-3 flex items-center justify-between gap-2 text-xs ${
                coords.lat !== null ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800'
              }`}>
                <div>
                  <p className={`font-bold ${coords.lat !== null ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {locating ? '📡 Getting your location…' : coords.lat !== null ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '⚠️ Location not detected'}
                  </p>
                  {coords.lat === null && !locating && (
                    <p className="text-amber-600 dark:text-amber-500 mt-0.5">Map shows placeholder until GPS resolves</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => requestLiveGPS(emergencyCase._id)}
                  disabled={locating}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 font-semibold disabled:opacity-50 transition"
                >
                  {locating ? '…' : '🔄 Fix'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                  <span className="block text-[10px] text-slate-400">ETA</span>
                  <span className="font-bold text-sm text-primary-500">{emergencyCase.eta ?? '--'} mins</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                  <span className="block text-[10px] text-slate-400">Distance</span>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{emergencyCase.distance?.toFixed?.(2) ?? '--'} km</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {emergencyCase.status === 'hospital_notified' && (
                  <button
                    onClick={() => handleProgress('enroute_to_hospital')}
                    disabled={loading}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                  >
                    Depart Scene — En Route to Hospital
                  </button>
                )}
                {emergencyCase.status === 'enroute_to_hospital' && (
                  <button
                    onClick={() => handleProgress('arrived_at_hospital')}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
                  >
                    Mark Arrived at Hospital
                  </button>
                )}
                {emergencyCase.status === 'enroute_to_hospital' && (
                  <button
                    type="button"
                    onClick={handleSimulateGPS}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Navigation className="h-3.5 w-3.5 animate-spin" /> Simulate GPS Movement
                  </button>
                )}
                {emergencyCase.status === 'arrived_at_hospital' && (
                  <p className="text-xs text-success-600 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Patient handed off. Hospital will begin treatment.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 h-full rounded-2xl overflow-hidden shadow-md">
            <InteractiveMap
              patientLocation={coords.lat !== null ? [coords.lat, coords.lng] : null}
              hospitalLocation={emergencyCase.hospital ? [emergencyCase.hospital.latitude, emergencyCase.hospital.longitude] : null}
              ambulanceLocation={coords.lat !== null ? [coords.lat, coords.lng] : null}
              hospitalName={emergencyCase.hospital?.name || 'Hospital'}
              status={emergencyCase.status === 'enroute_to_hospital' ? 'enroute_to_hospital' : 'accepted'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateEmergencyCase;
