import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);

const User = mongoose.model('User', new mongoose.Schema({
  name: String, email: String, role: String, password: String, isVerified: Boolean
}));

const newPassword = 'Driver@1234';
const hashed = await bcrypt.hash(newPassword, 12);

// Reset ALL driver passwords
const result = await User.updateMany(
  { role: 'driver' },
  { $set: { password: hashed, isVerified: true } }
);

console.log(`\n✅ Reset password for ${result.modifiedCount} driver accounts`);
console.log(`New password for ALL drivers: ${newPassword}`);

// Show all driver emails
const drivers = await User.find({ role: 'driver' }).select('email name');
console.log('\nDriver accounts:');
drivers.forEach(d => console.log(`  📧 ${d.email}  |  ${d.name}`));

await mongoose.disconnect();
