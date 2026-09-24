import mongoose from 'mongoose';

const statusLogSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const emergencyRequestSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'pending',
        'accepted',
        'rejected',
        'driver_assigned',
        'enroute_to_patient',
        'arrived_at_patient',
        'enroute_to_hospital',
        'completed',
      ],
      default: 'pending',
    },
    patientName: {
      type: String,
      required: true,
    },
    patientPhone: {
      type: String,
      required: true,
    },
    patientLatitude: {
      type: Number,
      required: true,
    },
    patientLongitude: {
      type: Number,
      required: true,
    },
    pickupAddress: {
      type: String,
      required: true,
    },
    complaint: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
      default: 'medium',
    },
    eta: {
      type: Number, // In minutes
      default: null,
    },
    distance: {
      type: Number, // In kilometers
      default: null,
    },
    logs: [statusLogSchema],
  },
  {
    timestamps: true,
  }
);

// Pre-save to auto-push status change logs
emergencyRequestSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.logs.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

const EmergencyRequest = mongoose.model('EmergencyRequest', emergencyRequestSchema);
export default EmergencyRequest;
