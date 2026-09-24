import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Public Emergency Access (no login required)
import EmergencyHelp from './pages/EmergencyHelp';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Patient Pages
import PatientOverview from './pages/patient/PatientOverview';
import NearbyHospitals from './pages/patient/NearbyHospitals';
import PatientLiveTracking from './pages/patient/PatientLiveTracking';
import PatientHistory from './pages/patient/PatientHistory';
import PatientProfile from './pages/patient/PatientProfile';

// Hospital Pages
import HospitalOverview from './pages/hospital/HospitalOverview';
import HospitalBeds from './pages/hospital/HospitalBeds';
import HospitalAmbulances from './pages/hospital/HospitalAmbulances';
import HospitalRecords from './pages/hospital/HospitalRecords';
import HospitalProfile from './pages/hospital/HospitalProfile';
import IncomingEmergencies from './pages/hospital/IncomingEmergencies';
import HospitalEmergencyCases from './pages/hospital/HospitalEmergencyCases';
import EmergencyCaseDetail from './pages/hospital/EmergencyCaseDetail';

// Driver Pages
import DriverOverview from './pages/driver/DriverOverview';
import DriverHistory from './pages/driver/DriverHistory';
import DriverProfile from './pages/driver/DriverProfile';
import CreateEmergencyCase from './pages/driver/CreateEmergencyCase';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import HospitalApprovals from './pages/admin/HospitalApprovals';
import AmbulanceFleet from './pages/admin/AmbulanceFleet';
import DriverRoster from './pages/admin/DriverRoster';
import LiveMonitoring from './pages/admin/LiveMonitoring';
import SystemAudit from './pages/admin/SystemAudit';
import AdminEmergencyCases from './pages/admin/AdminEmergencyCases';

import { Shield, Eye, Heart, Key, Activity, Building2, Truck, Siren } from 'lucide-react';

// Guard component checking session authentication and roles
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-primary-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Restoring security session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect authorized users back to their corresponding landing dashboards
    if (user.role === 'patient') return <Navigate to="/patient" replace />;
    if (user.role === 'hospital') return <Navigate to="/hospital" replace />;
    if (user.role === 'driver') return <Navigate to="/driver" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

