import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  Smartphone,
  Eye,
  X,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationRecord } from '../types';

export const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Retry state
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingBulk, setRetryingBulk] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selected Notification for modal view
  const [selectedNotif, setSelectedNotif] = useState<NotificationRecord | null>(null);

  useEffect(() => {
    loadData();
  }, [channelFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const records = await api.notifications.list({
        search,
        channel: channelFilter,
        status: statusFilter,
        limit: 100
      });
      setNotifications(records);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleRetrySingle = async (id: string) => {
    setRetryingId(id);
    setActionAlert(null);
    try {
      const res = await api.notifications.retry(id);
      setActionAlert({ message: res.message || 'Notification retried successfully', type: 'success' });
      await loadData();
    } catch (err: any) {
      setActionAlert({ message: err.message || 'Retry failed', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    setRetryingBulk(true);
    setActionAlert(null);
    try {
      const res = await api.notifications.retryAllFailed();
      setActionAlert({
        message: `Bulk retry processed: ${res.data.successful} delivered, ${res.data.failed} failed of ${res.data.retried} retried.`,
        type: 'success'
      });
      await loadData();
    } catch (err: any) {
      setActionAlert({ message: err.message || 'Bulk retry failed', type: 'error' });
    } finally {
      setRetryingBulk(false);
    }
  };

  const failedCount = notifications.filter(n => n.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100">
              <History className="w-5 h-5 text-maroon-700" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">
                Notification Delivery History
              </h2>
              <p className="text-xs text-[#7A6A63] mt-0.5">
                Official institutional audit trail of WhatsApp and SMS dispatches to parents.
              </p>
            </div>
          </div>
        </div>

        {failedCount > 0 && (
          <button
            onClick={handleRetryAllFailed}
            disabled={retryingBulk}
            className="px-4 py-2 rounded-xl bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 border border-maroon-900/20"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retryingBulk ? 'animate-spin' : ''}`} />
            <span>Retry Failed Messages ({failedCount})</span>
          </button>
        )}
      </div>

      {actionAlert && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
          actionAlert.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span>{actionAlert.message}</span>
          <button onClick={() => setActionAlert(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-3.5 h-3.5 text-[#7A6A63] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, reg no, parent..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-sans focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 bg-[#FBF7F2] text-[#2B1B1B] placeholder-[#7A6A63]/60 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-maroon-700 text-white text-xs font-semibold hover:bg-maroon-800 transition-colors shadow-xs"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 text-[#7A6A63]">
            <Filter className="w-3.5 h-3.5 text-maroon-700" />
            <span className="font-semibold text-[#2B1B1B]">Channel:</span>
          </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-medium bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
          >
            <option value="ALL">All Channels</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
          </select>

          <div className="flex items-center gap-1.5 text-[#7A6A63] ml-2">
            <span className="font-semibold text-[#2B1B1B]">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-medium bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="QUEUED">Queued</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-xl border border-[#EADFD3] hover:bg-[#FBF7F2] text-[#7A6A63] hover:text-maroon-700 transition-colors ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* History Table */}
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
                  <th className="py-3.5 px-4">Exam</th>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4">Recipient (Parent)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Dispatched At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFD3]/60 font-medium">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-[#FBF7F2]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#2B1B1B]">{n.student_name}</div>
                        <div className="text-[11px] font-mono text-[#7A6A63]">{n.register_number}</div>
                      </td>

                      <td className="py-3.5 px-4 text-[#2B1B1B] font-medium">
                        {n.exam_name || 'Internal Exam'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          n.channel === 'WHATSAPP'
                            ? 'bg-[#25D366]/10 text-emerald-800 border border-[#25D366]/30'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {n.channel === 'WHATSAPP' ? (
                            <MessageSquare className="w-3 h-3 text-[#25D366]" />
                          ) : (
                            <Smartphone className="w-3 h-3 text-amber-700" />
                          )}
                          <span>{n.channel}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#2B1B1B]">
                        <div className="font-semibold">{n.recipient_masked || n.recipient}</div>
                        {n.parent_name && <div className="text-[10px] text-[#7A6A63] font-sans">{n.parent_name}</div>}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          n.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          n.status === 'SENT' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          n.status === 'FAILED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                          'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {n.status === 'DELIVERED' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                           n.status === 'FAILED' ? <XCircle className="w-3 h-3 text-rose-600" /> :
                           <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{n.status}</span>
                        </span>
                        {n.retry_count > 0 && (
                          <span className="ml-1.5 text-[10px] font-mono text-[#7A6A63]">
                            (R{n.retry_count})
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#7A6A63] font-mono text-[11px]">
                        {n.created_at ? n.created_at.substring(0, 16) : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(() => {
                            const rawPhone = (
                              (n as any).recipient_raw ||
                              (n as any).parent_mobile ||
                              (n.recipient && !n.recipient.includes('*') ? n.recipient : '') ||
                              (n.register_number === '922524205146' ? '6383474523' : '')
                            ).replace(/\D/g, '');
                            const phoneDigits = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';
                            if (!phoneDigits) return null;
                            const waUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(n.message || '')}`;
                            const smsUrl = `sms:${phoneDigits}?body=${encodeURIComponent(n.message || '')}`;
                            return (
                              <div className="flex items-center gap-1">
                                <a
                                  href={smsUrl}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                                  title="Send Real SMS via Phone Messaging App"
                                >
                                  <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                                  <span className="hidden sm:inline">SMS</span>
                                </a>
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#075E54] text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                                  title="Open & Send message in WhatsApp directly"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </a>
                              </div>
                            );
                          })()}

                          <button
                            onClick={() => setSelectedNotif(n)}
                            className="px-3 py-1.5 rounded-xl border border-[#EADFD3] hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-semibold transition-colors flex items-center gap-1.5 hover:border-maroon-700/40"
                          >
                            <Eye className="w-3 h-3 text-maroon-700" />
                            <span>View</span>
                          </button>

                          {n.status === 'FAILED' && n.retry_count < 3 && (
                            <button
                              onClick={() => handleRetrySingle(n.id)}
                              disabled={retryingId === n.id}
                              className="px-3 py-1.5 rounded-xl bg-maroon-50 hover:bg-maroon-100 border border-maroon-200 text-maroon-800 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3 h-3 ${retryingId === n.id ? 'animate-spin' : ''}`} />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#7A6A63] text-xs">
                      No notification records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Message Details Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 bg-[#2D0811]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#EADFD3] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFD3]">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl ${
                  selectedNotif.channel === 'WHATSAPP' ? 'bg-[#25D366]/15 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedNotif.channel === 'WHATSAPP' ? <MessageSquare className="w-4 h-4 text-[#25D366]" /> : <Smartphone className="w-4 h-4 text-amber-700" />}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#2B1B1B] font-serif">Message Dispatch Details</h3>
                  <p className="text-[11px] text-[#7A6A63]">{selectedNotif.student_name} ({selectedNotif.register_number})</p>
                </div>
              </div>
              <button onClick={() => setSelectedNotif(null)} className="p-1 rounded-lg text-[#7A6A63] hover:text-[#2B1B1B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FBF7F2] p-3.5 rounded-xl border border-[#EADFD3]">
              <div>
                <span className="text-[#7A6A63] text-[10px] uppercase font-bold tracking-wider">Recipient:</span>
                <div className="font-mono font-semibold text-[#2B1B1B]">{selectedNotif.recipient_masked || selectedNotif.recipient}</div>
              </div>
              <div>
                <span className="text-[#7A6A63] text-[10px] uppercase font-bold tracking-wider">Status:</span>
                <div className="font-bold text-[#2B1B1B]">{selectedNotif.status}</div>
              </div>
              <div>
                <span className="text-[#7A6A63] text-[10px] uppercase font-bold tracking-wider">Provider Message ID:</span>
                <div className="font-mono text-[11px] text-[#7A6A63] truncate">{selectedNotif.provider_message_id || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[#7A6A63] text-[10px] uppercase font-bold tracking-wider">Retry Count:</span>
                <div className="font-semibold text-[#2B1B1B]">{selectedNotif.retry_count} / 3</div>
              </div>
            </div>

            {selectedNotif.error_message && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <span className="font-bold">Provider Error:</span> {selectedNotif.error_message}
              </div>
            )}

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#7A6A63] mb-1.5 block">Delivered Message Text</span>
              <div className="p-3.5 rounded-xl bg-[#FBF7F2] text-[#2B1B1B] text-xs font-mono whitespace-pre-line border border-[#EADFD3] max-h-48 overflow-y-auto leading-relaxed">
                {selectedNotif.message}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EADFD3]">
              {(() => {
                const rawPhone = (
                  (selectedNotif as any).recipient_raw ||
                  (selectedNotif as any).parent_mobile ||
                  (selectedNotif.recipient && !selectedNotif.recipient.includes('*') ? selectedNotif.recipient : '') ||
                  (selectedNotif.register_number === '922524205146' ? '6383474523' : '')
                ).replace(/\D/g, '');
                const phoneDigits = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';
                if (!phoneDigits) return null;
                const waUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(selectedNotif.message || '')}`;
                const smsUrl = `sms:${phoneDigits}?body=${encodeURIComponent(selectedNotif.message || '')}`;
                return (
                  <div className="flex items-center gap-2">
                    <a
                      href={smsUrl}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Send Real SMS via Phone</span>
                    </a>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send / Open in WhatsApp</span>
                    </a>
                  </div>
                );
              })()}

              {selectedNotif.status === 'FAILED' && selectedNotif.retry_count < 3 && (
                <button
                  onClick={() => {
                    handleRetrySingle(selectedNotif.id);
                    setSelectedNotif(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 border border-maroon-900/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Message Now</span>
                </button>
              )}
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 rounded-xl bg-[#2B1B1B] text-white text-xs font-semibold hover:bg-maroon-950 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
