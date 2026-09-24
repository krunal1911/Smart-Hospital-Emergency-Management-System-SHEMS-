import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Search, MapPin, Phone, ShieldAlert, Heart, Info, Clock, Navigation } from 'lucide-react';

const NearbyHospitals = () => {
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bedTypeFilter, setBedTypeFilter] = useState('');
  const [userLocation, setUserLocation] = useState({ lat: 19.0760, lng: 72.8777 }); // default Mumbai
  const [locationName, setLocationName] = useState('Mumbai, MH (Default)');

  // Booking Modal State
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    patientName: '',
    patientPhone: '',
    pickupAddress: '',
    complaint: '',
    priority: 'medium'
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation({ lat, lng });
          setLocationName(`Your Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        },
        (err) => {
          console.warn('Geolocation failed or permission denied, using default coordinates.');
        }
      );
    }
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/patient/hospitals/nearby', {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          bedType: bedTypeFilter || undefined
        }
      });
      setHospitals(res.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch nearby hospitals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, bedTypeFilter]);

  const handleOpenBooking = (hospital) => {
    setSelectedHospital(hospital);
    setBookingDetails({
      patientName: '',
      patientPhone: '',
      pickupAddress: '',
      complaint: '',
      priority: 'medium'
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHospital) return;
    setBookingLoading(true);
    try {
      const res = await api.post('/api/patient/emergency/book', {
        hospitalId: selectedHospital._id,
        patientName: bookingDetails.patientName,
        patientPhone: bookingDetails.patientPhone,
        pickupAddress: bookingDetails.pickupAddress,
        lat: userLocation.lat,
        lng: userLocation.lng,
        complaint: bookingDetails.complaint,
        priority: bookingDetails.priority
      });
      setSelectedHospital(null);
      // Redirect to live tracking dashboard
      navigate('/patient/track');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book emergency ambulance');
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredHospitals = hospitals.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Nearby Hospitals & Bed Availability</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary-500" />
            Active search center: <span className="font-semibold text-slate-700 dark:text-slate-300">{locationName}</span>
          </p>
        </div>
        <button
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationName(`Refreshed (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
              });
            }
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm hover:bg-slate-50 transition"
        >
          <Navigation className="h-3.5 w-3.5" />
          Update GPS Center
        </button>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Filter and Search Bar */}
      <div className="grid md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search hospitals by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
          />
        </div>
        <div>
          <select
            value={bedTypeFilter}
            onChange={(e) => setBedTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
          >
            <option value="">Filter by Bed Availability (All Types)</option>
            <option value="general">Available General Beds</option>
            <option value="icu">Available ICU Beds</option>
            <option value="oxygen">Available Oxygen Beds</option>
          </select>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-xs text-slate-400">Found {filteredHospitals.length} matching facilities</span>
        </div>
      </div>

      {/* Hospital List / Cards */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : filteredHospitals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
          <Info className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">No Hospitals Found</h3>
          <p className="text-slate-500 text-sm mt-1">Try expanding your search criteria or modifying filters.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredHospitals.map((hospital) => (
            <div
              key={hospital._id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{hospital.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {hospital.address}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400">
                    <Clock className="h-3.5 w-3.5" />
                    {hospital.eta} mins ({hospital.distance.toFixed(1)} km)
                  </span>
                </div>

                {/* Bed Status Indicators */}
                <div className="grid grid-cols-3 gap-3 my-5">
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-center">
                    <span className="block text-xs text-slate-400">General Beds</span>
                    <span className={`block font-bold mt-1 text-sm ${hospital.availableBeds > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {hospital.availableBeds} Available
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-center">
                    <span className="block text-xs text-slate-400">ICU Beds</span>
                    <span className={`block font-bold mt-1 text-sm ${hospital.icuBedsAvailable > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {hospital.icuBedsAvailable} Available
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-center">
                    <span className="block text-xs text-slate-400">Oxygen Beds</span>
                    <span className={`block font-bold mt-1 text-sm ${hospital.oxygenBedsAvailable > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {hospital.oxygenBedsAvailable} Available
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>Reception: {hospital.contact || '--'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Emergency Hotline: {hospital.emergencyContact || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  <span>Rating: ⭐ {hospital.rating?.toFixed(1) || '5.0'}</span>
                </div>
                <button
                  onClick={() => handleOpenBooking(hospital)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5 transition"
                >
                  <Heart className="h-3.5 w-3.5 animate-pulse" />
                  Request Emergency Ambulance
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency Booking Modal */}
      {selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-rose-600 to-red-600 p-6 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-white animate-bounce" />
                Emergency Ambulance Request
              </h2>
              <p className="text-xs text-rose-100 mt-1">
                You are dispatching an emergency ambulance from <span className="font-bold text-white">{selectedHospital.name}</span>.
              </p>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={bookingDetails.patientName}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                    placeholder="Enter patient full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Patient Contact Number</label>
                  <input
                    type="tel"
                    required
                    value={bookingDetails.patientPhone}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, patientPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ambulance Pickup Address</label>
                <textarea
                  required
                  rows="2"
                  value={bookingDetails.pickupAddress}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, pickupAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                  placeholder="Enter detailed pickup address"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Primary Symptom / Complaint</label>
                <input
                  type="text"
                  required
                  value={bookingDetails.complaint}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, complaint: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Chest pain, difficulty breathing, trauma accident"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Emergency Priority</label>
                  <select
                    value={bookingDetails.priority}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500 font-semibold"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High (Critical Life-Threatening)</option>
                  </select>
                </div>
                <div className="text-xs text-slate-400 pl-2">
                  High priority alerts the hospital room immediately.
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedHospital(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {bookingLoading ? 'Requesting...' : 'Dispatch Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyHospitals;
