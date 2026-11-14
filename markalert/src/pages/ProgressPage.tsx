import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Send,
  MessageSquare,
  Smartphone,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { BatchStatusResponse } from '../types';

export const ProgressPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  // Poll batch status every 2 seconds until completed/failed
  const { data: statusData, refetch, isLoading } = useQuery<BatchStatusResponse>({
    queryKey: ['batch-status', batchId],
    queryFn: () => api.batches.getStatus(batchId!),
    refetchInterval: query => {
      const data = query.state.data;
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED' || data?.status === 'PARTIAL') {
        return false;
      }
      return 2000;
    },
    enabled: !!batchId,
  });

  const counts = statusData?.counts || { total: 0, inProgress: 0, sent: 0, delivered: 0, failed: 0 };
  const total = counts.total || 1;
  const deliveredPercent = Math.min(100, Math.round((counts.delivered / total) * 100));
  const sentPercent = Math.min(100, Math.round((counts.sent / total) * 100));
  const failedPercent = Math.min(100, Math.round((counts.failed / total) * 100));

  const handleRetryFailed = async (channel?: 'WHATSAPP' | 'SMS') => {
    if (!batchId) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const res = await api.batches.retryFailedBatch(batchId, channel);
      setRetryMessage(res.message);
      await refetch();
    } catch (err: any) {
      setRetryMessage(err.response?.data?.error || err.message || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const isFinished = statusData?.status === 'COMPLETED' || statusData?.status === 'PARTIAL' || statusData?.status === 'FAILED';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 1. Uploaded
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 2. Validated
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 3. Confirmed
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-[#7A1A2C] font-bold flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-white flex items-center justify-center text-[10px]">4</span>
          Live Dispatch & Delivery
        </span>
      </div>

      {retryMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{retryMessage}</span>
        </div>
      )}

      {/* Main Status Header Card */}
      <Card>
        <CardHeader
          title={statusData?.examName || 'Dispatching Notifications'}
          description={`Batch ID: ${batchId}`}
          action={
            <Badge variant={getStatusBadgeVariant(statusData?.status || 'PROCESSING')}>
              {statusData?.status || 'QUEUED'}
            </Badge>
          }
        />

        <CardContent className="space-y-6">
          {/* Visual Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-stone-700">
              <span>Overall Delivery Progress</span>
              <span>{deliveredPercent}% Confirmed Delivered</span>
            </div>

            <div className="h-4 w-full bg-stone-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${deliveredPercent}%` }}
                className="bg-emerald-600 transition-all duration-500"
                title={`Delivered: ${counts.delivered}`}
              />
              <div
                style={{ width: `${sentPercent}%` }}
                className="bg-sky-500 transition-all duration-500"
                title={`Sent: ${counts.sent}`}
              />
              <div
                style={{ width: `${failedPercent}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`Failed: ${counts.failed}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400 font-medium pt-1">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                Delivered: {counts.delivered}
              </span>
              <span className="flex items-center gap-1 text-sky-700">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                In Transit: {counts.sent}
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Queued: {counts.inProgress}
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Failed: {counts.failed}
              </span>
            </div>
          </div>

          {/* Independent Channel Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            {/* WhatsApp Box */}
            <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-2">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> WhatsApp Status
                </span>
                <span className="text-xs font-mono font-bold">
                  {statusData?.channelBreakdown?.WHATSAPP?.DELIVERED || 0} Delivered
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-stone-600 pt-1">
                <div className="p-1.5 bg-white rounded-md border border-emerald-200/60">
                  <span className="block font-bold text-stone-800">
                    {statusData?.channelBreakdown?.WHATSAPP?.SENT || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Sent</span>
                </div>
                <div className="p-1.5 bg-white rounded-md border border-emerald-200/60">
                  <span className="block font-bold text-emerald-700">
                    {statusData?.channelBreakdown?.WHATSAPP?.DELIVERED || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Delivered</span>
                </div>
                <div className="p-1.5 bg-white rounded-md border border-emerald-200/60">
                  <span className="block font-bold text-rose-700">
                    {statusData?.channelBreakdown?.WHATSAPP?.FAILED || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Failed</span>
                </div>
              </div>

              {(statusData?.channelBreakdown?.WHATSAPP?.FAILED || 0) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs border-emerald-300 text-emerald-800"
                  isLoading={retrying}
                  onClick={() => handleRetryFailed('WHATSAPP')}
                >
                  Retry Failed WhatsApp Only
                </Button>
              )}
            </div>

            {/* SMS Box */}
            <div className="p-4 rounded-xl bg-sky-50/40 border border-sky-100 space-y-2">
              <div className="flex items-center justify-between text-sky-800">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> SMS Gateway Status
                </span>
                <span className="text-xs font-mono font-bold">
                  {statusData?.channelBreakdown?.SMS?.DELIVERED || 0} Delivered
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-stone-600 pt-1">
                <div className="p-1.5 bg-white rounded-md border border-sky-200/60">
                  <span className="block font-bold text-stone-800">
                    {statusData?.channelBreakdown?.SMS?.SENT || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Sent</span>
                </div>
                <div className="p-1.5 bg-white rounded-md border border-sky-200/60">
                  <span className="block font-bold text-emerald-700">
                    {statusData?.channelBreakdown?.SMS?.DELIVERED || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Delivered</span>
                </div>
                <div className="p-1.5 bg-white rounded-md border border-sky-200/60">
                  <span className="block font-bold text-rose-700">
                    {statusData?.channelBreakdown?.SMS?.FAILED || 0}
                  </span>
                  <span className="text-[10px] text-stone-400">Failed</span>
                </div>
              </div>

              {(statusData?.channelBreakdown?.SMS?.FAILED || 0) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs border-sky-300 text-sky-800"
                  isLoading={retrying}
                  onClick={() => handleRetryFailed('SMS')}
                >
                  Retry Failed SMS Only
                </Button>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </Button>

            <div className="flex items-center gap-3">
              {counts.failed > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={retrying}
                  onClick={() => handleRetryFailed()}
                >
                  Retry All Failed ({counts.failed})
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => navigate(`/history?batch_id=${batchId}`)}
                className="gap-1.5"
              >
                <span>View Detailed Logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
