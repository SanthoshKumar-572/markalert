import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Users,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'classes' | 'analytics'>('students');
  const [studentReport, setStudentReport] = useState<any[]>([]);
  const [classReport, setClassReport] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examList, classRpt, analyticsData] = await Promise.all([
        api.academic.getExams(),
        api.reports.getClassReport(),
        api.reports.getNotificationAnalytics()
      ]);
      setExams(examList);
      if (examList.length > 0 && !selectedExamId) {
        setSelectedExamId(examList[0].id);
      }
      setClassReport(classRpt);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentReport = async () => {
    if (!selectedExamId) return;
    setLoading(true);
    try {
      const data = await api.reports.getStudentReport({ exam_id: selectedExamId, search });
      setStudentReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) loadStudentReport();
  }, [selectedExamId]);

  const downloadCSV = () => {
    const headers = ['Register No', 'Student Name', 'Department', 'Exam', 'Marks', 'Total', 'Max', 'Percentage', 'Notification Status'];
    const rows = studentReport.map(r => [
      r.register_number, r.student_name, r.department_name, r.exam_name,
      r.marks_summary, r.total_obtained, r.total_max, r.percentage, r.notification_status || 'N/A'
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_marks_report_${selectedExamId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute channel stats from analytics
  const channelStats = analytics?.channelStats || [];
  const totalWA = channelStats.filter((s: any) => s.channel === 'WHATSAPP').reduce((acc: number, s: any) => acc + Number(s.count), 0);
  const totalSMS = channelStats.filter((s: any) => s.channel === 'SMS').reduce((acc: number, s: any) => acc + Number(s.count), 0);
  const deliveredWA = channelStats.filter((s: any) => s.channel === 'WHATSAPP' && (s.status === 'DELIVERED' || s.status === 'SENT')).reduce((acc: number, s: any) => acc + Number(s.count), 0);
  const failedTotal = channelStats.filter((s: any) => s.status === 'FAILED').reduce((acc: number, s: any) => acc + Number(s.count), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100">
            <BarChart3 className="w-5 h-5 text-maroon-700" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">
              Reports & Performance Analytics
            </h2>
            <p className="text-xs text-[#7A6A63] mt-0.5">
              Comprehensive student marks and parent notification delivery performance reports.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-[#FBF7F2] border border-[#EADFD3] rounded-xl">
          {(['students', 'classes', 'analytics'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-[#7A6A63] hover:text-[#2B1B1B]'
              }`}
            >
              {tab === 'analytics' ? 'Notification Analytics' : `${tab.charAt(0).toUpperCase() + tab.slice(1)} Report`}
            </button>
          ))}
        </div>
      </div>

      {/* Student Report */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-[#EADFD3] text-xs font-medium bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700"
              >
                {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadStudentReport()}
                placeholder="Search student or register no..."
                className="px-3.5 py-2 rounded-xl border border-[#EADFD3] text-xs font-sans bg-[#FBF7F2] text-[#2B1B1B] placeholder-[#7A6A63]/60 focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 w-56"
              />
              <button
                onClick={loadStudentReport}
                title="Refresh report"
                className="p-2 rounded-xl bg-white border border-[#EADFD3] text-[#7A6A63] hover:text-maroon-700 hover:bg-[#FBF7F2] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={downloadCSV}
              disabled={studentReport.length === 0}
              className="px-4 py-2 rounded-xl bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 border border-maroon-900/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FBF7F2] border-b border-[#EADFD3] text-[#7A6A63] font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Register No</th>
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Marks Summary</th>
                    <th className="py-3.5 px-4 text-center">Total</th>
                    <th className="py-3.5 px-4 text-center">%</th>
                    <th className="py-3.5 px-4">Notification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EADFD3]/60 font-medium">
                  {loading ? (
                    <tr><td colSpan={7} className="py-12 text-center"><div className="w-7 h-7 border-3 border-maroon-700 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                  ) : studentReport.length > 0 ? (
                    studentReport.map((r, i) => (
                      <tr key={i} className="hover:bg-[#FBF7F2]/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#2B1B1B] font-mono">{r.register_number}</td>
                        <td className="py-3 px-4 text-[#2B1B1B] font-medium">{r.student_name}</td>
                        <td className="py-3 px-4 text-[#7A6A63]">{r.department_name}</td>
                        <td className="py-3 px-4 text-[#2B1B1B] max-w-xs truncate" title={r.marks_summary}>{r.marks_summary}</td>
                        <td className="py-3 px-4 text-center font-bold text-[#2B1B1B] font-mono">{r.total_obtained}/{r.total_max}</td>
                        <td className={`py-3 px-4 text-center font-bold font-mono ${r.percentage >= 75 ? 'text-emerald-700' : r.percentage >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {r.percentage}%
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            r.notification_status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            r.notification_status === 'SENT' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                            r.notification_status === 'FAILED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                            'bg-[#FBF7F2] text-[#7A6A63] border border-[#EADFD3]'
                          }`}>
                            {r.notification_status || 'Not sent'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="py-12 text-center text-[#7A6A63] text-xs">No marks data found for this exam. Upload an Excel file first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Class Report */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-3 py-16 text-center"><div className="w-8 h-8 border-4 border-maroon-700 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
          ) : classReport.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs p-5 space-y-4 hover:border-maroon-700/40 transition-all">
              <div className="pb-3 border-b border-[#EADFD3]">
                <div className="text-[11px] font-bold text-maroon-700 uppercase tracking-wider">{c.department_code} Department</div>
                <h3 className="text-base font-bold font-serif text-[#2B1B1B] mt-0.5">Year {c.year} — Section {c.section}</h3>
                <div className="text-xs text-[#7A6A63]">{c.academic_year}</div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#FBF7F2] rounded-xl p-3 border border-[#EADFD3]/60">
                  <div className="text-[#7A6A63] text-[10px] uppercase font-bold tracking-wider">Students</div>
                  <div className="font-bold text-[#2B1B1B] text-lg mt-0.5 font-mono">{c.total_students}</div>
                </div>
                <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/50">
                  <div className="text-amber-800 text-[10px] uppercase font-bold tracking-wider">Marks Import</div>
                  <div className="font-bold text-amber-900 text-lg mt-0.5 font-mono">{c.marks_imported_students}</div>
                </div>
                <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/50">
                  <div className="text-emerald-800 text-[10px] uppercase font-bold tracking-wider">Delivered</div>
                  <div className="font-bold text-emerald-900 text-lg mt-0.5 font-mono">{c.delivered}</div>
                </div>
                <div className="bg-rose-50/60 rounded-xl p-3 border border-rose-200/50">
                  <div className="text-rose-800 text-[10px] uppercase font-bold tracking-wider">Failed</div>
                  <div className="font-bold text-rose-900 text-lg mt-0.5 font-mono">{c.failed}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notification Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#EADFD3] shadow-xs">
              <div className="text-xs font-semibold text-[#7A6A63] uppercase tracking-wider">WhatsApp Total</div>
              <div className="text-2xl font-bold font-mono text-[#2B1B1B] mt-1.5">{totalWA}</div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">Via Meta Cloud API</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#EADFD3] shadow-xs">
              <div className="text-xs font-semibold text-[#7A6A63] uppercase tracking-wider">SMS Total</div>
              <div className="text-2xl font-bold font-mono text-[#2B1B1B] mt-1.5">{totalSMS}</div>
              <div className="text-[11px] text-amber-700 mt-1 font-medium">Via DLT Gateway</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#EADFD3] shadow-xs">
              <div className="text-xs font-semibold text-[#7A6A63] uppercase tracking-wider">WA Delivered</div>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-1.5">{deliveredWA}</div>
              <div className="text-[11px] text-[#7A6A63] mt-1">Confirmed delivery</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-[#EADFD3] shadow-xs">
              <div className="text-xs font-semibold text-[#7A6A63] uppercase tracking-wider">Total Failed</div>
              <div className="text-2xl font-bold font-mono text-rose-700 mt-1.5">{failedTotal}</div>
              <div className="text-[11px] text-rose-600 mt-1">Across all channels</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs p-6">
            <h3 className="text-base font-bold font-serif text-[#2B1B1B] mb-4">Delivery Status Breakdown by Channel</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FBF7F2] text-[#7A6A63] font-semibold border-b border-[#EADFD3]">
                  <tr>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Count</th>
                    <th className="py-3 px-4">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EADFD3]/60 font-medium">
                  {channelStats.map((s: any, i: number) => {
                    const total = s.channel === 'WHATSAPP' ? totalWA : totalSMS;
                    const share = total > 0 ? ((Number(s.count) / total) * 100).toFixed(1) : '0';
                    return (
                      <tr key={i} className="hover:bg-[#FBF7F2]/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            s.channel === 'WHATSAPP' ? 'bg-[#25D366]/10 text-emerald-800 border border-[#25D366]/30' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>{s.channel}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-bold ${
                            s.status === 'DELIVERED' ? 'text-emerald-700' :
                            s.status === 'FAILED' ? 'text-rose-700' : 'text-[#7A6A63]'
                          }`}>{s.status}</span>
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-[#2B1B1B]">{s.count}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-28 bg-[#FBF7F2] rounded-full h-2 overflow-hidden border border-[#EADFD3]">
                              <div className="bg-maroon-700 h-2 rounded-full" style={{ width: `${share}%` }}></div>
                            </div>
                            <span className="text-[#7A6A63] font-mono text-[11px]">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
