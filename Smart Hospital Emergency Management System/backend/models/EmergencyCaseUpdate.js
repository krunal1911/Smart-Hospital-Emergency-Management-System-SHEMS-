import mongoose from 'mongoose';

const emergencyCaseUpdateSchema = new mongoose.Schema(
  {
    emergencyCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyCase',
      required: true,
      index: true,
    },
    // Optional because updates can also come from an unauthenticated
    // bystander using the public Emergency Help/SOS flow (no User account).
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedByRole: {
      type: String,
      enum: ['driver', 'hospital', 'admin', 'public'],
      required: true,
    },
    type: {
      type: String,
      enum: ['note', 'vitals', 'status', 'identification'],
      default: 'note',
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const EmergencyCaseUpdate = mongoose.model('EmergencyCaseUpdate', emergencyCaseUpdateSchema);
export default EmergencyCaseUpdate;
