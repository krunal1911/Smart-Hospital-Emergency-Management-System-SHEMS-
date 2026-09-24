// Haversine formula to calculate the distance between two coordinates
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 100) / 100; // Round to 2 decimal places
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

// Calculate Estimated Time of Arrival (ETA) in minutes
export const calculateETA = (distanceKm, averageSpeedKmh = 40) => {
  if (distanceKm <= 0) return 0;
  // Speed is average km/h (e.g. 40 km/h in traffic)
  const timeHours = distanceKm / averageSpeedKmh;
  const timeMinutes = timeHours * 60;
  
  // Add an extra 2-5 minutes of buffer time for boarding/dispatch
  const buffer = Math.floor(Math.random() * 4) + 2; 
  return Math.max(2, Math.round(timeMinutes) + buffer);
};
