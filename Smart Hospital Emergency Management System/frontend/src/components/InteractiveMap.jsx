import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default marker icon crash (importing assets correctly)
import 'leaflet/dist/leaflet.css';

/**
 * RecenterMap - pans the Leaflet map whenever the target lat/lng changes.
 * Uses lat/lng as separate primitive deps so React can correctly detect
 * value changes (avoids the [array] reference-equality trap).
 */
const RecenterMap = ({ lat, lng, zoom }) => {
  const map = useMap();
  const firstRender = useRef(true);

  useEffect(() => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

    if (firstRender.current) {
      // On first mount use setView so the initial center is set correctly
      map.setView([lat, lng], zoom || 13);
      firstRender.current = false;
    } else {
      // On updates, smoothly pan/fly to the new position
      map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 1.2 });
    }
  }, [lat, lng, zoom]); // ← primitives, not array — React detects changes correctly

  return null;
};

// Create custom animated Tailwind markers
const createCustomIcon = (htmlContent, className = '') => {
  return L.divIcon({
    html: htmlContent,
    className: `custom-leaflet-icon ${className}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export const InteractiveMap = ({
  patientLocation, // [lat, lng]
  hospitalLocation, // [lat, lng]
  ambulanceLocation, // [lat, lng]
  patientName = 'Patient',
  hospitalName = 'Hospital',
  ambulanceVehicle = 'Ambulance',
  status = 'pending',
}) => {
  // Check if dark mode is active to toggle tile styles
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // CartoDB Tile Layers (Beautiful slate look for dark mode, voyager for light mode)
  const tileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  // Validate coordinate pairs — must be real numbers
  const validPatient   = patientLocation   && patientLocation[0]   != null && !isNaN(patientLocation[0])   ? patientLocation   : null;
  const validHospital  = hospitalLocation  && hospitalLocation[0]  != null && !isNaN(hospitalLocation[0])  ? hospitalLocation  : null;
  const validAmbulance = ambulanceLocation && ambulanceLocation[0] != null && !isNaN(ambulanceLocation[0]) ? ambulanceLocation : null;

  // Priority: patient > hospital > ambulance > Mumbai default
  // IMPORTANT: patientLocation (the emergency) should ALWAYS win centering priority
  const centerTarget = validPatient || validHospital || validAmbulance || [20.5937, 78.9629]; // centre of India as neutral default

  const initialCenter = centerTarget;

  // Custom marker definitions
  const patientIcon = createCustomIcon(
    `<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white border-3 border-white shadow-2xl" style="animation: ping 1s cubic-bezier(0,0,0.2,1) infinite;">
       <span class="text-base">🆘</span>
     </div>`
  );

  const hospitalIcon = createCustomIcon(
    `<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emergency-600 text-white border-2 border-white shadow-xl">
       <span class="text-sm">🏥</span>
     </div>`
  );

  const ambulanceIcon = createCustomIcon(
    `<div class="flex h-9 w-9 items-center justify-center rounded-full bg-success-600 text-white border-2 border-white shadow-xl animate-bounce">
       <span class="text-sm">🚑</span>
     </div>`
  );

  // Determine active route polylines
  const getPolylinePath = () => {
    if (!validAmbulance) return [];
    
    // Stage: Driver heading to Patient
    if (['accepted', 'driver_assigned', 'enroute_to_patient', 'arrived_at_patient'].includes(status) && validPatient) {
      return [validAmbulance, validPatient];
    }
    // Stage: Driver heading to Hospital
    if (status === 'enroute_to_hospital' && validHospital) {
      return [validAmbulance, validHospital];
    }
    return [];
  };

  const activePath = getPolylinePath();

  // Dotted helper line showing remaining leg
  const getDottedPath = () => {
    if (
      ['accepted', 'driver_assigned', 'enroute_to_patient', 'arrived_at_patient'].includes(status) &&
      validPatient &&
      validHospital
    ) {
      return [validPatient, validHospital];
    }
    return [];
  };

  const dottedPath = getDottedPath();

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
      <MapContainer
        center={initialCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> contributors'
          url={tileUrl}
        />

        {/* Patient Location - 🆘 pulsing red icon */}
        {validPatient && (
          <Marker position={validPatient} icon={patientIcon}>
            <Popup>
              <div className="text-xs font-semibold">
                <p className="text-slate-800 font-bold dark:text-white">{patientName}</p>
                <p className="text-slate-500">Emergency Pickup Location</p>
                <p className="text-slate-400">{validPatient[0].toFixed(5)}, {validPatient[1].toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hospital Location */}
        {validHospital && (
          <Marker position={validHospital} icon={hospitalIcon}>
            <Popup>
              <div className="text-xs font-semibold">
                <p className="text-slate-800 font-bold dark:text-white">{hospitalName}</p>
                <p className="text-slate-500">Admitting Facility</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Ambulance Location */}
        {validAmbulance && (
          <Marker position={validAmbulance} icon={ambulanceIcon}>
            <Popup>
              <div className="text-xs font-semibold">
                <p className="text-slate-800 font-bold dark:text-white">{ambulanceVehicle}</p>
                <p className="text-slate-500">Dispatched Ambulance</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Active travel route line */}
        {activePath.length > 0 && (
          <Polyline positions={activePath} color="#10b981" weight={4} opacity={0.8} dashArray="5, 5" />
        )}

        {/* Dotted target path */}
        {dottedPath.length > 0 && (
          <Polyline positions={dottedPath} color="#ef4444" weight={3} opacity={0.5} dashArray="10, 10" />
        )}

        {/*
          RecenterMap — ALWAYS prioritises the patient/emergency location.
          Passes lat/lng as PRIMITIVE numbers (not an array) so React
          correctly detects when values actually change and flies the map there.
        */}
        <RecenterMap
          lat={centerTarget[0]}
          lng={centerTarget[1]}
          zoom={validPatient ? 13 : 12}
        />
      </MapContainer>
    </div>
  );
};
export default InteractiveMap;
