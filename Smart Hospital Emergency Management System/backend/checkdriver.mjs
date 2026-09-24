import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);

const User = mongoose.model('User', new mongoose.Schema({ name: String, email: String, role: String }));
const Driver = mongoose.model('Driver', new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  name: String,
  status: String,
  currentAmbulance: mongoose.Schema.Types.ObjectId,
  currentLatitude: Number,
  currentLongitude: Number,
  licenseNumber: String,
  phone: String,
}));
const Ambulance = mongoose.model('Ambulance', new mongoose.Schema({
  vehicleNumber: String,
  driver: mongoose.Schema.Types.ObjectId,
  status: String,
  availability: Boolean,
  latitude: Number,
  longitude: Number,
}));

// Check driver1
const user = await User.findOne({ email: 'driver1@shems.com' });
console.log('\n=== driver1@shems.com User ===');
console.log('User ID:', user?._id);

const driver = await Driver.findOne({ user: user?._id }).populate('currentAmbulance');
console.log('\n=== Driver Profile ===');
console.log('Driver ID:', driver?._id);
console.log('Status:', driver?.status);
console.log('Current Ambulance:', driver?.currentAmbulance ? JSON.stringify(driver.currentAmbulance, null, 2) : 'NONE - THIS IS THE PROBLEM!');

// If no ambulance, find any available ambulance and assign it
if (!driver?.currentAmbulance) {
  console.log('\n🔧 No ambulance assigned to driver1 - fixing...');
  
  // Find an ambulance not assigned to anyone, or create one
  let ambulance = await Ambulance.findOne({ driver: null });
  
  if (!ambulance) {
    console.log('Creating new ambulance for driver1...');
    ambulance = await Ambulance.create({
      vehicleNumber: 'GJ-06-AM-1001',
      driver: driver._id,
      status: 'available',
      availability: true,
      latitude: driver.currentLatitude || 21.5,
      longitude: driver.currentLongitude || 72.9,
    });
  } else {
    ambulance.driver = driver._id;
    ambulance.status = 'available';
    ambulance.availability = true;
    await ambulance.save();
  }
  
  driver.currentAmbulance = ambulance._id;
  driver.status = 'available';
  await driver.save();
  
  console.log('✅ Assigned ambulance:', ambulance.vehicleNumber, 'to driver1');
} else {
  console.log('\n✅ Driver1 already has ambulance:', driver.currentAmbulance.vehicleNumber);
}

// Show all recent emergency cases
const EmergencyCase = mongoose.model('EmergencyCase', new mongoose.Schema({
  caseNumber: String,
  status: String,
  ambulance: mongoose.Schema.Types.ObjectId,
  accidentLatitude: Number,
  accidentLongitude: Number,
  accidentAddress: String,
  createdAt: Date,
}, { timestamps: true }));

const recentCases = await EmergencyCase.find({}).sort({ createdAt: -1 }).limit(5);
console.log('\n=== Recent Emergency Cases ===');
recentCases.forEach(c => {
  console.log(`  ${c.caseNumber} | Status: ${c.status} | Ambulance: ${c.ambulance || 'NONE'} | Location: ${c.accidentAddress || c.accidentLatitude}`);
});

await mongoose.disconnect();
