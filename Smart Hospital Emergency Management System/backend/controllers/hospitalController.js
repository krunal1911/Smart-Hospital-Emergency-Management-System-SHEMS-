import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import Driver from '../models/Driver.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import User from '../models/User.js';
import { calculateDistance, calculateETA } from '../utils/distance.js';
import { sendRealtimeNotification, emitToEmergencyRoom } from '../sockets/socketManager.js';

export const getStats = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    // Active emergencies for this hospital
    const activeEmergencies = await EmergencyRequest.countDocuments({
      hospital: hospital._id,
      status: { $in: ['pending', 'accepted', 'driver_assigned', 'enroute_to_patient', 'arrived_at_patient', 'enroute_to_hospital'] },
    });

    // Total completed emergencies
    const completedEmergencies = await EmergencyRequest.countDocuments({
      hospital: hospital._id,
      status: 'completed',
    });

    // Total ambulances
    const totalAmbulances = await Ambulance.countDocuments({ hospitalAssigned: hospital._id });
    const availableAmbulances = await Ambulance.countDocuments({
      hospitalAssigned: hospital._id,
      status: 'available',
      availability: true,
    });

    // Total drivers
    const drivers = await Driver.find().populate({
      path: 'currentAmbulance',
      match: { hospitalAssigned: hospital._id }
    });
    
    // Filter drivers belonging to this hospital's ambulances
    const hospitalDrivers = drivers.filter(d => d.currentAmbulance !== null);
    const totalDrivers = hospitalDrivers.length;
    const activeDrivers = hospitalDrivers.filter(d => d.status === 'available').length;

    res.status(200).json({
      status: 'success',
      data: {
        beds: {
          general: { total: hospital.totalBeds, available: hospital.availableBeds },
          icu: { total: hospital.icuBedsTotal, available: hospital.icuBedsAvailable },
          oxygen: { total: hospital.oxygenBedsTotal, available: hospital.oxygenBedsAvailable },
          emergency: { total: hospital.emergencyBedsTotal, available: hospital.emergencyBedsAvailable },
        },
        hasTraumaCenter: hospital.hasTraumaCenter,
        activeEmergencies,
        completedEmergencies,
        ambulances: { total: totalAmbulances, available: availableAmbulances },
        drivers: { total: totalDrivers, active: activeDrivers },
        doctorsAvailable: hospital.doctorsAvailable,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats.', error: error.message });
  }
};

export const updateBeds = async (req, res) => {
  try {
    const { availableBeds, icuBedsAvailable, oxygenBedsAvailable, totalBeds, icuBedsTotal, oxygenBedsTotal, doctorsAvailable, emergencyBedsTotal, emergencyBedsAvailable, hasTraumaCenter } = req.body;
    const hospital = await Hospital.findOne({ user: req.user._id });
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    if (totalBeds !== undefined) hospital.totalBeds = totalBeds;
    if (availableBeds !== undefined) hospital.availableBeds = availableBeds;
    if (icuBedsTotal !== undefined) hospital.icuBedsTotal = icuBedsTotal;
    if (icuBedsAvailable !== undefined) hospital.icuBedsAvailable = icuBedsAvailable;
    if (oxygenBedsTotal !== undefined) hospital.oxygenBedsTotal = oxygenBedsTotal;
    if (oxygenBedsAvailable !== undefined) hospital.oxygenBedsAvailable = oxygenBedsAvailable;
    if (doctorsAvailable !== undefined) hospital.doctorsAvailable = doctorsAvailable;
    if (emergencyBedsTotal !== undefined) hospital.emergencyBedsTotal = emergencyBedsTotal;
    if (emergencyBedsAvailable !== undefined) hospital.emergencyBedsAvailable = emergencyBedsAvailable;
    if (hasTraumaCenter !== undefined) hospital.hasTraumaCenter = hasTraumaCenter;

    await hospital.save();

    res.status(200).json({
      status: 'success',
      message: 'Beds and stats updated successfully.',
      data: hospital,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating beds.', error: error.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const requests = await EmergencyRequest.find({ hospital: hospital._id })
      .populate('patient', 'name phone')
      .populate({
        path: 'ambulance',
        populate: { path: 'driver', select: 'name phone' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving requests.', error: error.message });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const request = await EmergencyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Emergency request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed.' });
    }

    // Allocate an available ambulance assigned to this hospital
    const availableAmbulance = await Ambulance.findOne({
      hospitalAssigned: hospital._id,
      status: 'available',
      availability: true,
    });

    if (!availableAmbulance) {
      return res.status(400).json({
        message: 'No available ambulances at the moment. Register an ambulance or wait for one to complete its journey.',
      });
    }

    // Assign ambulance and progress request status
    availableAmbulance.status = 'assigned';
    await availableAmbulance.save();

    request.ambulance = availableAmbulance._id;
    request.status = 'accepted'; // Transition to accepted
    
    // Also update driver status
    await Driver.findOneAndUpdate(
      { user: availableAmbulance.driver },
      { status: 'busy' }
    );

    // Calculate distance and ETA from ambulance current location to patient
    request.distance = calculateDistance(
      availableAmbulance.currentLatitude,
      availableAmbulance.currentLongitude,
      request.patientLatitude,
      request.patientLongitude
    );
    request.eta = calculateETA(request.distance);

    await request.save();

    // Trigger real-time notifications via sockets
    // 1. Notify patient
    sendRealtimeNotification(request.patient, {
      title: 'Emergency Request Accepted',
      message: `${hospital.name} has accepted your request. Ambulance (${availableAmbulance.vehicleNumber}) has been assigned.`,
      type: 'emergency',
    }, request.patient.toString());

    // 2. Notify driver
    sendRealtimeNotification(availableAmbulance.driver, {
      title: 'New Emergency Assigned',
      message: `Emergency request assigned. Pick up ${request.patientName} at ${request.pickupAddress}.`,
      type: 'emergency',
    }, availableAmbulance.driver.toString());

    // 3. Broadcast status change in the tracking room
    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status: 'accepted',
      eta: request.eta,
      distance: request.distance,
      ambulance: {
        _id: availableAmbulance._id,
        vehicleNumber: availableAmbulance.vehicleNumber,
        driverContact: availableAmbulance.driverContact,
        currentLatitude: availableAmbulance.currentLatitude,
        currentLongitude: availableAmbulance.currentLongitude,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Request accepted. Ambulance dispatched.',
      data: request,
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Error accepting request.', error: error.message });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await EmergencyRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({ message: 'Emergency request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed.' });
    }

    request.status = 'rejected';
    await request.save();

    // Notify patient of rejection
    sendRealtimeNotification(request.patient, {
      title: 'Emergency Request Declined',
      message: 'The hospital was unable to accept your emergency booking request. Please try another nearby hospital.',
      type: 'alert',
    });

    // Broadcast status change in the tracking room
    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status: 'rejected',
    });

    res.status(200).json({
      status: 'success',
      message: 'Emergency request rejected.',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting request.', error: error.message });
  }
};

// --- AMBULANCE CRUD ---
export const getAmbulances = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    const ambulances = await Ambulance.find({ hospitalAssigned: hospital._id }).populate('driver', 'name phone');
    res.status(200).json({ status: 'success', data: ambulances });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ambulances.', error: error.message });
  }
};

export const createAmbulance = async (req, res) => {
  try {
    const { vehicleNumber, driverId, driverContact } = req.body;
    const hospital = await Hospital.findOne({ user: req.user._id });

    // Verify driver exists and is a driver role
    const driverUser = await User.findOne({ _id: driverId, role: 'driver' });
    if (!driverUser) {
      return res.status(404).json({ message: 'Valid driver user not found.' });
    }

    // Check if driver is already assigned to another ambulance
    const driverAssigned = await Ambulance.findOne({ driver: driverId });
    if (driverAssigned) {
      return res.status(400).json({ message: 'Driver is already assigned to another vehicle.' });
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      driver: driverId,
      driverContact: driverContact || driverUser.phone,
      hospitalAssigned: hospital._id,
      currentLatitude: hospital.latitude,
      currentLongitude: hospital.longitude,
    });

    // Update Driver profile link
    await Driver.findOneAndUpdate(
      { user: driverId },
      { currentAmbulance: ambulance._id, status: 'available' }
    );

    res.status(201).json({ status: 'success', data: ambulance });
  } catch (error) {
    res.status(500).json({ message: 'Error creating ambulance.', error: error.message });
  }
};

