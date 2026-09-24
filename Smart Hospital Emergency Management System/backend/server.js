import dotenv from 'dotenv';
// Load backend/.env FIRST, before any other local module is imported, so
// every subsequent import (models, routes, socket manager, db connection)
// sees process.env already populated.
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Socket Manager
import { initSocket } from './sockets/socketManager.js';

// Models needed for an explicit index-build wait at startup (see below)
import Hospital from './models/Hospital.js';
import Ambulance from './models/Ambulance.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import emergencyCaseRoutes from './routes/emergencyCaseRoutes.js';
import publicEmergencyRoutes from './routes/publicEmergencyRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Initialize Sockets
initSocket(server);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded accident photos (created by the emergency case workflow)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Smart Hospital EMS Server is running.',
    timestamp: new Date(),
  });
});

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/emergency-case', emergencyCaseRoutes);
// Public, no-login emergency SOS workflow — must stay mounted with no
// `protect` middleware in front of it (see publicEmergencyRoutes.js).
app.use('/api/public/emergency', publicEmergencyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});

// Database Connection
// Uses a real local (or remote) MongoDB instance via MONGODB_URI in
// backend/.env. Run `mongod` locally (or point MONGODB_URI at Atlas/any
// reachable MongoDB) before starting the server.
const connectDB = async () => {
  let dbUri = process.env.MONGODB_URI;
  
  if (!dbUri) {
    dbUri = 'mongodb://127.0.0.1:27017/smart-hospital-ems';
  }

  try {
    // Try to connect to the provided URI first
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 2000 });
    console.log('[DATABASE] MongoDB Connected Successfully to', dbUri);
  } catch (initialError) {
    console.log('[DATABASE] Primary connection failed, starting automatic local database (mongodb-memory-server)...');
    
    // Import dynamically so it's only loaded when needed
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.join(__dirname, 'local-db-data');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath);
    }

    try {
      const mongoServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dbPath,
          storageEngine: 'wiredTiger'
        }
      });
      dbUri = mongoServer.getUri();
      await mongoose.connect(dbUri);
      console.log('[DATABASE] Automatic Local MongoDB Connected Successfully');
    } catch (memServerError) {
      console.error('[DATABASE] Failed to start automatic local database:', memServerError);
      process.exit(1);
    }
  }

  try {
    // Mongoose builds indexes (including the 2dsphere index the PIN-code /
    // nearby-search feature depends on) in the background by default.
    // Waiting for them explicitly here — before any seeding or requests
    // happen — avoids a rare race condition where a $near geospatial query
    // could run before its index actually exists yet.
    await Promise.all([Hospital.init(), Ambulance.init()]);
    console.log('[DATABASE] Geospatial indexes ready.');

    // Auto-seed demo accounts on first run against an empty database, so a
    // freshly created local MongoDB always has working demo credentials
    // without requiring a manual `npm run seed` step.
    const existingUsers = await mongoose.connection.db.collection('users').countDocuments().catch(() => 0);
    if (existingUsers === 0) {
      console.log('[DATABASE] No existing users found — auto-seeding demo accounts...');
      const { default: seedData } = await import('./utils/seed.js');
      await seedData();
      console.log('[DATABASE] Demo accounts seeded. See README.md for test credentials.');
    }
  } catch (error) {
    console.error('[DATABASE] Error during database initialization:', error);
    process.exit(1);
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n[SERVER] Smart Hospital EMS running on port ${PORT}`);
    console.log(`[SERVER] Health check available at http://localhost:${PORT}/api/health\n`);
  });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Shutting down gracefully...');
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server process terminated.');
  });
});
