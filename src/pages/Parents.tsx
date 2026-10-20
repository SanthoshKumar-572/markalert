import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Search,
  MessageSquare,
  Smartphone,
  Edit2,
  X,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { Parent } from '../types';

interface ParentsProps {
  isAdmin: boolean;
}

export const Parents: React.FC<ParentsProps> = ({ isAdmin }) => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [saving, setSaving] = useState(false);
  const [unmaskedRows, setUnmaskedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadParents();
  }, []);

  const loadParents = async () => {
    setLoading(true);
    try {
      const data = await api.parents.list(search);
      setParents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadParents();
  };

  const toggleUnmask = (id: string) => {
    setUnmaskedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent) return;

    setSaving(true);
    try {
      await api.parents.update(selectedParent.id, {
        parent_name: selectedParent.parent_name,
        mobile_number: selectedParent.mobile_number,
        whatsapp_number: selectedParent.whatsapp_number || selectedParent.mobile_number,
        sms_enabled: selectedParent.sms_enabled,
        whatsapp_enabled: selectedParent.whatsapp_enabled
      });
      setSelectedParent(null);
      await loadParents();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100">
            <HeartHandshake className="w-5 h-5 text-maroon-700" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">Parent Contact & Notification Registry</h2>
            <p className="text-xs text-[#7A6A63] mt-0.5">
              Registered parent phone numbers and notification channel preferences (WhatsApp & SMS).
            </p>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7A6A63] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parent or student..."
              className="w-64 pl-8 pr-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-sans bg-[#FBF7F2] text-[#2B1B1B] placeholder-[#7A6A63]/60 focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-maroon-700 text-white text-xs font-semibold hover:bg-maroon-800 transition-colors shadow-xs">
            Search
          </button>
        </form>
      </div>

      {/* Parents Table */}
      <div className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-maroon-700 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FBF7F2] border-b border-[#EADFD3] text-[#7A6A63] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Parent / Guardian</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4">WhatsApp Channel</th>
                  <th className="py-3.5 px-4">SMS Channel</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFD3]/60 font-medium">
                {parents.length > 0 ? (
                  parents.map((p) => {
                    const isUnmasked = !!unmaskedRows[p.id];
                    const displayed = isUnmasked ? p.mobile_number : p.mobile_number_masked;

                    return (
                      <tr key={p.id} className="hover:bg-[#FBF7F2]/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#2B1B1B]">{p.student_name}</div>
                          <div className="text-[11px] font-mono text-[#7A6A63]">{p.register_number}</div>
                        </td>

                        <td className="py-3.5 px-4 text-[#2B1B1B] font-medium">{p.parent_name}</td>

                        <td className="py-3.5 px-4 font-mono text-[#2B1B1B]">
                          <div className="flex items-center gap-1.5">
                            <span>{displayed}</span>
                            {isAdmin && (
                              <button
                                onClick={() => toggleUnmask(p.id)}
                                title={isUnmasked ? 'Mask' : 'Reveal phone'}
                                className="text-[#7A6A63] hover:text-[#2B1B1B]"
                              >
                                {isUnmasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            p.whatsapp_enabled ? 'bg-[#25D366]/15 text-emerald-800 border border-[#25D366]/30' : 'bg-[#FBF7F2] text-[#7A6A63] border border-[#EADFD3]'
                          }`}>
                            <MessageSquare className="w-3 h-3 text-[#25D366]" />
                            <span>{p.whatsapp_enabled ? 'Active' : 'Disabled'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            p.sms_enabled ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#FBF7F2] text-[#7A6A63] border border-[#EADFD3]'
                          }`}>
                            <Smartphone className="w-3 h-3 text-amber-700" />
                            <span>{p.sms_enabled ? 'Active' : 'Disabled'}</span>
                          </span>
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedParent(p)}
                              className="px-3 py-1.5 rounded-xl border border-[#EADFD3] hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors hover:border-maroon-700/40"
                            >
                              <Edit2 className="w-3 h-3 text-maroon-700" />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#7A6A63] text-xs">
                      No parent records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Parent Modal */}
      {selectedParent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Update Parent Contact</h3>
              <button onClick={() => setSelectedParent(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Name</label>
                <input
                  type="text"
                  value={selectedParent.parent_name}
                  onChange={(e) => setSelectedParent({ ...selectedParent, parent_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 digits)</label>
                <input
                  type="tel"
                  value={selectedParent.mobile_number}
                  onChange={(e) => setSelectedParent({ ...selectedParent, mobile_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedParent.whatsapp_enabled}
                    onChange={(e) => setSelectedParent({ ...selectedParent, whatsapp_enabled: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enable WhatsApp Notifications</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedParent.sms_enabled}
                    onChange={(e) => setSelectedParent({ ...selectedParent, sms_enabled: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enable SMS Notifications</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedParent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
