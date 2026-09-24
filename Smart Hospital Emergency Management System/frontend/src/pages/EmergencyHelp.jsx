import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import Toast from '../components/Toast';
import {
  AlertTriangle,
  MapPin,
  Ambulance as AmbulanceIcon,
  Hospital as HospitalIcon,
  Phone,
  Clock,
  CheckCircle2,
  Activity,
  ChevronLeft,
  Siren,
  Search,
  Hash,
  AlertCircle,
  Loader2,
  Share2,
} from 'lucide-react';

// Custom pin icon (avoids the broken default-Leaflet-icon-with-bundlers issue
// by using a plain divIcon instead of the default marker PNGs).
const pinIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#dc2626;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Lets the reporter click anywhere on the map to set the exact search
// location — this is what actually drives ambulance/hospital search,
// unlike the old free-text field which did nothing.
const LocationPicker = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const CONDITIONS = [
  { value: 'unconscious', label: 'Unconscious' },
  { value: 'heavy_bleeding', label: 'Heavy Bleeding' },
  { value: 'breathing_difficulty', label: 'Breathing Difficulty' },
  { value: 'cardiac_arrest', label: 'Cardiac Arrest' },
  { value: 'fracture', label: 'Fracture' },
  { value: 'head_injury', label: 'Head Injury' },
  { value: 'burns', label: 'Burns' },
  { value: 'conscious', label: 'Conscious / Alert' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: "I'm not sure" },
];

// Indian PIN codes are 6 digits and never start with 0.
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

