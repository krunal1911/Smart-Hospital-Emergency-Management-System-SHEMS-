import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['available', 'busy', 'offline'],
      default: 'available',
    },
    currentAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },
    currentLatitude: {
      type: Number,
      required: true,
      default: 19.0760,
    },
    currentLongitude: {
      type: Number,
      required: true,
      default: 72.8777,
    },
  },
  {
    timestamps: true,
  }
);

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;
