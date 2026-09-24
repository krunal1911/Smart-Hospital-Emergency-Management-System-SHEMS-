import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);

// Full schemas
const UserSchema = new mongoose.Schema({ name: String, email: String, role: String });
const AmbulanceSchema = new mongoose.Schema({
  vehicleNumber: String, driver: mongoose.Schema.Types.ObjectId,
  status: String, availability: Boolean,
  latitude: Number, longitude: Number,
  location: { type: { type: String }, coordinates: [Number] },
});
const DriverSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId, name: String, phone: String,
  status: String, currentAmbulance: mongoose.Schema.Types.ObjectId,
  currentLatitude: Number, currentLongitude: Number, licenseNumber: String,
});

const User = mongoose.model('User', UserSchema);
const Ambulance = mongoose.model('Ambulance', AmbulanceSchema);
const Driver = mongoose.model('Driver', DriverSchema);

// === 1. Fix driver1's ambulance ===
const user1 = await User.findOne({ email: 'driver1@shems.com' });
const driver1 = await Driver.findOne({ user: user1._id });
console.log('Driver1 currentAmbulance ID:', driver1.currentAmbulance);

// Check if ambulance exists
let amb = await Ambulance.findById(driver1.currentAmbulance);
console.log('Ambulance doc:', amb);

if (!amb) {
  console.log('Creating ambulance for driver1...');
  amb = await Ambulance.create({
    vehicleNumber: 'GJ-06-AM-1001',
    driver: driver1._id,
    status: 'available',
    availability: true,
    latitude: 21.5002,
    longitude: 73.0125,
    location: { type: 'Point', coordinates: [73.0125, 21.5002] },
  });
  driver1.currentAmbulance = amb._id;
  await driver1.save();
  console.log('✅ Created new ambulance GJ-06-AM-1001 for driver1');
} else if (!amb.vehicleNumber) {
  amb.vehicleNumber = 'GJ-06-AM-1001';
  amb.driver = driver1._id;
  amb.status = 'available';
  amb.availability = true;
  await amb.save();
  console.log('✅ Fixed ambulance vehicleNumber for driver1:', amb._id);
} else {
  // Just ensure it's available
  amb.status = 'available';
  amb.availability = true;
  await amb.save();
  console.log('✅ Driver1 ambulance OK:', amb.vehicleNumber);
}

// === 2. Also fix driver2 and driver3 ===
for (const email of ['driver2@shems.com', 'driver3@shems.com']) {
  const u = await User.findOne({ email });
  const d = await Driver.findOne({ user: u?._id });
  if (d) {
    const a = await Ambulance.findById(d.currentAmbulance);
    if (!a) {
      const newAmb = await Ambulance.create({
        vehicleNumber: email === 'driver2@shems.com' ? 'GJ-06-AM-1002' : 'GJ-06-AM-1003',
        driver: d._id, status: 'available', availability: true,
        latitude: 21.5, longitude: 73.0,
        location: { type: 'Point', coordinates: [73.0, 21.5] },
      });
      d.currentAmbulance = newAmb._id;
      await d.save();
      console.log(`✅ Fixed ${email}: created ambulance ${newAmb.vehicleNumber}`);
    } else if (!a.vehicleNumber) {
      a.vehicleNumber = email === 'driver2@shems.com' ? 'GJ-06-AM-1002' : 'GJ-06-AM-1003';
      a.status = 'available';
      a.availability = true;
      await a.save();
      console.log(`✅ Fixed ${email}: vehicleNumber set`);
    } else {
      console.log(`✅ ${email}: ambulance OK (${a.vehicleNumber})`);
    }
    d.status = 'available';
    await d.save();
  }
}

// === 3. Show fresh test cases driver1 can now accept ===
const EmCase = mongoose.model('EmCase', new mongoose.Schema({
  caseNumber: String, status: String, ambulance: mongoose.Schema.Types.ObjectId,
  accidentLatitude: Number, accidentLongitude: Number, accidentAddress: String,
}, { timestamps: true }), 'emergencycases');

const open = await EmCase.find({ ambulance: null, status: 'created' }).sort({ createdAt: -1 }).limit(5);
console.log('\n=== Open cases driver1 can accept ===');
if (open.length === 0) {
  console.log('  No open cases — submit a new SOS from the patient page');
} else {
  open.forEach(c => console.log(`  ✅ ${c.caseNumber} | ${c.accidentAddress || c.accidentLatitude}`));
}

await mongoose.disconnect();
console.log('\nDone! Refresh the driver page and submit a NEW SOS from /emergency');