// Landing Page Portal
const LandingPage = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      {/* Hero Header */}
      <nav className="mx-auto max-w-7xl flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary-600 animate-pulse" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-indigo-400">
            SHEMS Portal
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/emergency"
            className="flex items-center gap-1.5 rounded-xl bg-emergency-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emergency-600/30 hover:bg-emergency-700 animate-pulse transition"
          >
            <Siren className="h-4 w-4" /> Emergency Help / SOS
          </Link>
          {user ? (
            <Link
              to={`/${user.role}`}
              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-primary-700 transition"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-xs font-semibold hover:text-primary-600 transition">Log In</Link>
              <Link
                to="/register"
                className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-primary-700 transition"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Emergency Help banner — always visible, always reachable without login */}
      <div className="mx-auto max-w-6xl px-6">
        <Link
          to="/emergency"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emergency-600 to-rose-600 px-6 py-5 text-white shadow-xl hover:brightness-110 transition"
        >
          <div className="flex items-center gap-3 text-center sm:text-left">
            <Siren className="h-9 w-9 shrink-0 animate-pulse" />
            <div>
              <p className="font-extrabold text-lg leading-tight">In an emergency? Get help immediately.</p>
              <p className="text-sm text-white/90">No login. No registration. No payment required first — treatment starts immediately.</p>
            </div>
          </div>
          <span className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emergency-700 whitespace-nowrap">Emergency Help / SOS &rarr;</span>
        </Link>
      </div>

      {/* Hero Body */}
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-sans">
          Smart Hospital Emergency
          <span className="block mt-2 bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-400 dark:to-indigo-400">
            Management System
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-slate-500 text-lg">
          Connecting patients, emergency responders, hospitals, and fleet managers in a secure, real-time ecosystem.
        </p>

        {/* Dynamic portal selectors */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/60 p-6 text-left bg-white dark:bg-slate-900 dark:border-slate-800/80 hover:shadow-lg transition duration-300">
            <Heart className="h-10 w-10 text-rose-500" />
            <h3 className="mt-4 font-bold text-lg">Patients</h3>
            <p className="mt-2 text-sm text-slate-400">Search bed availability, book emergency ambulances, and track dispatch in real time.</p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Access Console &rarr;</Link>
          </div>

          <div className="rounded-2xl border border-slate-200/60 p-6 text-left bg-white dark:bg-slate-900 dark:border-slate-800/80 hover:shadow-lg transition duration-300">
            <Building2 className="h-10 w-10 text-primary-500" />
            <h3 className="mt-4 font-bold text-lg">Hospitals</h3>
            <p className="mt-2 text-sm text-slate-400">Manage ICU & Oxygen bed counts, accept dispatches, and coordinate drivers.</p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Access Console &rarr;</Link>
          </div>

          <div className="rounded-2xl border border-slate-200/60 p-6 text-left bg-white dark:bg-slate-900 dark:border-slate-800/80 hover:shadow-lg transition duration-300">
            <Truck className="h-10 w-10 text-success-500" />
            <h3 className="mt-4 font-bold text-lg">Ambulance Drivers</h3>
            <p className="mt-2 text-sm text-slate-400">Accept ride assignments, update live GPS, navigate routes, and complete admissions.</p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Access Console &rarr;</Link>
          </div>

          <div className="rounded-2xl border border-slate-200/60 p-6 text-left bg-white dark:bg-slate-900 dark:border-slate-800/80 hover:shadow-lg transition duration-300">
            <Shield className="h-10 w-10 text-indigo-500" />
            <h3 className="mt-4 font-bold text-lg">Administrators</h3>
            <p className="mt-2 text-sm text-slate-400">Monitor system-wide emergencies, approve hospitals, and run audit analytics.</p>
            <Link to="/login" className="mt-4 inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Access Console &rarr;</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/emergency" element={<EmergencyHelp />} />
        <Route path="/sos" element={<Navigate to="/emergency" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Patient Routes */}
        <Route
          path="/patient/*"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <Layout>
                <Routes>
                  <Route path="/" element={<PatientOverview />} />
                  <Route path="/search" element={<NearbyHospitals />} />
                  <Route path="/track" element={<PatientLiveTracking />} />
                  <Route path="/history" element={<PatientHistory />} />
                  <Route path="/profile" element={<PatientProfile />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Hospital Routes */}
        <Route
          path="/hospital/*"
          element={
            <ProtectedRoute allowedRoles={['hospital']}>
              <Layout>
                <Routes>
                  <Route path="/" element={<HospitalOverview />} />
                  <Route path="/beds" element={<HospitalBeds />} />
                  <Route path="/ambulances" element={<HospitalAmbulances />} />
                  <Route path="/records" element={<HospitalRecords />} />
                  <Route path="/incoming" element={<IncomingEmergencies />} />
                  <Route path="/emergency-cases" element={<HospitalEmergencyCases />} />
                  <Route path="/emergency-cases/:id" element={<EmergencyCaseDetail />} />
                  <Route path="/profile" element={<HospitalProfile />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Driver Routes */}
        <Route
          path="/driver/*"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <Layout>
                <Routes>
                  <Route path="/" element={<DriverOverview />} />
                  <Route path="/emergency-case" element={<CreateEmergencyCase />} />
                  <Route path="/history" element={<DriverHistory />} />
                  <Route path="/profile" element={<DriverProfile />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout>
                <Routes>
                  <Route path="/" element={<AdminOverview />} />
                  <Route path="/hospitals" element={<HospitalApprovals />} />
                  <Route path="/ambulances" element={<AmbulanceFleet />} />
                  <Route path="/drivers" element={<DriverRoster />} />
                  <Route path="/monitoring" element={<LiveMonitoring />} />
                  <Route path="/emergency-cases" element={<AdminEmergencyCases />} />
                  <Route path="/audit" element={<SystemAudit />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback Catch-All */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
