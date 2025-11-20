// frontend/src/pages/Workers.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete, API_ENDPOINTS } from '@/utils/api';
import { handleError, handleSuccess } from '@/utils/errorHandler';

const pageSizeOptions = [10, 25, 50];
const roles = ['staff', 'manager', 'admin'];
const permissionsCatalog = [
  { key: 'assign_bookings', label: 'Assign bookings' },
  { key: 'edit_schedule', label: 'Edit schedule' },
  { key: 'process_payments', label: 'Process payments' },
];

const defaultSchedule = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: '09:00',
  end_time: '17:00',
  is_available: true,
}));

function Badge({ text, className }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{text}</span>;
}

function AvailabilityEditor({ schedule, onChange, disabled }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const update = (index, field, value) => {
    const next = [...schedule];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {schedule.map((slot, i) => (
        <div key={i} className="border rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-gray-800">{days[slot.day_of_week]}</div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={slot.is_available}
                onChange={(e) => update(i, 'is_available', e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">Available</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={slot.start_time}
              onChange={(e) => update(i, 'start_time', e.target.value)}
              disabled={disabled || !slot.is_available}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="time"
              value={slot.end_time}
              onChange={(e) => update(i, 'end_time', e.target.value)}
              disabled={disabled || !slot.is_available}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkerForm({ value, onChange, onSubmit, onCancel, canEdit, title, submitting }) {
  const togglePermission = (key) => {
    const next = value.permissions.includes(key)
      ? value.permissions.filter((p) => p !== key)
      : [...value.permissions, key];
    onChange({ ...value, permissions: next });
  };
  return (
    <form onSubmit={onSubmit}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            required
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            required
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <div className="text-sm font-medium text-gray-700 mb-2">Permissions</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {permissionsCatalog.map((p) => (
              <label key={p.key} className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={value.permissions.includes(p.key)}
                  onChange={() => togglePermission(p.key)}
                  disabled={!canEdit}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <div className="text-sm font-medium text-gray-700 mb-2">Weekly Availability</div>
        <AvailabilityEditor schedule={value.schedule} onChange={(s) => onChange({ ...value, schedule: s })} disabled={!canEdit} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700">Cancel</button>
        {canEdit && (
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            {submitting ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}

function ProfilePanel({ worker, onClose, canEdit, onEdit, metrics, assignments, changeLog, schedule }) {
  const roleClass = worker.role === 'manager' ? 'bg-blue-100 text-blue-800' : worker.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800';
  const availabilityClass = worker.current_status === 'busy' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-end z-50">
      <div className="w-full sm:w-[520px] bg-white h-full shadow-xl overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="text-lg font-semibold text-gray-900">{worker.name}</div>
          <button onClick={onClose} className="text-gray-600">Close</button>
        </div>
        <div className="p-4 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge text={worker.role} className={roleClass} />
            <Badge text={worker.current_status === 'busy' ? 'Busy' : 'Available'} className={availabilityClass} />
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="text-gray-600">Email</div>
            <div className="font-medium">{worker.email}</div>
            <div className="text-gray-600">Phone</div>
            <div className="font-medium">{worker.phone || '-'}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-md p-3">
              <div className="text-sm text-gray-600">Completion Rate</div>
              <div className="text-2xl font-semibold">{metrics.completionRate}%</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-sm text-gray-600">Services Performed</div>
              <div className="text-2xl font-semibold">{metrics.totalServices}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-sm text-gray-600">Revenue</div>
              <div className="text-2xl font-semibold">₦{metrics.revenue.toLocaleString()}</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-sm text-gray-600">Rating</div>
              <div className="text-2xl font-semibold">{metrics.rating || 'N/A'}</div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Availability</div>
            <AvailabilityEditor schedule={schedule} onChange={() => {}} disabled />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Current Assignments</div>
            <div className="space-y-2">
              {assignments.length === 0 && <div className="text-sm text-gray-500">No current assignments</div>}
              {assignments.map((b) => (
                <div key={b.id} className="border rounded-md p-3">
                  <div>
                    <div className="font-medium text-gray-900">{b.customer_name}</div>
                    <div className="text-xs text-gray-600">{Array.isArray(b.service_names) ? b.service_names.join(', ') : b.service_name || '-'}</div>
                    <div className="text-xs text-gray-500">{b.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Change History</div>
            <div className="space-y-2">
              {changeLog.length === 0 && <div className="text-sm text-gray-500">No changes recorded</div>}
              {changeLog.map((c, i) => (
                <div key={i} className="border rounded-md p-3 text-sm">
                  <div className="font-medium">{c.action}</div>
                  <div className="text-gray-600">{new Date(c.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            {canEdit && (
              <button onClick={() => onEdit(worker)} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Edit</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Workers() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [profile, setProfile] = useState(null);
  const [changeLog, setChangeLog] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'staff', permissions: [], schedule: defaultSchedule });
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const isWorker = user?.role === 'staff';

  const filtered = useMemo(() => {
    let list = workers;
    if (isWorker) list = list.filter((w) => w.id === user?.id);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((w) => (w.name || '').toLowerCase().includes(q) || (w.email || '').toLowerCase().includes(q) || (w.phone || '').toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') list = list.filter((w) => w.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter((w) => (statusFilter === 'active' ? w.is_active : !w.is_active));
    if (availabilityFilter !== 'all') list = list.filter((w) => (availabilityFilter === 'busy' ? w.current_status === 'busy' : w.current_status !== 'busy'));
    return list;
  }, [workers, query, roleFilter, statusFilter, availabilityFilter, user, isWorker]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await apiGet(API_ENDPOINTS.WORKERS);
      setWorkers(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e) {
      handleError(e, 'Failed to load workers');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileData = async (w) => {
    try {
      const [perf, assigns] = await Promise.all([
        apiGet('/reports/worker-performance', { worker_id: w.id }),
        apiGet(API_ENDPOINTS.BOOKINGS, { worker_id: w.id }),
      ]);
      const perfRows = perf?.worker_performance || [];
      const totalServices = perfRows.reduce((s, r) => s + parseInt(r.total_services_performed || 0), 0);
      const completed = perfRows.reduce((s, r) => s + parseInt(r.completed_services || 0), 0);
      const revenue = perfRows.reduce((s, r) => s + parseFloat(r.total_service_revenue || 0), 0);
      const completionRate = Math.round((completed / Math.max(1, totalServices)) * 100);
      setProfile({
        worker: w,
        metrics: { completionRate, totalServices, revenue, rating: null },
        assignments: Array.isArray(assigns?.data) ? assigns.data : Array.isArray(assigns) ? assigns : [],
        schedule: defaultSchedule,
      });
    } catch (e) {
      handleError(e, 'Failed to load profile');
      setProfile({ worker: w, metrics: { completionRate: 0, totalServices: 0, revenue: 0, rating: null }, assignments: [], schedule: defaultSchedule });
    }
  };

  const openProfile = async (w) => {
    await fetchProfileData(w);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiPost(API_ENDPOINTS.WORKERS, { name: form.name, email: form.email, phone: form.phone, role: form.role });
      try {
        await apiPut(`/workers/${user?.id}/schedule`, { schedule: form.schedule });
      } catch {}
      handleSuccess('Worker created');
      setChangeLog((l) => [...l, { action: `Created ${form.name}`, ts: Date.now() }]);
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', role: 'staff', permissions: [], schedule: defaultSchedule });
      await fetchWorkers();
    } catch (e) {
      handleError(e, 'Failed to create worker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (w) => {
    setForm({ name: w.name || '', email: w.email || '', phone: w.phone || '', role: w.role || 'staff', permissions: [], schedule: defaultSchedule });
    setShowEdit(true);
    setChangeLog((l) => [...l, { action: `Opened edit for ${w.name}`, ts: Date.now() }]);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const id = workers.find((x) => x.email === form.email)?.id;
      await apiPut(`${API_ENDPOINTS.WORKERS}/${id}`, { name: form.name, email: form.email, phone: form.phone, role: form.role });
      try {
        await apiPut(`/workers/${id}/schedule`, { schedule: form.schedule });
      } catch {}
      handleSuccess('Worker updated');
      setChangeLog((l) => [...l, { action: `Updated ${form.name}`, ts: Date.now() }]);
      setShowEdit(false);
      await fetchWorkers();
    } catch (e) {
      handleError(e, 'Failed to update worker');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-bold text-gray-900">Workers</div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Add Worker
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <input
          placeholder="Search name, email, phone"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-md md:col-span-2"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Archived</option>
        </select>
        <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
          <option value="all">All availability</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
        </select>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Availability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginated.map((w) => {
                const roleClass = w.role === 'manager' ? 'bg-blue-100 text-blue-800' : w.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800';
                const availabilityClass = w.current_status === 'busy' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
                return (
                  <tr key={w.id}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{w.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{w.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{w.phone || '-'}</td>
                    <td className="px-6 py-3">
                      <Badge text={w.role} className={roleClass} />
                    </td>
                    <td className="px-6 py-3">
                      <Badge text={w.current_status === 'busy' ? 'Busy' : 'Available'} className={availabilityClass} />
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <button onClick={() => openProfile(w)} className="text-indigo-600 mr-3">View</button>
                      {canManage && (
                        <button onClick={() => handleEditOpen(w)} className="text-blue-600 mr-3">Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={6}>No workers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm text-gray-600">Page {page} of {pages}</div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value))} className="px-2 py-1 border rounded">
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}/page</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 border rounded">Prev</button>
              <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="px-2 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-2xl">
            <WorkerForm value={form} onChange={setForm} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} canEdit={canManage} title="Add Worker" submitting={submitting} />
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-2xl">
            <WorkerForm value={form} onChange={setForm} onSubmit={handleEdit} onCancel={() => setShowEdit(false)} canEdit={canManage} title="Edit Worker" submitting={submitting} />
          </div>
        </div>
      )}

      {profile && (
        <ProfilePanel
          worker={profile.worker}
          onClose={() => setProfile(null)}
          canEdit={canManage}
          onEdit={(w) => handleEditOpen(w)}
          metrics={profile.metrics}
          assignments={profile.assignments}
          changeLog={changeLog}
          schedule={profile.schedule}
        />
      )}
    </div>
  );
}