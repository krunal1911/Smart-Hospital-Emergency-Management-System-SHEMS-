import Hospital from '../models/Hospital.js';
import Patient from '../models/Patient.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import User from '../models/User.js';
import { calculateDistance, calculateETA } from '../utils/distance.js';
import { emitToHospital } from '../sockets/socketManager.js';
import { findDbHospitalsNear } from '../utils/geoSearch.js';

export const searchHospitals = async (req, res) => {
  try {
    const { lat, lng, bedType, limit = 10, page = 1 } = req.query;
    
    let userLat = parseFloat(lat);
    let userLng = parseFloat(lng);

    // Fallback to patient profile coordinates if query coordinates not provided
    if (!userLat || !userLng) {
      const patient = await Patient.findOne({ user: req.user._id });
      if (patient) {
        userLat = patient.latitude;
        userLng = patient.longitude;
      } else {
        userLat = 19.0760; // default Mumbai
        userLng = 72.8777;
      }
    }

    // Geospatial search, expanding radius (5 -> 10 -> 20 -> 50 km) until
    // results are found — see utils/geoSearch.js.
    const { hospitals, radiusKm } = await findDbHospitalsNear(userLat, userLng);

    // Calculate distance and map properties
    let hospitalList = hospitals.map((h) => {
      const dist = calculateDistance(userLat, userLng, h.latitude, h.longitude);
      const eta = calculateETA(dist);
      return {
        _id: h._id,
        name: h.name,
        address: h.address,
        contact: h.contact,
        emergencyContact: h.emergencyContact,
        totalBeds: h.totalBeds,
        availableBeds: h.availableBeds,
        icuBedsTotal: h.icuBedsTotal,
        icuBedsAvailable: h.icuBedsAvailable,
        oxygenBedsTotal: h.oxygenBedsTotal,
        oxygenBedsAvailable: h.oxygenBedsAvailable,
        doctorsAvailable: h.doctorsAvailable,
        rating: h.rating,
        images: h.images,
        latitude: h.latitude,
        longitude: h.longitude,
        distance: dist, // in km
        eta, // in minutes
      };
    });

    // Apply bed type filtering if requested
    if (bedType) {
      if (bedType === 'general') {
        hospitalList = hospitalList.filter((h) => h.availableBeds > 0);
      } else if (bedType === 'icu') {
        hospitalList = hospitalList.filter((h) => h.icuBedsAvailable > 0);
      } else if (bedType === 'oxygen') {
        hospitalList = hospitalList.filter((h) => h.oxygenBedsAvailable > 0);
      }
    }

    // Sort by distance (proximity)
    hospitalList.sort((a, b) => a.distance - b.distance);

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedHospitals = hospitalList.slice(startIndex, startIndex + parseInt(limit));

    res.status(200).json({
      status: 'success',
      results: hospitalList.length,
      page: parseInt(page),
      totalPages: Math.ceil(hospitalList.length / limit),
      searchRadiusKm: radiusKm,
      data: paginatedHospitals,
    });
  } catch (error) {
    console.error('Error searching hospitals:', error);
    res.status(500).json({ message: 'Error searching hospitals.', error: error.message });
  }
};

export const getHospitalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id).populate('user', 'name email phone');
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }
    res.status(200).json({ status: 'success', data: hospital });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hospital details.', error: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const { hospitalId, patientName, patientPhone, pickupAddress, lat, lng, complaint, priority } = req.body;

    const patientLat = parseFloat(lat);
    const patientLng = parseFloat(lng);

    if (!hospitalId || !patientName || !patientPhone || !pickupAddress || isNaN(patientLat) || isNaN(patientLng) || !complaint) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    // Check if the hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    // Check if patient already has an active request
    const activeRequest = await EmergencyRequest.findOne({
      patient: req.user._id,
      status: { $nin: ['completed', 'rejected'] },
    });
    if (activeRequest) {
      return res.status(400).json({
        message: 'You already have an active emergency booking request.',
        activeBookingId: activeRequest._id,
      });
    }

    // Calculate distance and initial ETA
    const dist = calculateDistance(patientLat, patientLng, hospital.latitude, hospital.longitude);
    const eta = calculateETA(dist);

    const booking = await EmergencyRequest.create({
      patient: req.user._id,
      hospital: hospitalId,
      status: 'pending',
      patientName,
      patientPhone,
      patientLatitude: patientLat,
      patientLongitude: patientLng,
      pickupAddress,
      complaint,
      priority: priority || 'medium',
      distance: dist,
      eta: eta,
    });

    // Emit socket booking alert
    emitToHospital(hospitalId, 'new_emergency_request', booking);

    res.status(201).json({
      status: 'success',
      message: 'Emergency request created. Awaiting hospital acceptance.',
      data: booking,
    });
  } catch (error) {
    console.error('Error creating emergency booking:', error);
    res.status(500).json({ message: 'Error booking emergency ambulance.', error: error.message });
  }
};

export const getActiveBooking = async (req, res) => {
  try {
    const booking = await EmergencyRequest.findOne({
      patient: req.user._id,
      status: { $nin: ['completed', 'rejected'] },
    })
      .populate('hospital')
      .populate({
        path: 'ambulance',
        populate: { path: 'driver', select: 'name phone' },
      });

    res.status(200).json({
      status: 'success',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving active booking.', error: error.message });
  }
};

export const getBookingHistory = async (req, res) => {
  try {
    const history = await EmergencyRequest.find({
      patient: req.user._id,
    })
      .populate('hospital', 'name address contact')
      .populate('ambulance', 'vehicleNumber driverContact')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving emergency history.', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, gender, dob, bloodGroup, address, emergencyContactName, emergencyContactPhone, latitude, longitude } = req.body;

    // Update User account info
    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (phone) user.phone = phone;
    await user.save();

    // Update Patient profile info
    const patient = await Patient.findOne({ user: req.user._id });
    if (patient) {
      if (gender) patient.gender = gender;
      if (dob) patient.dob = dob;
      if (bloodGroup) patient.bloodGroup = bloodGroup;
      if (address) patient.address = address;
      if (emergencyContactName) patient.emergencyContactName = emergencyContactName;
      if (emergencyContactPhone) patient.emergencyContactPhone = emergencyContactPhone;
      if (latitude !== undefined) patient.latitude = latitude;
      if (longitude !== undefined) patient.longitude = longitude;
      await patient.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      user,
      profile: patient,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile.', error: error.message });
  }
};
