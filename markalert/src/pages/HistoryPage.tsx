import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Filter,
  MessageSquare,
  Smartphone,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { NotificationChannel, NotificationStatus } from '../types';

export const HistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const batchIdParam = searchParams.get('batch_id') || undefined;
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications-history', batchIdParam, selectedChannel, selectedStatus, searchQuery, page],
    queryFn: () =>
      api.notifications.list({
        batch_id: batchIdParam,
        channel: selectedChannel !== 'ALL' ? (selectedChannel as NotificationChannel) : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as NotificationStatus) : undefined,
        search: searchQuery || undefined,
        page,
        limit: 25,
      }),
  });

  const handleRetry = async (notificationId: string) => {
    setRetryingId(notificationId);
    try {
      await api.notifications.retry(notificationId);
      await refetch();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const notifications = data?.notifications || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Notification History & Logs
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Detailed delivery audit trail for every dispatched message
          </p>
        </div>

        {batchIdParam && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/batches/${batchIdParam}/progress`)}
            className="gap-1.5"
          >
            <span>Live Batch Status</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by student register number or message snippet..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
              />
            </div>

            {/* Channel Filter */}
            <select
              value={selectedChannel}
              onChange={e => {
                setSelectedChannel(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-700"
            >
              <option value="ALL">All Channels</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS Gateway</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="SENT">Sent (In Transit)</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Records Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-stone-400 text-xs">
              <div className="w-6 h-6 border-2 border-stone-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading notification logs...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-600">No notifications found</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="py-3 px-5">Recipient / Reg No</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Examination</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4">Message Snippet</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {notifications.map(notif => (
                    <tr key={notif.id} className="hover:bg-stone-50/50">
                      <td className="py-3 px-5 font-bold font-mono text-stone-900">
                        {notif.recipient_reference}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-stone-700">
                          {notif.channel === 'WHATSAPP' ? (
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5 text-sky-600" />
                          )}
                          {notif.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        {notif.batch?.exam_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={getStatusBadgeVariant(notif.status)}>
                          {notif.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-stone-400 font-mono text-[11px]">
                        {notif.sent_at
                          ? new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-stone-500 max-w-xs truncate" title={notif.message_text}>
                        {notif.message_text}
                      </td>
                      <td className="py-3 px-5 text-right">
                        {notif.status === 'FAILED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                            isLoading={retryingId === notif.id}
                            onClick={() => handleRetry(notif.id)}
                          >
                            Retry
                          </Button>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-mono">
                            {notif.provider_message_id?.slice(0, 10) || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <span>Page {page} of {pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
