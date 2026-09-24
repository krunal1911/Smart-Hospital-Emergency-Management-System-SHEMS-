import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import Driver from '../models/Driver.js';
import Patient from '../models/Patient.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import EmergencyCase from '../models/EmergencyCase.js';
import ActivityLog from '../models/ActivityLog.js';

export const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPatients = await Patient.countDocuments();
    const totalHospitals = await Hospital.countDocuments();
    const approvedHospitals = await Hospital.countDocuments({ isApproved: true });
    const pendingHospitals = await Hospital.countDocuments({ isApproved: false });

    const totalAmbulances = await Ambulance.countDocuments();
    const activeAmbulances = await Ambulance.countDocuments({ status: 'busy' });
    const availableAmbulances = await Ambulance.countDocuments({ status: 'available', availability: true });

    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.countDocuments({ status: { $ne: 'offline' } });

    const totalEmergencies = await EmergencyRequest.countDocuments();
    const activeEmergencies = await EmergencyRequest.countDocuments({
      status: { $nin: ['completed', 'rejected'] },
    });
    const completedEmergencies = await EmergencyRequest.countDocuments({ status: 'completed' });

    // Ambulance-initiated Emergency Case workflow (accident scene intake)
    const totalEmergencyCases = await EmergencyCase.countDocuments();
    const activeEmergencyCases = await EmergencyCase.countDocuments({
      status: { $nin: ['converted', 'closed'] },
    });
    const unknownPatientCases = await EmergencyCase.countDocuments({
      'identification.markedUnknown': true,
      convertedPatient: null,
    });
    const convertedEmergencyCases = await EmergencyCase.countDocuments({ status: 'converted' });

    // Calculate system-wide bed stats
    const bedStats = await Hospital.aggregate([
      {
        $group: {
          _id: null,
          totalGeneral: { $sum: '$totalBeds' },
          availableGeneral: { $sum: '$availableBeds' },
          totalICU: { $sum: '$icuBedsTotal' },
          availableICU: { $sum: '$icuBedsAvailable' },
          totalOxygen: { $sum: '$oxygenBedsTotal' },
          availableOxygen: { $sum: '$oxygenBedsAvailable' },
        },
      },
    ]);

    const bedSummary = bedStats[0] || {
      totalGeneral: 0,
      availableGeneral: 0,
      totalICU: 0,
      availableICU: 0,
      totalOxygen: 0,
      availableOxygen: 0,
    };

    res.status(200).json({
      status: 'success',
      data: {
        users: { total: totalUsers, patients: totalPatients, hospitals: totalHospitals, drivers: totalDrivers },
        hospitals: { total: totalHospitals, approved: approvedHospitals, pending: pendingHospitals },
        ambulances: { total: totalAmbulances, active: activeAmbulances, available: availableAmbulances },
        drivers: { total: totalDrivers, online: onlineDrivers },
        emergencies: { total: totalEmergencies, active: activeEmergencies, completed: completedEmergencies },
        emergencyCases: {
          total: totalEmergencyCases,
          active: activeEmergencyCases,
          unknownPatients: unknownPatientCases,
          converted: convertedEmergencyCases,
        },
        beds: bedSummary,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin stats.', error: error.message });
  }
};

export const getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find().populate('user', 'name email phone');
    res.status(200).json({ status: 'success', data: hospitals });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving hospitals.', error: error.message });
  }
};

export const approveHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    hospital.isApproved = true;
    await hospital.save();

    // Log the approval activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'APPROVE_HOSPITAL',
      details: `Approved hospital: ${hospital.name} (ID: ${hospital._id})`,
    });

    res.status(200).json({
      status: 'success',
      message: 'Hospital approved successfully.',
      data: hospital,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving hospital.', error: error.message });
  }
};

export const getAmbulances = async (req, res) => {
  try {
    const ambulances = await Ambulance.find()
      .populate('driver', 'name phone')
      .populate('hospitalAssigned', 'name');
    res.status(200).json({ status: 'success', data: ambulances });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving ambulances.', error: error.message });
  }
};

export const getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find()
      .populate('user', 'name email phone')
      .populate('currentAmbulance', 'vehicleNumber');
    res.status(200).json({ status: 'success', data: drivers });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving drivers.', error: error.message });
  }
};

export const getPatients = async (req, res) => {
  try {
    const patients = await Patient.find().populate('user', 'name email phone');
    res.status(200).json({ status: 'success', data: patients });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving patients.', error: error.message });
  }
};

export const getActiveRequests = async (req, res) => {
  try {
    // Retrieve non-completed, non-rejected requests for live tracking console
    const activeRequests = await EmergencyRequest.find({
      status: { $nin: ['completed', 'rejected'] },
    })
      .populate('patient', 'name phone')
      .populate('hospital', 'name latitude longitude')
      .populate({
        path: 'ambulance',
        populate: { path: 'driver', select: 'name phone' },
      });

    res.status(200).json({
      status: 'success',
      data: activeRequests,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active requests.', error: error.message });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      status: 'success',
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving audit logs.', error: error.message });
  }
};
