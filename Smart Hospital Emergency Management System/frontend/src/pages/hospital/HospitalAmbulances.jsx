import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { TableSkeleton } from '../../components/LoaderSkeletons';
import Toast from '../../components/Toast';
import { Truck, Plus, Trash2, ShieldAlert, Check, X, Phone, User } from 'lucide-react';

const HospitalAmbulances = () => {
  const [ambulances, setAmbulances] = useState([]);
  const [unassignedDrivers, setUnassignedDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    driverId: '',
    driverContact: ''
  });

  const fetchData = async () => {
    try {
      const ambRes = await api.get('/api/hospital/ambulances');
      setAmbulances(ambRes.data.data || []);

      const drvRes = await api.get('/api/hospital/drivers/unassigned');
      setUnassignedDrivers(drvRes.data.data || []);
    } catch (err) {
      setError('Failed to load fleet management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    if (!formData.driverId) {
      setError('Please assign an available driver to this vehicle.');
      setActionLoading(false);
      return;
    }

    try {
      await api.post('/api/hospital/ambulances', formData);
      setSuccess('Ambulance vehicle registered to your fleet.');
      setShowAddModal(false);
      setFormData({ vehicleNumber: '', driverId: '', driverContact: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register ambulance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAvailability = async (id, currentAvailability) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/api/hospital/ambulances/${id}`, {
        availability: !currentAvailability
      });
      setSuccess('Vehicle availability status updated.');
      fetchData();
    } catch (err) {
      setError('Failed to update ambulance status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this ambulance from your fleet?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/api/hospital/ambulances/${id}`);
      setSuccess('Ambulance successfully removed.');
      fetchData();
    } catch (err) {
      setError('Failed to delete ambulance vehicle.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary-500" />
            Ambulance Fleet Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Register vehicles, assign verified drivers, and coordinate dispatches.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow flex items-center gap-1.5 transition"
        >
          <Plus className="h-4 w-4" /> Add Ambulance
        </button>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Fleet table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {ambulances.length === 0 ? (
            <div className="text-center py-16">
              <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-600 dark:text-slate-400">No vehicles registered</h4>
              <p className="text-slate-400 text-xs mt-1">Click the 'Add Ambulance' button above to build your fleet.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle Number</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Driver</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Driver Phone</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Availability</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Operational Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {ambulances.map((amb) => (
                  <tr key={amb._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {amb.vehicleNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{amb.driver?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{amb.driverContact || amb.driver?.phone || '--'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleToggleAvailability(amb._id, amb.availability)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                          amb.availability
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                        }`}
                      >
                        {amb.availability ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {amb.availability ? 'Online' : 'Offline'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold capitalize">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        amb.status === 'available'
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                      }`}>
                        {amb.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex justify-center">
                      <button
                        onClick={() => handleDelete(amb._id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition"
                        title="Remove vehicle"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Register Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-primary-600 to-indigo-600 p-6 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Truck className="h-6 w-6 text-white" />
                Register New Ambulance
              </h2>
              <p className="text-xs text-primary-100 mt-1">Assign a verified driver to the vehicle.</p>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Vehicle License Plate Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-12-AB-1234"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500 font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Assign Driver</label>
                {unassignedDrivers.length === 0 ? (
                  <p className="text-xs text-rose-500 mt-1">
                    No unassigned drivers available. Register a driver in the Roster first.
                  </p>
                ) : (
                  <select
                    value={formData.driverId}
                    onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select Available Driver</option>
                    {unassignedDrivers.map((d) => (
                      <option key={d.user._id} value={d.user._id}>
                        {d.user.name} ({d.licenseNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Emergency Hotline / Contact Number</label>
                <input
                  type="tel"
                  placeholder="Ambulance driver phone number (optional)"
                  value={formData.driverContact}
                  onChange={(e) => setFormData({ ...formData, driverContact: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || unassignedDrivers.length === 0}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Add to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalAmbulances;
