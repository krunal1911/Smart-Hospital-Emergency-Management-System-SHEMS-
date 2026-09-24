import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);

const User = mongoose.model('User', new mongoose.Schema({
  name: String, email: String, role: String, isVerified: Boolean, password: String
}));

const users = await User.find({}).select('name email role isVerified');
console.log('\n=== ALL USERS IN DATABASE ===');
users.forEach(u => {
  console.log(`Role: ${u.role.toUpperCase().padEnd(10)} | Email: ${u.email.padEnd(35)} | Name: ${u.name} | Verified: ${u.isVerified}`);
});
console.log(`\nTotal: ${users.length} users`);
await mongoose.disconnect();
