import mongoose from 'mongoose';

const hospitalNotificationSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    emergencyCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyCase',
      required: true,
    },
    patientCondition: {
      type: String,
      required: true,
    },
    eta: { type: Number, default: null },
    distance: { type: Number, default: null },
    ambulanceLatitude: { type: Number, default: null },
    ambulanceLongitude: { type: Number, default: null },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const HospitalNotification = mongoose.model('HospitalNotification', hospitalNotificationSchema);
export default HospitalNotification;