// Public Emergency Help / SOS page.
// Reachable from the home page with NO login, NO registration, and NO
// personal information required. Only a location is required to proceed.
const EmergencyHelp = () => {
  const { socket } = useSocket();
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => setToast({ message, type });

  // Backend reachability — checked on load so a dead/unstarted backend shows
  // a clear on-page message instead of buttons silently doing nothing.
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/health')
      .then(() => {
        if (!cancelled) setBackendStatus('online');
      })
      .catch((err) => {
        console.error('[EmergencyHelp] Backend health check failed:', err);
        if (!cancelled) setBackendStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // step: 'intro' | 'ambulance' | 'hospital' | 'done'
  const [step, setStep] = useState('intro');
  const [loading, setLoading] = useState(false);

  // Location
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState(''); // optional text note sent to the hospital
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // PIN code search — a precise alternative to the map/place-name search.
  // Entering a valid 6-digit PIN code and clicking Search shows an exact,
  // pincode-filtered preview of hospitals/ambulances right away, and (if
  // used) carries through to the actual SOS case so the ambulance/hospital
  // steps also filter by that exact PIN code instead of GPS distance.
  const [pincode, setPincode] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeSearching, setPincodeSearching] = useState(false);
  const [pincodeResults, setPincodeResults] = useState(null); // { pincode, hospitals, ambulances, hospitalMessage, ambulanceMessage }

  // Optional details — never required to submit
  const [patientCondition, setPatientCondition] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');

  // Case state
  const [caseData, setCaseData] = useState(null); // { caseNumber, accessToken }
  const [ambulances, setAmbulances] = useState([]);
  const [ambulanceSearchMeta, setAmbulanceSearchMeta] = useState(null); // { radiusKm, message }
  const [requestedAmbulance, setRequestedAmbulance] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalSearchMeta, setHospitalSearchMeta] = useState(null); // { radiusKm, message }
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  // When an ambulance declines — show popup with fresh alternatives
  const [declinedAlert, setDeclinedAlert] = useState(null); // { message, availableAmbulances }

  const pollRef = useRef(null);

  const detectLocation = useCallback(() => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      showToast('Your device does not support automatic location. Please use the search box to enter your location.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        // DO NOT set Mumbai default — coords stays null so user must type location
        // This ensures whatever location they search/enter is what gets sent to ambulance
        showToast('📍 Auto-location failed. Please type your location in the search box and click Search.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  // Turns typed text (e.g. "Valsad" or "Pramukh shivalay abrama valsad") into
  // real coordinates and moves the pin there.
  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const q = searchQuery.trim();

    const tryNominatim = async (url) => {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'SHEMS-Emergency/1.0' } });
        if (!res.ok) return null;
        const results = await res.json();
        if (!results || results.length === 0) return null;
        return results[0];
      } catch { return null; }
    };

    try {
      let result = null;

      // 1. Full query + India
      result = await tryNominatim(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q + ', India')}`
      );

      // 2. Extract city: try last word (usually city name) e.g. "valsad"
      if (!result) {
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length > 1) {
          const cityOnly = words[words.length - 1];
          result = await tryNominatim(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(cityOnly + ', India')}`
          );
          // Try last 2 words
          if (!result && words.length > 2) {
            const lastTwo = words.slice(-2).join(' ');
            result = await tryNominatim(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(lastTwo + ', India')}`
            );
          }
        }
      }

      // 3. Global fallback
      if (!result) {
        result = await tryNominatim(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
        );
      }

      if (!result) {
        showToast(`Could not find "${q}". Try just the city name (e.g. "Valsad") or use the 6-digit PIN code.`, 'error');
        return;
      }

      const { lat, lon, display_name } = result;
      setCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
      setLocationLabel(display_name.split(',').slice(0, 3).join(','));
      showToast(`📍 Location set to ${display_name.split(',').slice(0, 2).join(',')}`, 'success');
    } catch (err) {
      console.error('[EmergencyHelp] Location search failed:', err);
      showToast('Location search failed. Try tapping the map directly.', 'error');
    } finally {
      setSearching(false);
    }
  };


  // Validates as the user types (digits only, max 6) and clears stale
  // results so an old PIN code's results can't be mistaken for the new one.
  const handlePincodeChange = (value) => {
    setPincode(value);
    setPincodeResults(null);
    setPincodeError('');
  };

  const handlePincodeSearch = async () => {
    const query = pincode.trim();
    if (!query) {
      setPincodeError('Enter a city, area, landmark, or 6-digit PIN code.');
      return;
    }
    setPincodeError('');
    setPincodeSearching(true);
    try {
      const res = await api.get('/api/public/emergency/search-by-pincode', { params: { query } });
      const data = res.data.data;
      setPincodeResults(data);

      if (data.resolvedLocation) {
        setCoords({ lat: data.resolvedLocation.lat, lng: data.resolvedLocation.lng });
        setLocationLabel(query);
        showToast(`Found location near "${query}".`, 'success');
      }
    } catch (err) {
      console.error('[EmergencyHelp] Location search failed:', err);
      const errMsg = err.response?.data?.message || 'Could not find this place.';
      showToast(`${errMsg} 💡 Tip: Try typing just the city name (e.g. "Valsad") or the 6-digit PIN code (e.g. 396001).`, 'error');
    } finally {
      setPincodeSearching(false);
    }
  };

  // Poll public status & listen for driver acceptance socket events
  useEffect(() => {
    if (!caseData) return;

    if (socket) {
      socket.emit('join_emergency_case', { caseId: caseData.caseId });

      const onAmbulanceAccepted = (data) => {
        console.log('[EmergencyHelp] Real-time ambulance acceptance received:', data);
        if (data.ambulance) {
          setRequestedAmbulance({
            vehicleNumber: data.ambulance.vehicleNumber,
            driverContact: data.ambulance.driverContact,
            eta: data.ambulance.eta || 5,
          });
          setDeclinedAlert(null); // clear any declined alert
          showToast(`✅ Ambulance ${data.ambulance.vehicleNumber} accepted and is en route!`, 'success');
        }
      };

      const onAmbulanceDeclined = (data) => {
        console.log('[EmergencyHelp] Ambulance declined:', data);
        // Clear previously requested ambulance
        setRequestedAmbulance(null);
        // Show re-selection popup with fresh ambulances
        setDeclinedAlert({
          message: data.message || 'The assigned ambulance is unavailable.',
          availableAmbulances: data.availableAmbulances || [],
        });
        // Refresh ambulance list in background
        if (data.availableAmbulances?.length > 0) {
          setAmbulances(data.availableAmbulances);
        }
        showToast('⚠️ Ambulance declined — please select another from the list below.', 'error');
      };

      socket.on('ambulance_accepted', onAmbulanceAccepted);
      socket.on('ambulance_declined', onAmbulanceDeclined);

      return () => {
        socket.off('ambulance_accepted', onAmbulanceAccepted);
        socket.off('ambulance_declined', onAmbulanceDeclined);
        socket.emit('leave_emergency_case', { caseId: caseData.caseId });
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }

    const poll = async () => {
      try {
        const res = await api.get(`/api/public/emergency/${caseData.caseNumber}/status`, {
          params: { token: caseData.accessToken },
        });
        setLiveStatus(res.data.data);
      } catch (err) {
        // silent — keep last known status
      }
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [caseData, socket]);

  // --- Step 1: Raise SOS ---
  const handleRaiseSOS = async () => {
    if (!coords) {
      showToast('Please allow location access, or wait a moment while we detect it.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/public/emergency/sos', {
        lat: coords.lat,
        lng: coords.lng,
        accidentAddress: locationLabel,
        patientCondition: patientCondition || 'unknown',
        reporterName,
        reporterPhone,
        pincode: PINCODE_REGEX.test(pincode) ? pincode : undefined,
      });
      const data = res.data.data;
      setCaseData(data);
      showToast(`Emergency case ${data.caseNumber} created. Finding ambulances...`, 'success');
      setStep('ambulance');
      await loadAmbulances(data);
    } catch (err) {
      console.error('[EmergencyHelp] SOS creation failed:', err);
      const statusPart = err.response?.status ? ` (HTTP ${err.response.status})` : err.request ? ' (no response from server)' : '';
      showToast((err.response?.data?.message || 'Could not create the emergency case. Please try again.') + statusPart, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAmbulances = async (data) => {
    try {
      const res = await api.get(`/api/public/emergency/${data.caseNumber}/ambulances`, {
        params: { token: data.accessToken },
      });
      setAmbulances(res.data.data);
      setAmbulanceSearchMeta({ radiusKm: res.data.searchRadiusKm, message: res.data.message });
    } catch (err) {
      console.error('[EmergencyHelp] Loading nearby ambulances failed:', err);
      showToast('Could not load nearby ambulances.', 'error');
    }
  };

  // --- Step 2: Request ambulance ---
  const handleRequestAmbulance = async (ambulanceId) => {
    setLoading(true);
    try {
      const res = await api.post(
        `/api/public/emergency/${caseData.caseNumber}/request-ambulance`,
        { ambulanceId },
        { params: { token: caseData.accessToken } }
      );
      setRequestedAmbulance(res.data.data.ambulance);
      showToast('Ambulance requested and on the way!', 'success');
      setStep('hospital');
      await loadHospitals();
    } catch (err) {
      console.error('[EmergencyHelp] Requesting ambulance failed:', err);
      showToast(err.response?.data?.message || 'Could not request this ambulance. It may no longer be available.', 'error');
      await loadAmbulances(caseData);
    } finally {
      setLoading(false);
    }
  };

  const loadHospitals = async () => {
    try {
      const res = await api.get(`/api/public/emergency/${caseData.caseNumber}/hospitals`, {
        params: { token: caseData.accessToken },
      });
      setHospitals(res.data.data);
      setHospitalSearchMeta({ radiusKm: res.data.searchRadiusKm, message: res.data.message });
    } catch (err) {
      console.error('[EmergencyHelp] Loading nearby hospitals failed:', err);
      showToast('Could not load nearby hospitals.', 'error');
    }
  };

  // --- Step 3: Select + notify hospital ---
  const handleSelectHospital = async (hospitalId, hospitalName) => {
    setLoading(true);
    try {
      const res = await api.post(
        `/api/public/emergency/${caseData.caseNumber}/select-hospital`,
        { hospitalId },
        { params: { token: caseData.accessToken } }
      );
      setSelectedHospital(res.data.data);
      showToast(`${hospitalName} has been notified. They are preparing for arrival.`, 'success');
      setStep('done');
    } catch (err) {
      console.error('[EmergencyHelp] Selecting/notifying hospital failed:', err);
      showToast(err.response?.data?.message || 'Could not notify this hospital.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4 sm:pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition">
          <ChevronLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-2">
          <Siren className="h-7 sm:h-8 w-7 sm:w-8 text-emergency-500 animate-pulse" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Emergency Help</h1>
        </div>
        <p className="text-sm sm:text-base text-slate-400 mb-6 sm:mb-8">No login. No registration. No payment. Get help now — details can be given later.</p>

        {backendStatus === 'offline' && (
          <div className="mb-6 rounded-xl border border-emergency-600/40 bg-emergency-600/10 px-4 py-3 text-sm text-emergency-400">
            <p className="font-bold">Can't reach the server.</p>
            <p className="mt-1 text-emergency-300/90">
              The backend at this address isn't responding. Check that it's running (look for
              "Smart Hospital EMS is running on port 5000" in its terminal), then reload this page.
              If it just started, it may still be downloading its database — wait a minute and reload.
            </p>
          </div>
        )}

        {/* STEP: intro */}
        {step === 'intro' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary-400" />
              {locating && <span className="text-slate-400">Detecting your location…</span>}
              {!locating && coords && (
                <span className="text-slate-300">
                  {locationLabel || `Location detected (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`}
                </span>
              )}
              {!locating && !coords && <span className="text-slate-400">Location unavailable — search or tap the map below.</span>}
            </div>

            {/* Map Container */}
              {coords && (
                <div className="h-56 w-full overflow-hidden rounded-xl border border-slate-700">
                  <MapContainer center={[coords.lat, coords.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; OpenStreetMap &copy; CARTO'
                    />
                    <Marker
                      position={[coords.lat, coords.lng]}
                      icon={pinIcon}
                      draggable
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          setCoords({ lat, lng });
                          setLocationLabel('');
                        },
                      }}
                    />
                    <LocationPicker
                      onPick={(p) => {
                        setCoords(p);
                        setLocationLabel('');
                      }}
                    />
                  </MapContainer>
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-1">Tap anywhere on the map, or drag the pin, to set the exact location.</p>

            {/* Location Selection & Search */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary-400" /> Set Emergency Location
                </p>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  className="rounded-lg bg-primary-600/30 hover:bg-primary-600/50 text-primary-300 border border-primary-500/40 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5"
                >
                  {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                  {locating ? 'Detecting GPS…' : 'Use My Live GPS Location'}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Enter city, area, landmark, or 6-digit PIN (e.g. Valsad, Bandra, 396002)"
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handlePincodeSearch())}
                  className={`flex-1 rounded-xl bg-slate-800 border px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                    pincodeError ? 'border-emergency-600 focus:ring-emergency-500' : 'border-slate-700 focus:ring-primary-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handlePincodeSearch}
                  disabled={pincodeSearching || !pincode.trim()}
                  className="rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 flex items-center justify-center gap-1.5 text-xs font-bold transition"
                >
                  {pincodeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>
              {pincodeError && (
                <p className="text-[11px] text-emergency-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {pincodeError}
                </p>
              )}

              {pincodeResults && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <HospitalIcon className="h-3.5 w-3.5" /> Hospitals near PIN {pincodeResults.pincode}
                      </span>
                      {pincodeResults.hospitals.length > 0 && (
                        <span className="font-normal text-slate-500">within {pincodeResults.hospitalSearchRadiusKm} km</span>
                      )}
                    </p>
                    {pincodeResults.hospitals.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">{pincodeResults.hospitalMessage || 'No hospitals found for this PIN code.'}</p>
                    ) : (
                      <div className="space-y-2.5">
                        {pincodeResults.hospitals.map((h) => (
                          <div
                            key={h._id}
                            className="rounded-xl border border-slate-700/60 bg-slate-800/80 p-3 text-xs hover:border-primary-500/80 transition cursor-pointer group"
                            onClick={() => {
                              if (h.lat && h.lng) {
                                setCoords({ lat: h.lat, lng: h.lng });
                                setLocationLabel(`Near ${h.name}`);
                                showToast(`Selected location near ${h.name}.`, 'info');
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-100 group-hover:text-primary-300 transition text-sm">{h.name}</p>
                                <p className="text-slate-400 mt-0.5">{h.address || 'Address available via map'}</p>
                                {h.contact && <p className="text-slate-400 mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /> {h.contact}</p>}
                                {h.source === 'database' && h.generalBedsAvailable != null && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                    {h.generalBedsAvailable} general beds · {h.emergencyBedsAvailable || 0} ER beds
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="inline-block font-extrabold text-primary-400 bg-primary-950/60 px-2 py-1 rounded-lg border border-primary-800/50">
                                  {h.distance} km
                                </span>
                                <p className="text-slate-400 text-[11px] mt-1">~{h.eta} min</p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-700/50" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={h.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 font-bold text-xs"
                              >
                                <MapPin className="h-3.5 w-3.5" /> Open Directions
                              </a>

                              <button
                                type="button"
                                onClick={() => {
                                  if (h.lat && h.lng) {
                                    setCoords({ lat: h.lat, lng: h.lng });
                                    setLocationLabel(`Near ${h.name}`);
                                    handleRaiseSOS();
                                  } else {
                                    handleRaiseSOS();
                                  }
                                }}
                                className="rounded-lg bg-emergency-600 hover:bg-emergency-700 text-white px-3 py-1.5 font-bold text-xs flex items-center gap-1 transition shadow-md"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" /> Get SOS Help Here
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <AmbulanceIcon className="h-3.5 w-3.5" /> Ambulances near PIN {pincodeResults.pincode}
                      </span>
                      {pincodeResults.ambulances.length > 0 && (
                        <span className="font-normal text-slate-500">within {pincodeResults.ambulanceSearchRadiusKm} km</span>
                      )}
                    </p>
                    {pincodeResults.ambulances.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">{pincodeResults.ambulanceMessage || 'No ambulances found for this PIN code.'}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pincodeResults.ambulances.map((a) => (
                          <div key={a._id} className="rounded-lg bg-slate-800/60 px-3 py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold">{a.vehicleNumber}</span>
                              <span className="text-slate-400 ml-2">{a.baseHospital || 'Independent unit'}</span>
                            </div>
                            <span className="text-slate-400">{a.distance} km · ~{a.eta} min</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-primary-400/80">
                    Map location set to PIN {pincodeResults.pincode}. Click "Get Emergency Help Now" below to raise the alarm from here.
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Patient condition (optional — skip if unsure)</p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPatientCondition(c.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                      patientCondition === c.value
                        ? 'bg-emergency-600 border-emergency-600 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Your phone (optional, for callback)"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              onClick={handleRaiseSOS}
              disabled={loading || locating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emergency-600 hover:bg-emergency-700 disabled:opacity-60 px-6 py-4 text-base font-bold text-white shadow-lg transition"
            >
              <AlertTriangle className="h-5 w-5" />
              {loading ? 'Sending SOS…' : 'Get Emergency Help Now'}
            </button>
          </div>
        )}

        {/* STEP: ambulance */}
        {step === 'ambulance' && (
          <div className="space-y-4">
            <CaseBanner caseData={caseData} />

            {/* Ambulance Declined Alert — shown when driver clicks Decline */}
            {declinedAlert && (
              <div className="rounded-2xl border-2 border-amber-500/70 bg-amber-950/50 p-4 space-y-3 animate-pulse-once">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-extrabold text-amber-300 text-sm">Ambulance Unavailable</p>
                      <p className="text-xs text-amber-200/80 mt-0.5">{declinedAlert.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeclinedAlert(null)}
                    className="text-amber-400 hover:text-amber-300 text-lg font-bold shrink-0"
                  >✕</button>
                </div>
                <p className="text-xs text-amber-300/70 font-semibold">
                  👇 Please select another ambulance from the list below.
                  {declinedAlert.availableAmbulances?.length > 0
                    ? ` ${declinedAlert.availableAmbulances.length} ambulance(s) available nearby.`
                    : ' Searching for alternatives...'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AmbulanceIcon className="h-5 w-5 text-primary-400" /> Nearby Ambulances
              </h2>
              <button
                type="button"
                onClick={async () => {
                  setStep('hospital');
                  await loadHospitals();
                }}
                className="text-xs font-bold text-primary-400 hover:text-primary-300 underline transition"
              >
                Skip Ambulance & View Hospitals →
              </button>
            </div>

            {ambulances.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  {ambulanceSearchMeta?.message || `No registered ambulances found within ${ambulanceSearchMeta?.radiusKm || 50} km.`}
                </p>
                <p className="text-xs text-slate-500">
                  You can proceed directly to select a nearby hospital and notify their emergency doctors.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setStep('hospital');
                    await loadHospitals();
                  }}
                  className="rounded-xl bg-emergency-600 hover:bg-emergency-700 text-white font-bold px-6 py-3 text-xs shadow-lg transition"
                >
                  <HospitalIcon className="h-4 w-4 inline mr-1.5" />
                  Proceed to Select & Notify Nearby Hospitals
                </button>
              </div>
            )}
            <div className="space-y-3">
              {ambulances.map((a) => (
                <div key={a._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">{a.vehicleNumber}</p>
                    <p className="text-xs text-slate-400">{a.baseHospital || 'Independent unit'}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {a.driverContact}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{a.distance} km · ETA {a.eta} min</p>
                    <button
                      onClick={() => handleRequestAmbulance(a._id)}
                      disabled={loading}
                      className="mt-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 px-4 py-2 text-xs font-bold text-white transition"
                    >
                      Request This Ambulance
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {ambulances.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  setStep('hospital');
                  await loadHospitals();
                }}
                className="w-full rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold px-4 py-3 text-xs transition text-center"
              >
                Skip Ambulance Step & Select Nearby Hospital Directly →
              </button>
            )}
          </div>
        )}

        {/* STEP: hospital */}
        {step === 'hospital' && (
          <div className="space-y-4">
            <CaseBanner caseData={caseData} />
            {requestedAmbulance && (
              <div className="rounded-xl border border-success-600/30 bg-success-500/10 p-4 text-sm text-success-400">
                Ambulance {requestedAmbulance.vehicleNumber} is on the way — ETA {requestedAmbulance.eta} min.
              </div>
            )}
            <h2 className="text-lg font-bold flex items-center gap-2">
              <HospitalIcon className="h-5 w-5 text-primary-400" /> Nearby Hospitals & Bed Availability
            </h2>
            {hospitals.length === 0 && (
              <p className="text-sm text-slate-400">
                {hospitalSearchMeta?.message || `No hospitals found within ${hospitalSearchMeta?.radiusKm || 50} km. Please call your local emergency number.`}
              </p>
            )}
            <div className="space-y-3">
              {hospitals.map((h) => (
                <div key={h._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{h.name}</p>
                      <p className="text-xs text-slate-400">{h.address}</p>
                      {h.contact && <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {h.contact}</p>}
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap">{h.distance} km · ETA {h.eta} min</p>
                  </div>
                  {h.source === 'database' ? (
                    <>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <BedStat label="Emergency" value={`${h.emergencyBedsAvailable}/${h.emergencyBedsTotal}`} />
                        <BedStat label="ICU" value={`${h.icuBedsAvailable}/${h.icuBedsTotal}`} />
                        <BedStat label="General" value={h.generalBedsAvailable} />
                        <BedStat label="Trauma Center" value={h.hasTraumaCenter ? 'Yes' : 'No'} />
                      </div>
                      <button
                        onClick={() => handleSelectHospital(h._id, h.name)}
                        disabled={loading || (h.emergencyBedsAvailable <= 0 && h.icuBedsAvailable <= 0 && h.generalBedsAvailable <= 0)}
                        className="mt-3 w-full rounded-lg bg-emergency-600 hover:bg-emergency-700 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white transition"
                      >
                        Select & Notify This Hospital
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-[11px] text-slate-500 italic">
                        Not registered on this platform — bed availability unavailable. Call ahead or get directions.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {h.contact && (
                          <a
                            href={`tel:${h.contact}`}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white transition"
                          >
                            <Phone className="h-3.5 w-3.5" /> Call
                          </a>
                        )}
                        <a
                          href={h.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-xs font-bold text-white transition ${!h.contact ? 'col-span-2' : ''}`}
                        >
                          <MapPin className="h-3.5 w-3.5" /> Directions
                        </a>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-success-600/30 bg-success-500/10 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-400 mx-auto mb-2" />
              <p className="font-bold text-lg">Hospital notified — help is on the way.</p>
              <p className="text-sm text-slate-300 mt-1">Doctors are preparing before you even arrive.</p>
            </div>
            <CaseBanner caseData={caseData} />
            {liveStatus && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2 text-sm">
                <p className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary-400" /> Status: <span className="font-semibold">{liveStatus.status?.replace(/_/g, ' ')}</span></p>
                {liveStatus.hospital && <p>Hospital: {liveStatus.hospital.name} ({liveStatus.hospital.emergencyContact || liveStatus.hospital.contact})</p>}
                {liveStatus.ambulance && <p>Ambulance: {liveStatus.ambulance.vehicleNumber} — {liveStatus.ambulance.driverContact}</p>}
                {liveStatus.eta != null && <p className="flex items-center gap-1"><Clock className="h-4 w-4" /> ETA: {liveStatus.eta} min</p>}
              </div>
            )}
            <p className="text-xs text-slate-500 text-center">
              Treatment will begin immediately on arrival — no registration or payment is required first. Patient details can be given by any family member, friend, or the ambulance/police staff whenever ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const CaseBanner = ({ caseData, onShare }) => {
  const category = caseData?.triageCategory || 'NORMAL';
  const badgeColors = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse',
    URGENT: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    NORMAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span>Emergency Case ID:</span>
        <span className="font-mono font-bold text-slate-100 text-sm">{caseData?.caseNumber}</span>
        {caseData?.triageCategory && (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeColors[category] || badgeColors.NORMAL}`}>
            Triage: {category}
          </span>
        )}
      </div>

      {onShare && (
        <button
          onClick={onShare}
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
        >
          <Share2 className="h-3.5 w-3.5" /> Share Status Link
        </button>
      )}
    </div>
  );
};

const BedStat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-800/60 px-2 py-1.5 text-center">
    <p className="text-slate-500">{label}</p>
    <p className="font-bold text-slate-100">{value}</p>
  </div>
);

export default EmergencyHelp;
