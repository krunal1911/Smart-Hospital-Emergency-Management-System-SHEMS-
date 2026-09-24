import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);

const Ambulance = mongoose.model('Ambulance', new mongoose.Schema({
  vehicleNumber: String, driver: mongoose.Schema.Types.ObjectId,
  status: String, availability: Boolean,
}, { strict: false }));

const Driver = mongoose.model('Driver', new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId, status: String, currentAmbulance: mongoose.Schema.Types.ObjectId,
}, { strict: false }));

const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));

// 1. Reset ALL ambulances to available
const ambResult = await Ambulance.updateMany({}, { $set: { status: 'available', availability: true } });
console.log(`✅ Reset ${ambResult.modifiedCount} ambulances to status: available`);

// 2. Reset all drivers to available
const drvResult = await Driver.updateMany({}, { $set: { status: 'available' } });
console.log(`✅ Reset ${drvResult.modifiedCount} drivers to status: available`);

// 3. Confirm driver1, 2, 3 ambulances
for (const email of ['driver1@shems.com', 'driver2@shems.com', 'driver3@shems.com']) {
  const u = await User.findOne({ email });
  const d = await Driver.findOne({ user: u._id });
  const a = await Ambulance.findById(d?.currentAmbulance);
  console.log(`\n${email}:`);
  console.log(`  Driver status: ${d?.status}`);
  console.log(`  Ambulance: ${a?.vehicleNumber || 'NONE'} | status: ${a?.status} | availability: ${a?.availability}`);
}

await mongoose.disconnect();
console.log('\n✅ All done! Refresh driver page and try accepting again.');