export const updateAmbulance = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, driverContact, availability } = req.body;
    
    const ambulance = await Ambulance.findById(id);
    if (!ambulance) return res.status(404).json({ message: 'Ambulance not found.' });

    if (vehicleNumber) ambulance.vehicleNumber = vehicleNumber;
    if (driverContact) ambulance.driverContact = driverContact;
    if (availability !== undefined) ambulance.availability = availability;

    await ambulance.save();
    res.status(200).json({ status: 'success', data: ambulance });
  } catch (error) {
    res.status(500).json({ message: 'Error updating ambulance.', error: error.message });
  }
};

export const deleteAmbulance = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulance = await Ambulance.findByIdAndDelete(id);
    if (!ambulance) return res.status(404).json({ message: 'Ambulance not found.' });

    // Unlink driver profile
    await Driver.findOneAndUpdate(
      { user: ambulance.driver },
      { currentAmbulance: null, status: 'offline' }
    );

    res.status(200).json({ status: 'success', message: 'Ambulance deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting ambulance.', error: error.message });
  }
};

// --- DRIVER CRUD ---
export const getDrivers = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    
    // Find ambulances of this hospital to resolve driver list
    const ambulances = await Ambulance.find({ hospitalAssigned: hospital._id });
    const driverIds = ambulances.map(a => a.driver);

    const drivers = await Driver.find({ user: { $in: driverIds } }).populate('user', 'name email phone');
    res.status(200).json({ status: 'success', data: drivers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching drivers.', error: error.message });
  }
};

