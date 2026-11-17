import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { ChartIcon, ChatIcon, UserIcon, BellIcon } from '../components/Icons';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.reports.getOverview(),
  });

  const actions = [
    {
      label: 'Upload Marks',
      Icon: ChartIcon,
      onClick: () => navigate('/upload'),
      hint: 'New Excel marksheet',
    },
    {
      label: 'Batches History',
      Icon: BellIcon,
      onClick: () => navigate('/history'),
      hint: 'Live parent delivery',
    },
    {
      label: 'Subject Analytics',
      Icon: BookOpen,
      onClick: () => navigate('/subject-marks'),
      hint: 'Internal score weightage',
    },
    {
      label: 'System Settings',
      Icon: UserIcon,
      onClick: () => navigate('/settings'),
      hint: 'Branding & preferences',
    },
  ];

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#7A1A2C] block">
            Faculty Examination Portal
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 leading-tight mt-0.5">
            Welcome, {user?.full_name || 'Faculty Member'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <p className="text-xs text-stone-500 font-medium">
              {user?.department || 'Department of Information Technology'} · V.S.B. Engineering College
            </p>
            {user?.mobile_number && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Mobile Synced: +91 {user.mobile_number}</span>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/upload')}
          className="min-h-[46px] shadow-xs border-2 border-[#7A1A2C] bg-white hover:bg-[#fdf2f4] text-[#7A1A2C] px-5 rounded-xl flex items-center gap-2 font-bold text-sm cursor-pointer transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#7A1A2C]" />
          <span>Upload Exam Marks</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Clean Pure White Hero Banner Card */}
      <div className="rounded-2xl p-6 sm:p-7 bg-white border border-stone-200/90 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf2f4] text-[#7A1A2C] text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7A1A2C]" />
              <span>Institution Dispatch Overview</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-5xl sm:text-6xl font-bold leading-none text-[#7A1A2C]">
                {overview?.deliveryRate ?? 100}%
              </span>
              <span className="text-sm sm:text-base text-stone-600 font-sans font-semibold">
                Confirmed Parent Delivery Rate
              </span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-stone-500 max-w-lg leading-relaxed">
              Automated parent alerts dispatched via official WhatsApp Business API and DLT-approved SMS gateways for internal examination marks.
            </p>
          </div>

          {/* Quick Metrics Sub-Cards */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-stone-50/80 p-4 rounded-xl border border-stone-200/80 min-w-[130px]">
              <span className="text-[11px] text-[#7A1A2C] uppercase tracking-wider block font-bold">
                WhatsApp Sent
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-display text-stone-900 mt-0.5 block">
                {overview?.whatsappSent ?? 0}
              </span>
              <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Delivered to parents</span>
            </div>
            <div className="bg-stone-50/80 p-4 rounded-xl border border-stone-200/80 min-w-[130px]">
              <span className="text-[11px] text-[#7A1A2C] uppercase tracking-wider block font-bold">
                SMS Delivered
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-display text-stone-900 mt-0.5 block">
                {overview?.smsSent ?? 0}
              </span>
              <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">DLT gateway sent</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Action Cards Grid: Pure White Cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">
          Quick Actions & Assessment Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {actions.map(({ label, Icon, onClick, hint }) => (
            <button
              key={label}
              onClick={onClick}
              className="min-h-[80px] rounded-xl bg-white border border-stone-200/90 p-4 text-center hover:border-[#7A1A2C] hover:shadow-md transition-all flex flex-col items-center justify-center cursor-pointer group shadow-xs"
            >
              <span className="w-10 h-10 rounded-full bg-[#fdf2f4] text-[#7A1A2C] group-hover:bg-[#7A1A2C] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                <Icon />
              </span>
              <span className="block mt-2.5 text-xs font-bold text-stone-900 group-hover:text-[#7A1A2C] transition-colors">{label}</span>
              <span className="text-[11px] text-stone-500 block mt-0.5">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Batches List: Clean White Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Recent Internal Marks Batches
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Review uploaded student spreadsheets and live dispatch status
            </p>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-xs font-bold text-[#7A1A2C] hover:text-[#5c1321] flex items-center gap-1 min-h-[44px] px-2.5 py-1 rounded-lg hover:bg-[#fdf2f4] transition-colors cursor-pointer"
          >
            <span>View All Batches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-stone-400 text-xs">
            <div className="w-6 h-6 border-2 border-[#7A1A2C] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading recent examination records...
          </div>
        ) : !overview?.recentBatches || overview.recentBatches.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-700">No marks batches uploaded yet</p>
            <p className="text-[11px] text-stone-400 mt-1">Upload your first spreadsheet to start parent alerts.</p>
            <button
              onClick={() => navigate('/upload')}
              className="mt-4 min-h-[44px] px-4 py-2 bg-[#7A1A2C] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-[#631524] transition-colors"
            >
              Upload Marks Sheet
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {overview.recentBatches.map(m => {
              const code = m.exam_name.includes('II') || m.exam_name.includes('2') ? 'I2' : 'I1';
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (m.batch_status === 'DRAFT' || m.batch_status === 'VALIDATED') {
                      navigate(`/batches/${m.id}/review`);
                    } else {
                      navigate(`/batches/${m.id}/progress`);
                    }
                  }}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80 hover:border-[#7A1A2C] hover:bg-white transition-all cursor-pointer min-h-[56px] shadow-2xs hover:shadow-xs"
                >
                  <span className="w-11 h-11 rounded-lg bg-[#7A1A2C] text-[#F6C84C] text-[13px] font-bold flex items-center justify-center shrink-0">
                    {code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-stone-900 truncate">
                      {m.exam_name}
                    </span>
                    <span className="block mt-0.5 text-xs text-stone-500 truncate">
                      {m.class_name || m.department || 'Department Evaluation'} · {m.valid_records || m.total_records} students
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(m.batch_status)}>
                      {m.batch_status}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
