import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    // Optional now: a walk-in / emergency-admitted patient created from an
    // EmergencyCase conversion may have no registered login account at all.
    // A sparse unique index means many documents can have `user: null`
    // without violating uniqueness, while still guaranteeing that a
    // registered User is never linked to more than one Patient record.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // True when this record originated from the ambulance/hospital
    // emergency-case workflow rather than patient self-registration.
    isWalkIn: {
      type: Boolean,
      default: false,
    },
    // Link back to the EmergencyCase this record was converted from, if any.
    sourceEmergencyCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyCase',
      default: null,
    },
    fullName: {
      // Used for walk-in patients who have no User account (and therefore
      // no `User.name`) to fall back on. Registered patients keep using
      // `User.name` as the source of truth; this stays blank for them.
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'unknown'],
      default: 'unknown',
    },
    dob: {
      type: Date,
      default: null,
    },
    approxAge: {
      // Used when exact date of birth is unknown for an emergency admission.
      type: Number,
      default: null,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'],
      default: 'unknown',
    },
    address: {
      type: String,
      default: '',
    },
    phone: {
      // Fallback contact number for walk-in patients without a User account.
      type: String,
      default: '',
    },
    emergencyContactName: {
      type: String,
      default: '',
    },
    emergencyContactPhone: {
      type: String,
      default: '',
    },
    latitude: {
      type: Number,
      default: 19.0760, // Default to Mumbai
    },
    longitude: {
      type: Number,
      default: 72.8777,
    },
  },
  {
    timestamps: true,
  }
);

// Sparse unique index: enforces uniqueness only among documents that
// actually have a `user` value, so multiple walk-in (`user: null`)
// records can coexist.
patientSchema.index({ user: 1 }, { unique: true, sparse: true });

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
