import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Search,
  MapPin,
  History,
  User,
  Truck,
  Users,
  Building2,
  FileCheck2,
  FileText,
  Settings,
  ClipboardList,
  ShieldAlert
} from 'lucide-react';

export const Sidebar = () => {
  const { user } = useAuth();

  const getLinks = () => {
    switch (user?.role) {
      case 'patient':
        return [
          { to: '/patient', label: 'Overview', icon: LayoutDashboard },
          { to: '/patient/search', label: 'Nearby Hospitals', icon: Search },
          { to: '/patient/track', label: 'Live Tracking', icon: MapPin },
          { to: '/patient/history', label: 'Ride History', icon: History },
          { to: '/patient/profile', label: 'Profile Settings', icon: User },
        ];
      case 'hospital':
        return [
          { to: '/hospital', label: 'Overview', icon: LayoutDashboard },
          { to: '/hospital/incoming', label: 'Incoming Emergencies', icon: ShieldAlert },
          { to: '/hospital/emergency-cases', label: 'Emergency Cases', icon: ClipboardList },
          { to: '/hospital/beds', label: 'Beds Capacity', icon: ClipboardList },
          { to: '/hospital/ambulances', label: 'Manage Fleet', icon: Truck },
          { to: '/hospital/records', label: 'Patient Logs', icon: Users },
          { to: '/hospital/profile', label: 'Profile Settings', icon: User },
        ];
      case 'driver':
        return [
          { to: '/driver', label: 'Job Board', icon: LayoutDashboard },
          { to: '/driver/emergency-case', label: 'Create Emergency Case', icon: ShieldAlert },
          { to: '/driver/history', label: 'Ride History', icon: History },
          { to: '/driver/profile', label: 'Profile Settings', icon: User },
        ];
      case 'admin':
        return [
          { to: '/admin', label: 'Dashboard Stats', icon: LayoutDashboard },
          { to: '/admin/hospitals', label: 'Hospital Approvals', icon: Building2 },
          { to: '/admin/ambulances', label: 'Ambulance Fleet', icon: Truck },
          { to: '/admin/drivers', label: 'Driver Roster', icon: Users },
          { to: '/admin/monitoring', label: 'Live Monitoring', icon: MapPin },
          { to: '/admin/emergency-cases', label: 'Emergency Cases', icon: ShieldAlert },
          { to: '/admin/audit', label: 'System Audit Logs', icon: FileText },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-slate-200 bg-white px-4 py-6 md:block dark:border-slate-800/80 dark:bg-slate-900">
      <nav className="flex flex-col gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/patient' || link.to === '/hospital' || link.to === '/driver' || link.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
export default Sidebar;
