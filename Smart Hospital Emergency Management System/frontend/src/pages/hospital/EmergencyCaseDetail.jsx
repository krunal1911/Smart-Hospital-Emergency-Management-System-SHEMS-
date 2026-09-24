import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Toast from '../../components/Toast';
import {
  ArrowLeft,
  HeartPulse,
  UserCheck,
  UserX,
  FilePlus2,
  Clock,
  MapPin,
  Image as ImageIcon,
  Stethoscope,
} from 'lucide-react';

const conditionLabel = (c) => (c || '').replace(/_/g, ' ');

const EmergencyCaseDetail = () => {
  const { id } = useParams();
  const { socket } = useSocket();

  const [caseData, setCaseData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showIdentifyForm, setShowIdentifyForm] = useState(false);
  const [idForm, setIdForm] = useState({
    patientName: '',
    patientPhone: '',
    approxAge: '',
    gender: '',
    bloodGroup: '',
    address: '',
    identifiedByName: '',
    identifiedByPhone: '',
    identifiedByRelation: 'family',
  });
  const [noteText, setNoteText] = useState('');

  const fetchCase = async () => {
    try {
      const res = await api.get(`/api/emergency-case/${id}`);
      setCaseData(res.data.data.case);
      setUpdates(res.data.data.updates || []);
    } catch (err) {
      setError('Failed to load emergency case.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join_emergency_case', { caseId: id });

    const refresh = () => fetchCase();
    socket.on('case_status_updated', refresh);
    socket.on('case_update_added', refresh);
    socket.on('case_location_updated', refresh);

    return () => {
      socket.emit('leave_emergency_case', { caseId: id });
      socket.off('case_status_updated', refresh);
      socket.off('case_update_added', refresh);
      socket.off('case_location_updated', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id]);

  const handleBeginTreatment = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.put(`/api/emergency-case/${id}/begin-treatment`);
      setCaseData(res.data.data);
      setSuccess('Treatment started immediately — no registration or payment required.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start treatment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIdentifySubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      const res = await api.put(`/api/emergency-case/${id}/identify`, idForm);
      setCaseData(res.data.data);
      setSuccess('Patient identification recorded.');
      setShowIdentifyForm(false);
    } catch (err) {
      setError('Failed to save identification.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkUnknown = async () => {
    if (!window.confirm('Confirm no one is available to identify this patient? The case will be kept as Unknown Patient.')) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.put(`/api/emergency-case/${id}/mark-unknown`);
      setCaseData(res.data.data);
      setSuccess('Case marked as Unknown Patient.');
    } catch (err) {
      setError('Failed to update case.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert this case into a permanent patient record? This preserves the full treatment history.')) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/emergency-case/${id}/convert-to-patient`);
      setCaseData(res.data.data.emergencyCase);
      setSuccess('Converted into a permanent patient record.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to convert case.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await api.post(`/api/emergency-case/${id}/updates`, { message: noteText, type: 'note' });
      setNoteText('');
      fetchCase();
    } catch (err) {
      setError('Failed to add note.');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading case…</div>;
  }
  if (!caseData) {
    return <div className="p-6 text-sm text-slate-400">Case not found.</div>;
  }

  const idInfo = caseData.identification || {};

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {success && <Toast type="success" message={success} onClose={() => setSuccess('')} />}

      <Link to="/hospital/emergency-cases" className="text-xs font-semibold text-slate-400 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Emergency Cases
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{caseData.caseNumber}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Status: <span className="font-semibold text-slate-600 dark:text-slate-300">{caseData.status.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-3 py-1 rounded-full">
          {conditionLabel(caseData.patientCondition)}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: case facts + actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Scene Details</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500"><Clock className="h-3.5 w-3.5" /> {new Date(caseData.accidentTime).toLocaleString()}</span>
              <span className="flex items-center gap-1.5 text-slate-500"><MapPin className="h-3.5 w-3.5" /> {caseData.accidentAddress || `${caseData.accidentLatitude}, ${caseData.accidentLongitude}`}</span>
            </div>
            {caseData.conditionNotes && (
              <p className="text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-xl text-slate-600 dark:text-slate-300">{caseData.conditionNotes}</p>
            )}
            {caseData.ambulanceStaffNotes && (
              <p className="text-xs bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl text-amber-700 dark:text-amber-400">
                Ambulance staff: {caseData.ambulanceStaffNotes}
              </p>
            )}
            {caseData.photos?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2"><ImageIcon className="h-3.5 w-3.5" /> Accident Photos</span>
                <div className="flex gap-2 flex-wrap">
                  {caseData.photos.map((p, i) => (
                    <a key={i} href={p} target="_blank" rel="noreferrer">
                      <img src={p} alt={`accident-${i}`} className="h-20 w-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Treatment action */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-emergency-600" /> Emergency Treatment
            </h3>
            {caseData.treatmentStartedAt ? (
              <p className="text-xs text-success-600 font-semibold flex items-center gap-1.5">
                <HeartPulse className="h-4 w-4" /> Treatment started at {new Date(caseData.treatmentStartedAt).toLocaleString()}
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  Treatment can start immediately. No login, registration, identity, or payment is required.
                </p>
                <button
                  onClick={handleBeginTreatment}
                  disabled={actionLoading}
                  className="bg-emergency-600 hover:bg-emergency-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <HeartPulse className="h-4 w-4" /> Begin Treatment Now
                </button>
              </>
            )}
          </div>

          {/* Identification */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary-600" /> Patient Identification
            </h3>

            {idInfo.isIdentified ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p><span className="font-bold">Name:</span> {idInfo.patientName || 'Unknown'}</p>
                <p><span className="font-bold">Phone:</span> {idInfo.patientPhone || '—'}</p>
                <p><span className="font-bold">Identified by:</span> {idInfo.identifiedByName || '—'} ({idInfo.identifiedByRelation || '—'})</p>
              </div>
            ) : idInfo.markedUnknown ? (
              <p className="text-xs text-amber-600 font-semibold">Kept as Unknown Patient — no one was available to identify them.</p>
            ) : showIdentifyForm ? (
              <form onSubmit={handleIdentifySubmit} className="grid grid-cols-2 gap-3">
                <input placeholder="Patient name" value={idForm.patientName} onChange={(e) => setIdForm((f) => ({ ...f, patientName: e.target.value }))} className="col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <input placeholder="Patient phone" value={idForm.patientPhone} onChange={(e) => setIdForm((f) => ({ ...f, patientPhone: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <input placeholder="Approx. age" type="number" value={idForm.approxAge} onChange={(e) => setIdForm((f) => ({ ...f, approxAge: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <select value={idForm.gender} onChange={(e) => setIdForm((f) => ({ ...f, gender: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <select value={idForm.bloodGroup} onChange={(e) => setIdForm((f) => ({ ...f, bloodGroup: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs">
                  <option value="">Blood Group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                <input placeholder="Address" value={idForm.address} onChange={(e) => setIdForm((f) => ({ ...f, address: e.target.value }))} className="col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <input placeholder="Informant name" value={idForm.identifiedByName} onChange={(e) => setIdForm((f) => ({ ...f, identifiedByName: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <input placeholder="Informant phone" value={idForm.identifiedByPhone} onChange={(e) => setIdForm((f) => ({ ...f, identifiedByPhone: e.target.value }))} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                <select value={idForm.identifiedByRelation} onChange={(e) => setIdForm((f) => ({ ...f, identifiedByRelation: e.target.value }))} className="col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs">
                  {['family', 'friend', 'relative', 'police', 'ambulance_staff', 'bystander', 'other'].map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <div className="col-span-2 flex gap-2">
                  <button type="submit" disabled={actionLoading} className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition">Save Identification</button>
                  <button type="button" onClick={() => setShowIdentifyForm(false)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-4 py-2 text-xs font-semibold">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowIdentifyForm(true)} className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Record Identification
                </button>
                <button onClick={handleMarkUnknown} disabled={actionLoading} className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5">
                  <UserX className="h-3.5 w-3.5" /> Keep as Unknown Patient
                </button>
              </div>
            )}
          </div>

          {/* Convert to permanent record */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-emerald-600" /> Permanent Patient Record
            </h3>
            {caseData.convertedPatient ? (
              <p className="text-xs text-success-600 font-semibold">
                Converted on {new Date(caseData.convertedAt).toLocaleString()}. Full case history preserved on the patient record.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  Once the patient is stable, convert this temporary case into a permanent record. Works even if the case is still marked Unknown Patient.
                </p>
                <button
                  onClick={handleConvert}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition"
                >
                  Convert to Permanent Patient Record
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: timeline */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Case Timeline</h3>
            <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <button type="submit" className="bg-slate-800 dark:bg-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold">Add</button>
            </form>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {updates.length === 0 && <p className="text-xs text-slate-400">No updates yet.</p>}
              {updates.map((u) => (
                <div key={u._id} className="text-xs border-l-2 border-primary-200 dark:border-primary-900 pl-3">
                  <p className="text-slate-600 dark:text-slate-300">{u.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {u.updatedBy?.name || 'System'} · {new Date(u.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyCaseDetail;