export const getUnassignedDrivers = async (req, res) => {
  try {
    // Drivers not assigned to any vehicle
    const drivers = await Driver.find({ currentAmbulance: null }).populate('user', 'name email phone');
    res.status(200).json({ status: 'success', data: drivers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unassigned drivers.', error: error.message });
  }
};

export const getPatientRecords = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    
    // Fetch completed bookings for this hospital (acts as the patient database)
    const bookings = await EmergencyRequest.find({
      hospital: hospital._id,
      status: 'completed',
    })
      .populate('patient', 'name email phone')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: 'success',
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient records.', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, contact, emergencyContact, totalBeds, availableBeds, icuBedsTotal, icuBedsAvailable, oxygenBedsTotal, oxygenBedsAvailable, doctorsAvailable, latitude, longitude } = req.body;

    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (phone) user.phone = phone;
    await user.save();

    const hospital = await Hospital.findOne({ user: req.user._id });
    if (hospital) {
      if (name) hospital.name = name;
      if (address) hospital.address = address;
      if (contact) hospital.contact = contact;
      if (emergencyContact) hospital.emergencyContact = emergencyContact;
      if (totalBeds !== undefined) hospital.totalBeds = totalBeds;
      if (availableBeds !== undefined) hospital.availableBeds = availableBeds;
      if (icuBedsTotal !== undefined) hospital.icuBedsTotal = icuBedsTotal;
      if (icuBedsAvailable !== undefined) hospital.icuBedsAvailable = icuBedsAvailable;
      if (oxygenBedsTotal !== undefined) hospital.oxygenBedsTotal = oxygenBedsTotal;
      if (oxygenBedsAvailable !== undefined) hospital.oxygenBedsAvailable = oxygenBedsAvailable;
      if (doctorsAvailable !== undefined) hospital.doctorsAvailable = doctorsAvailable;
      if (latitude !== undefined) hospital.latitude = latitude;
      if (longitude !== undefined) hospital.longitude = longitude;
      await hospital.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Hospital profile updated successfully.',
      user,
      profile: hospital,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating hospital profile.', error: error.message });
  }
};
