import mongoose from 'mongoose';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import Driver from '../models/Driver.js';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    console.log('Seeding database...');

    // Clear existing data
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Hospital.deleteMany({});
    await Ambulance.deleteMany({});
    await Driver.deleteMany({});

    console.log('Existing collections cleared.');

    // 1. Admin
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@shems.com',
      password: 'adminpassword123',
      role: 'admin',
      phone: '+919999988888',
      isVerified: true,
    });
    console.log('Admin user created.');

    // 2. Patients
    const patientUser1 = await User.create({
      name: 'John Doe',
      email: 'patient@shems.com',
      password: 'patientpassword123',
      role: 'patient',
      phone: '+919876543210',
      isVerified: true,
    });

    await Patient.create({
      user: patientUser1._id,
      gender: 'male',
      dob: new Date('1990-05-15'),
      bloodGroup: 'O+',
      address: 'Bandra West, Mumbai, MH, India',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+919876543211',
      latitude: 19.0596,
      longitude: 72.8295,
    });

    const patientUser2 = await User.create({
      name: 'Alice Smith',
      email: 'alice@shems.com',
      password: 'patientpassword123',
      role: 'patient',
      phone: '+919876543212',
      isVerified: true,
    });

    await Patient.create({
      user: patientUser2._id,
      gender: 'female',
      dob: new Date('1995-10-22'),
      bloodGroup: 'A-',
      address: 'Andheri East, Mumbai, MH, India',
      emergencyContactName: 'Bob Smith',
      emergencyContactPhone: '+919876543213',
      latitude: 19.1136,
      longitude: 72.8697,
    });

    console.log('Patient users & profiles created.');

    // 3. Hospitals
    // Hospital 1: City Emergency Hospital
    const hUser1 = await User.create({
      name: 'City Emergency Hospital',
      email: 'hospital1@shems.com',
      password: 'hospitalpassword123',
      role: 'hospital',
      phone: '+912211112222',
      isVerified: true,
    });

    const hospital1 = await Hospital.create({
      user: hUser1._id,
      name: 'City Emergency Hospital',
      address: 'SVT Road, Santacruz West, Mumbai',
      contact: '+912211112222',
      emergencyContact: '+912211113333',
      totalBeds: 120,
      availableBeds: 45,
      icuBedsTotal: 20,
      icuBedsAvailable: 8,
      oxygenBedsTotal: 30,
      oxygenBedsAvailable: 12,
      doctorsAvailable: 15,
      rating: 4.8,
      latitude: 19.0820,
      longitude: 72.8360,
      isApproved: true,
      pincode: '400054',
      images: ['https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&auto=format&fit=crop'],
    });

    // Hospital 2: Metro General Clinic
    const hUser2 = await User.create({
      name: 'Metro General Clinic',
      email: 'hospital2@shems.com',
      password: 'hospitalpassword123',
      role: 'hospital',
      phone: '+912244445555',
      isVerified: true,
    });

    const hospital2 = await Hospital.create({
      user: hUser2._id,
      name: 'Metro General Clinic',
      address: 'LBS Marg, Kurla West, Mumbai',
      contact: '+912244445555',
      emergencyContact: '+912244446666',
      totalBeds: 80,
      availableBeds: 18,
      icuBedsTotal: 10,
      icuBedsAvailable: 2,
      oxygenBedsTotal: 15,
      oxygenBedsAvailable: 4,
      doctorsAvailable: 6,
      rating: 4.2,
      latitude: 19.0730,
      longitude: 72.8820,
      isApproved: true,
      pincode: '400070',
      images: ['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&auto=format&fit=crop'],
    });

    // Hospital 3: St. Mary Trauma Center
    const hUser3 = await User.create({
      name: 'St. Mary Trauma Center',
      email: 'hospital3@shems.com',
      password: 'hospitalpassword123',
      role: 'hospital',
      phone: '+912277778888',
      isVerified: true,
    });

    const hospital3 = await Hospital.create({
      user: hUser3._id,
      name: 'St. Mary Trauma Center',
      address: 'Linking Road, Bandra West, Mumbai',
      contact: '+912277778888',
      emergencyContact: '+912277779999',
      totalBeds: 150,
      availableBeds: 60,
      icuBedsTotal: 30,
      icuBedsAvailable: 15,
      oxygenBedsTotal: 40,
      oxygenBedsAvailable: 22,
      doctorsAvailable: 24,
      rating: 4.6,
      latitude: 19.0620,
      longitude: 72.8340,
      isApproved: true,
      pincode: '400050',
      images: ['https://images.unsplash.com/photo-1586773860418-d3b3de97e963?w=600&auto=format&fit=crop'],
    });

    // Hospital 4: New Life Clinic (Pending Approval)
    const hUser4 = await User.create({
      name: 'New Life Clinic',
      email: 'hospital4@shems.com',
      password: 'hospitalpassword123',
      role: 'hospital',
      phone: '+912299990000',
      isVerified: true,
    });

    await Hospital.create({
      user: hUser4._id,
      name: 'New Life Clinic',
      address: 'JVLR Road, Powai, Mumbai',
      contact: '+912299990000',
      emergencyContact: '+912299991111',
      totalBeds: 50,
      availableBeds: 10,
      icuBedsTotal: 5,
      icuBedsAvailable: 1,
      oxygenBedsTotal: 10,
      oxygenBedsAvailable: 2,
      doctorsAvailable: 4,
      rating: 3.9,
      latitude: 19.1250,
      longitude: 72.9010,
      isApproved: false,
      pincode: '400076',
      images: ['https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop'],
    });

    console.log('Hospitals created.');

    // 4. Drivers & Ambulances
    // Driver 1 for City Emergency Hospital
    const dUser1 = await User.create({
      name: 'Driver Rajesh Kumar',
      email: 'driver1@shems.com',
      password: 'driverpassword123',
      role: 'driver',
      phone: '+919111122222',
      isVerified: true,
    });

    const ambulance1 = await Ambulance.create({
      vehicleNumber: 'MH-02-AB-1234',
      driver: dUser1._id,
      driverContact: '+919111122222',
      status: 'available',
      currentLatitude: 19.0800,
      currentLongitude: 72.8340,
      hospitalAssigned: hospital1._id,
      availability: true,
      pincode: '400054',
    });

    await Driver.create({
      user: dUser1._id,
      licenseNumber: 'DL-MH-2015-098765',
      status: 'available',
      currentAmbulance: ambulance1._id,
      currentLatitude: 19.0800,
      currentLongitude: 72.8340,
    });

    // Driver 2 for Metro General Clinic
    const dUser2 = await User.create({
      name: 'Driver Sunil Singh',
      email: 'driver2@shems.com',
      password: 'driverpassword123',
      role: 'driver',
      phone: '+919222233333',
      isVerified: true,
    });

    const ambulance2 = await Ambulance.create({
      vehicleNumber: 'MH-03-CD-5678',
      driver: dUser2._id,
      driverContact: '+919222233333',
      status: 'available',
      currentLatitude: 19.0710,
      currentLongitude: 72.8800,
      hospitalAssigned: hospital2._id,
      availability: true,
      pincode: '400070',
    });

    await Driver.create({
      user: dUser2._id,
      licenseNumber: 'DL-MH-2018-123456',
      status: 'available',
      currentAmbulance: ambulance2._id,
      currentLatitude: 19.0710,
      currentLongitude: 72.8800,
    });

    // Driver 3 for St. Mary Trauma Center
    const dUser3 = await User.create({
      name: 'Driver Vikram Rathore',
      email: 'driver3@shems.com',
      password: 'driverpassword123',
      role: 'driver',
      phone: '+919333344444',
      isVerified: true,
    });

    const ambulance3 = await Ambulance.create({
      vehicleNumber: 'MH-01-EF-9012',
      driver: dUser3._id,
      driverContact: '+919333344444',
      status: 'available',
      currentLatitude: 19.0600,
      currentLongitude: 72.8320,
      hospitalAssigned: hospital3._id,
      availability: true,
      pincode: '400050',
    });

    await Driver.create({
      user: dUser3._id,
      licenseNumber: 'DL-MH-2020-001122',
      status: 'available',
      currentAmbulance: ambulance3._id,
      currentLatitude: 19.0600,
      currentLongitude: 72.8320,
    });

    console.log('Drivers & Ambulances created.');
    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// If run directly from terminal
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed.js')) {
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-hospital-ems')
    .then(async () => {
      await seedData();
      mongoose.disconnect();
    })
    .catch((err) => {
      console.error('Database connection error in seed script:', err);
    });
}

export default seedData;
