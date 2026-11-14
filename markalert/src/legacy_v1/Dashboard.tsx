import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Send,
  History,
  BarChart3,
  RotateCcw,
  Clock,
  ArrowUpRight,
  Sparkles,
  FileSpreadsheet,
  CheckCheck,
  BookOpen,
  Plus,
  GraduationCap,
  Layers,
  UserCheck,
  Shield,
  ExternalLink,
  PhoneCall
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, User, ClassItem } from '../types';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  user?: User | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, user }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const currentUser = user || api.auth.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = async () => {
    try {
      const [statsData, classesData] = await Promise.all([
        api.reports.getDashboardStats(),
        api.academic.getMyClasses().catch(() => [])
      ]);
      setStats(statsData);
      setAssignedClasses(classesData || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryAll = async () => {
    setRetrying(true);
    try {
      const res = await api.notifications.retryAllFailed();
      setActionMessage(`Retried ${res.data.retried} failed notifications (${res.data.successful} recovered).`);
      await loadData();
    } catch (err: any) {
      setActionMessage(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const successRate = stats && stats.notificationsSent > 0
    ? Math.round((stats.deliveredCount / stats.notificationsSent) * 100)
    : 100;

  return (
    <div className="space-y-8">
      {/* Dashboard Title Header */}
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#2B1B1B] tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[#7A6A63] font-medium">
          Internal examination marks & parent notification overview.
        </p>
      </div>

      {/* Alert banner if there are failed notifications */}
      {stats && stats.failedCount > 0 && (
        <div className="p-4 rounded-3xl bg-[#FBF7F2] border border-[#D97706]/40 text-[#2B1B1B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D97706]/15 border border-[#D97706]/30 flex items-center justify-center text-[#D97706] shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#D97706]" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#2B1B1B] font-display">Action Required: {stats.failedCount} Notifications Failed</div>
              <div className="text-xs text-[#7A6A63]">Some parent messages could not be delivered. Click to retry all failed dispatches.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetryAll}
              disabled={retrying}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2d0811] text-[#fff3b8] text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 border border-[#C08A16]/30"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-[#F6C84C] ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Retrying...' : 'Retry All Failed'}</span>
            </button>
            <button
              onClick={() => onNavigate('notifications')}
              className="px-3.5 py-2 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold transition-colors shadow-xs"
            >
              View Logs
            </button>
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-[#FBF7F2] border border-[#2E7D32]/30 text-[#2B1B1B] text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-[#7A6A63] hover:text-[#2B1B1B] text-xs font-bold">✕</button>
        </div>
      )}

      {/* Row 1: 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Students */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs hover:border-[#C08A16]/50 hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7A1A2C] to-[#4A101E] flex items-center justify-center text-white shadow-sm border border-[#C08A16]/30">
              <Users className="w-5 h-5 text-[#fff3b8]" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#7A1A2C] bg-[#7A1A2C]/10 px-2 py-0.5 rounded-full border border-[#7A1A2C]/20">
              Active Roster
            </span>
          </div>
          <div>
            <div className="text-3xl font-heading font-extrabold text-[#2B1B1B] tracking-tight">
              {stats?.studentsCount ?? 0}
            </div>
            <div className="text-xs text-[#7A6A63] font-semibold tracking-wide mt-0.5">
              Total Students
            </div>
          </div>
        </div>

        {/* Card 2: Marks Uploaded */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs hover:border-[#C08A16]/50 hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C08A16] to-[#7a5209] flex items-center justify-center text-white shadow-sm border border-[#F6C84C]/40">
              <FileSpreadsheet className="w-5 h-5 text-[#fff3b8]" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#C08A16] bg-[#FEF9C3] px-2 py-0.5 rounded-full border border-[#C08A16]/30">
              Assessments
            </span>
          </div>
          <div>
            <div className="text-3xl font-heading font-extrabold text-[#2B1B1B] tracking-tight">
              {stats?.marksCount ?? 0}
            </div>
            <div className="text-xs text-[#7A6A63] font-semibold tracking-wide mt-0.5">
              Marks Uploaded
            </div>
          </div>
        </div>

        {/* Card 3: Notifications Delivered */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs hover:border-[#C08A16]/50 hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E7D32] to-[#1b5e20] flex items-center justify-center text-white shadow-sm">
              <CheckCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#2E7D32] bg-[#2E7D32]/10 px-2 py-0.5 rounded-full border border-[#2E7D32]/20">
              {stats && stats.notificationsSent > 0 ? `${successRate}% Success` : '100% Verified'}
            </span>
          </div>
          <div>
            <div className="text-3xl font-heading font-extrabold text-[#2B1B1B] tracking-tight">
              {stats?.deliveredCount ?? 0}
            </div>
            <div className="text-xs text-[#7A6A63] font-semibold tracking-wide mt-0.5">
              Notifications Delivered
            </div>
          </div>
        </div>

        {/* Card 4: Notifications Pending */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs hover:border-[#C08A16]/50 hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D97706] to-[#92400e] flex items-center justify-center text-white shadow-sm">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#D97706] bg-[#FEF9C3] px-2 py-0.5 rounded-full border border-[#D97706]/30">
              Queue Status
            </span>
          </div>
          <div>
            <div className="text-3xl font-heading font-extrabold text-[#2B1B1B] tracking-tight">
              {stats?.pendingCount ?? Math.max(0, (stats?.notificationsSent ?? 0) - (stats?.deliveredCount ?? 0) - (stats?.failedCount ?? 0))}
            </div>
            <div className="text-xs text-[#7A6A63] font-semibold tracking-wide mt-0.5">
              Notifications Pending
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Quick Action Shortcuts */}
      <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C08A16]" />
            <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Faculty Quick Actions</h3>
          </div>
          <span className="text-[11px] text-[#7A6A63]">Common workflow shortcuts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('upload')}
            className="p-3.5 rounded-xl border border-[#EADFD3] bg-[#FBF7F2] hover:bg-white hover:border-[#7A1A2C] transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#7A1A2C] text-[#fff3b8] flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#2B1B1B] group-hover:text-[#7A1A2C] transition-colors">Notify Wizard</div>
                <div className="text-[10px] text-[#7A6A63]">Upload & Send marks</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#7A6A63] group-hover:text-[#7A1A2C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="p-3.5 rounded-xl border border-[#EADFD3] bg-[#FBF7F2] hover:bg-white hover:border-[#7A1A2C] transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#4A101E] text-white flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#2B1B1B] group-hover:text-[#7A1A2C] transition-colors">Student Roster</div>
                <div className="text-[10px] text-[#7A6A63]">Manage student records</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#7A6A63] group-hover:text-[#7A1A2C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('templates')}
            className="p-3.5 rounded-xl border border-[#EADFD3] bg-[#FBF7F2] hover:bg-white hover:border-[#7A1A2C] transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C08A16] text-[#2B1B1B] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#2B1B1B] group-hover:text-[#7A1A2C] transition-colors">Templates</div>
                <div className="text-[10px] text-[#7A6A63]">SMS & WhatsApp formats</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#7A6A63] group-hover:text-[#7A1A2C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate('notifications')}
            className="p-3.5 rounded-xl border border-[#EADFD3] bg-[#FBF7F2] hover:bg-white hover:border-[#7A1A2C] transition-all text-left group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2E7D32] text-white flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#2B1B1B] group-hover:text-[#7A1A2C] transition-colors">Dispatch Logs</div>
                <div className="text-[10px] text-[#7A6A63]">Delivery status & audit</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#7A6A63] group-hover:text-[#7A1A2C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Row 3: Recent Activity & Delivery Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Recent Notification Batches & Upload Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Notification Dispatches */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#7A1A2C]" />
                <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Recent Notification Dispatches</h3>
              </div>
              <button
                onClick={() => onNavigate('notifications')}
                className="text-xs font-semibold text-[#7A1A2C] hover:text-[#C08A16] transition-colors"
              >
                View all logs →
              </button>
            </div>

            {stats?.recentBatches && stats.recentBatches.length > 0 ? (
              <div className="divide-y divide-[#F3ECE4]">
                {stats.recentBatches.map((batch: any) => (
                  <div key={batch.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#2B1B1B]">{batch.exam_name || 'Internal Assessment Exam'}</div>
                      <div className="text-[11px] text-[#7A6A63] mt-0.5 font-mono">
                        By {batch.created_by_name || 'Faculty'} • {new Date(batch.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/20">
                        {batch.successful_notifications || 0} / {batch.total_notifications || 0} Delivered
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#7A6A63] border border-dashed border-[#EADFD3] rounded-xl">
                No notification dispatches yet. Use the Notify Wizard to send marks.
              </div>
            )}
          </div>

          {/* Assigned Classes Quick List */}
          {assignedClasses && assignedClasses.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#7A1A2C]" />
                  <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Your Assigned Classes</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FBF7F2] text-[#7A1A2C] border border-[#EADFD3] text-[11px] font-mono font-bold">
                  {assignedClasses.length} {assignedClasses.length === 1 ? 'Class' : 'Classes'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedClasses.map((cls) => (
                  <div
                    key={cls.id}
                    onClick={() => onNavigate('students')}
                    className="p-3.5 rounded-xl bg-[#FBF7F2] hover:bg-white border border-[#EADFD3] hover:border-[#C08A16] transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#2B1B1B] group-hover:text-[#7A1A2C] transition-colors">{cls.name}</div>
                      <div className="text-[10px] text-[#7A6A63] mt-0.5">{cls.department_name || cls.department_code || 'IT'} • Semester {cls.semester || '5'}</div>
                    </div>
                    <div className="text-xs font-mono font-bold text-[#7A1A2C] group-hover:text-[#C08A16] transition-colors">
                      {cls.student_count || 0} students →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Delivery Status & System Health */}
        <div className="space-y-6">
          {/* Delivery Status Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFD3] shadow-xs space-y-4">
            <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Delivery Overview</h3>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#2B1B1B]">Delivered Messages</span>
                  <span className="text-[#2E7D32] font-mono font-bold">{stats?.deliveredCount ?? 0}</span>
                </div>
                <div className="w-full h-2 bg-[#F5EFE8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2E7D32] rounded-full transition-all duration-300"
                    style={{
                      width: `${stats && stats.notificationsSent > 0 ? (stats.deliveredCount / stats.notificationsSent) * 100 : 100}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#2B1B1B]">Pending in Queue</span>
                  <span className="text-[#D97706] font-mono font-bold">
                    {stats?.pendingCount ?? Math.max(0, (stats?.notificationsSent ?? 0) - (stats?.deliveredCount ?? 0) - (stats?.failedCount ?? 0))}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F5EFE8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D97706] rounded-full transition-all duration-300"
                    style={{
                      width: `${stats && stats.notificationsSent > 0 ? ((stats.pendingCount || 0) / stats.notificationsSent) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#2B1B1B]">Failed Dispatches</span>
                  <span className="text-[#C62828] font-mono font-bold">{stats?.failedCount ?? 0}</span>
                </div>
                <div className="w-full h-2 bg-[#F5EFE8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C62828] rounded-full transition-all duration-300"
                    style={{
                      width: `${stats && stats.notificationsSent > 0 ? (stats.failedCount / stats.notificationsSent) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F3ECE4] text-[11px] text-[#7A6A63] flex items-center justify-between">
              <span>Overall Delivery Rate</span>
              <span className="font-mono font-bold text-[#2B1B1B]">{successRate}%</span>
            </div>
          </div>

          {/* Academic Portal Notice Card */}
          <div className="bg-gradient-to-br from-[#7A1A2C] to-[#4A101E] rounded-2xl p-5 text-white border border-[#C08A16]/30 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F6C84C]" />
              <span className="text-xs font-bold text-[#F6C84C] uppercase tracking-wider">VSB College Notice</span>
            </div>
            <p className="text-xs text-white/90 leading-relaxed">
              Internal Assessment II mark entries must be finalized and dispatched to parent phone numbers within 48 hours of test completion.
            </p>
            <div className="pt-2 border-t border-[#631524]">
              <button
                onClick={() => onNavigate('upload')}
                className="w-full py-2 px-3 rounded-xl bg-white text-[#7A1A2C] font-bold text-xs hover:bg-[#FBF7F2] transition-colors"
              >
                Start New Notification Flow
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

