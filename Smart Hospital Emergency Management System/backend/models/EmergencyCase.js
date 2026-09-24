import mongoose from 'mongoose';

const caseLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const identificationSchema = new mongoose.Schema(
  {
    isIdentified: {
      type: Boolean,
      default: false,
    },
    markedUnknown: {
      type: Boolean,
      default: false,
    },
    patientName: { type: String, default: '' },
    patientPhone: { type: String, default: '' },
    approxAge: { type: Number, default: null },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: '',
    },
    address: { type: String, default: '' },
    // Who supplied the identity information
    identifiedByName: { type: String, default: '' },
    identifiedByPhone: { type: String, default: '' },
    identifiedByRelation: {
      type: String,
      enum: ['family', 'friend', 'relative', 'police', 'ambulance_staff', 'bystander', 'other', ''],
      default: '',
    },
    identifiedAt: { type: Date, default: null },
    // Staff member (hospital user) who recorded the identification
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const emergencyCaseSchema = new mongoose.Schema(
  {
    // Human-readable temporary case identifier, e.g. EMG-20260712-4821
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Ambulance staff (driver-role user) who opened the case at the scene.
    // Optional because a case can also be opened by a public bystander with
    // no account at all (see `source` below) — the ambulance is attached
    // later, once one is requested/assigned.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ambulance',
      default: null,
    },

    // Ambulances that have explicitly declined this case — excluded from re-dispatch
    declinedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ambulance',
      },
    ],

    // Where the case originated. 'public' = a patient/bystander used the
    // no-login Emergency Help/SOS flow. 'ambulance_staff' = a logged-in
    // driver opened it from the scene (legacy/staff flow).
    source: {
      type: String,
      enum: ['public', 'ambulance_staff'],
      default: 'ambulance_staff',
    },

    // --- Public/bystander reporter info (optional, never blocks anything) ---
    reporterName: { type: String, default: '' },
    reporterPhone: { type: String, default: '' },
    reporterRelation: {
      type: String,
      enum: ['self', 'family', 'friend', 'bystander', 'police', 'other', ''],
      default: '',
    },

    // Opaque token handed back to the reporter's browser only once, at
    // creation. Required (alongside the caseNumber) to poll case status
    // through the public endpoints, so a stranger can't look up a case by
    // guessing/incrementing case numbers.
    accessToken: {
      type: String,
      default: null,
      select: false,
    },

    // --- Scene capture ---
    accidentLatitude: {
      type: Number,
      required: true,
    },
    accidentLongitude: {
      type: Number,
      required: true,
    },
    accidentAddress: {
      type: String,
      default: '',
    },
    // Optional 6-digit PIN code for the accident location, set when the
    // reporter used "Search by PIN Code" instead of (or alongside) the map.
    // When present, nearby-ambulance/nearby-hospital lookups for this case
    // filter by exact pincode match instead of GPS distance — see
    // publicEmergencyController.js.
    accidentPincode: {
      type: String,
      trim: true,
      default: '',
    },
    accidentTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    patientCondition: {
      type: String,
      required: true,
      enum: [
        'conscious',
        'unconscious',
        'heavy_bleeding',
        'fracture',
        'burns',
        'cardiac_arrest',
        'breathing_difficulty',
        'head_injury',
        'other',
        'unknown', // A panicking bystander may not know/be able to describe the condition
      ],
      default: 'unknown',
    },
    conditionNotes: {
      type: String,
      default: '',
    },
    // --- Clinical Triage Rating ---
    triageCategory: {
      type: String,
      enum: ['CRITICAL', 'URGENT', 'NORMAL'],
      default: 'NORMAL',
    },
    triageScore: {
      type: Number,
      default: 20,
    },
    recommendedBedType: {
      type: String,
      enum: ['icu', 'emergency', 'general'],
      default: 'general',
    },
    photos: {
      type: [String],
      default: [],
    },
    ambulanceStaffNotes: {
      type: String,
      default: '',
    },

    // --- Hospital selection & notification ---
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      default: null,
    },
    distance: { type: Number, default: null }, // km, ambulance -> hospital
    eta: { type: Number, default: null }, // minutes

    // --- Workflow status ---
    status: {
      type: String,
      required: true,
      enum: [
        'created', // Case opened (scene or public SOS), no ambulance/hospital yet
        'ambulance_dispatched', // A public SOS case has been matched to an ambulance
        'hospital_selected', // Ambulance staff picked a hospital
        'hospital_notified', // Hospital has been alerted
        'enroute_to_hospital', // Ambulance moving with patient
        'arrived_at_hospital', // Ambulance reached the hospital
        'in_treatment', // Emergency treatment has begun
        'identified', // Patient identity has been recorded
        'converted', // Case converted into a permanent Patient record
        'closed', // Case closed without conversion (e.g. duplicate/false alarm)
      ],
      default: 'created',
    },
    arrivedAt: { type: Date, default: null },
    treatmentStartedAt: { type: Date, default: null },

    // --- Identification (filled in later, never blocks treatment) ---
    identification: {
      type: identificationSchema,
      default: () => ({}),
    },

    // --- Conversion to permanent record ---
    convertedPatient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
    },
    convertedAt: { type: Date, default: null },
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    logs: [caseLogSchema],
  },
  {
    timestamps: true,
  }
);

// Auto-append a status log entry whenever `status` changes
emergencyCaseSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.logs.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

const EmergencyCase = mongoose.model('EmergencyCase', emergencyCaseSchema);
export default EmergencyCase;
