import mongoose from 'mongoose';

const ambulanceTrackingLogSchema = new mongoose.Schema(
  {
    emergencyCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyCase',
      required: true,
      index: true,
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const AmbulanceTrackingLog = mongoose.model('AmbulanceTrackingLog', ambulanceTrackingLogSchema);
export default AmbulanceTrackingLog;
