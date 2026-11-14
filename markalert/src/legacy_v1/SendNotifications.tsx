import React, { useState, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Users,
  Eye,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  History,
  CheckCheck,
  FileText,
  Edit3,
  SlidersHorizontal,
  Save,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import { Exam, PreviewRow, MessagePreviewItem } from '../types';

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  bodyWhatsApp: string;
  bodySMS: string;
}

const BUILTIN_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'ia2_vsb_marks',
    name: '1. VSB Internal Assessment – II Marks (Official Template)',
    description: 'VSB College IA-II template with Register No, Department, Class, Subject 1-6 marks & results, Overall Result',
    bodyWhatsApp: `VSB ENGINEERING COLLEGE

Dear Parent of {student_name},

Internal Assessment – II Marks

Register No.: {register_number}
Department: {department}
Class: {class_name}

Subject-wise Marks (Out of 100):
• {subject1_name}: {subject1_marks}/100 – {subject1_result}
• {subject2_name}: {subject2_marks}/100 – {subject2_result}
• {subject3_name}: {subject3_marks}/100 – {subject3_result}
• {subject4_name}: {subject4_marks}/100 – {subject4_result}
• {subject5_name}: {subject5_marks}/100 – {subject5_result}
• {subject6_name}: {subject6_marks}/100 – {subject6_result}

Overall Result: {overall_result}

Regards,
VSB Engineering College`,
    bodySMS: `VSB ENGINEERING COLLEGE: Dear Parent of {student_name}, Register No: {register_number}, Dept: {department}, Class: {class_name}. IA-II Marks: {subject1_name}: {subject1_marks} ({subject1_result}), {subject2_name}: {subject2_marks} ({subject2_result}), {subject3_name}: {subject3_marks} ({subject3_result}), {subject4_name}: {subject4_marks} ({subject4_result}), {subject5_name}: {subject5_marks} ({subject5_result}), {subject6_name}: {subject6_marks} ({subject6_result}). Overall Result: {overall_result}. Regards, VSB Engineering College`
  },
  {
    id: 'marks_report',
    name: '2. Internal Marks Report (Each Subject Breakdown)',
    description: 'Dear {parent_name}, {exam_name} marks of your ward, Student, Register No, Subject list, Total & Percentage',
    bodyWhatsApp: `Dear {parent_name},

{exam_name} marks of your ward:

Student: {student_name}
Register No: {register_number}

{marks}

Total: {total}/{maximum_marks}
Percentage: {percentage}%

Regards,
{college_name}`,
    bodySMS: `Dear {parent_name}, {exam_name} marks of your ward: Student: {student_name}, Register No: {register_number}\n{marks}\nTotal: {total}/{maximum_marks}\nPercentage: {percentage}%\nRegards, {college_name}`
  },
  {
    id: 'holiday_notice',
    name: '3. General Notice / Holiday & Circular Announcement',
    description: 'Direct communication for holidays, college reopenings, parent meetings & general notices',
    bodyWhatsApp: `Dear {parent_name},

Greetings from {college_name}.

📢 Important Announcement / Holiday Notice:

Student: {student_name}
Register No: {register_number}

Circular Details:
{notice_message}

Kindly take note of the schedule. For any queries, please contact the class faculty advisor.

Warm regards,
Department of Information Technology,
{college_name}`,
    bodySMS: `Notice from {college_name}: Dear Parent of {student_name} (Register No: {register_number}): {notice_message}. Regards, {college_name}`
  }
];

interface SendNotificationsProps {
  initialExamId?: string;
  initialRows?: PreviewRow[];
  initialFileName?: string;
  initialUploadId?: string;
  onNavigateBack?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToHistory: () => void;
  onNavigateToWhatsAppDevice?: () => void;
}

export const SendNotifications: React.FC<SendNotificationsProps> = ({
  initialExamId,
  initialRows,
  initialFileName,
  initialUploadId,
  onNavigateBack,
  onNavigateToDashboard,
  onNavigateToHistory,
  onNavigateToWhatsAppDevice
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'BOTH'>('WHATSAPP');
  const [whatsappSenderType, setWhatsappSenderType] = useState<'PERSONAL' | 'CENTRAL'>('PERSONAL');
  const [waSession, setWaSession] = useState<{
    status: string;
    phoneNumber?: string;
    pushName?: string;
  }>({ status: 'DISCONNECTED' });

  // Template State (Defaults to VSB Engineering College IA-II template)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ia2_vsb_marks');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [currentWhatsAppTemplate, setCurrentWhatsAppTemplate] = useState<string>(BUILTIN_TEMPLATES[0].bodyWhatsApp);
  const [currentSMSTemplate, setCurrentSMSTemplate] = useState<string>(BUILTIN_TEMPLATES[0].bodySMS);
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState<string | null>(null);

  // Preview State
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previews, setPreviews] = useState<MessagePreviewItem[]>([]);
  const [collegeName, setCollegeName] = useState<string>('VSB ENGINEERING COLLEGE');
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [forceResend, setForceResend] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  // Safety Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Sending & Real-time Progress State (Section 21)
  const [isSending, setIsSending] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    processed: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    percentage: number;
    status: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExams();
    loadWhatsAppSession();
  }, []);

  const loadWhatsAppSession = async () => {
    try {
      const res = await api.whatsappSession.getStatus();
      setWaSession(res);
      if (res.status !== 'CONNECTED') {
        // If not connected, default to PERSONAL still, but show link prompt
      }
    } catch (err) {
      console.error('Failed to load WhatsApp session:', err);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadPreviews();
    }
  }, [selectedExamId]);

  // Countdown state for automatic redirection to Dashboard
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Polling for live batch progress during sending
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isSending && batchId) {
      interval = setInterval(async () => {
        try {
          const progress = await api.notifications.getBatchProgress(batchId);
          setBatchProgress(progress);
          if (progress.status === 'COMPLETED' || progress.status === 'PARTIAL' || progress.status === 'FAILED') {
            setIsSending(false);
            if (interval) clearInterval(interval);
            if (progress.status === 'COMPLETED' && onNavigateToDashboard) {
              setRedirectCountdown(3);
            }
          }
        } catch (err) {
          console.error('Error fetching progress:', err);
        }
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSending, batchId, onNavigateToDashboard]);

  // Countdown timer to navigate to Dashboard after completion
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      if (onNavigateToDashboard) {
        onNavigateToDashboard();
      }
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, onNavigateToDashboard]);

  const loadExams = async () => {
    try {
      const list = await api.academic.getExams();
      setExams(list);
      if (!selectedExamId && list.length > 0) {
        setSelectedExamId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPreviews = async () => {
    if (!selectedExamId) return;
    setLoadingPreview(true);
    setError(null);
    try {
      // If we have rows from the recent upload, use those; otherwise let backend pull by exam
      const recordsToPreview = initialRows && initialRows.length > 0
        ? initialRows.map(r => ({
            registerNumber: r.registerNumber,
            studentName: r.studentName,
            parentMobile: r.parentMobileRaw || '',
            marks: r.marks,
            totalMarks: r.totalMarks,
            maxMarks: r.maxMarks,
            percentage: r.percentage,
            studentId: r.studentId
          }))
        : undefined;

      const res = await api.notifications.preview(selectedExamId, recordsToPreview || []);
      setPreviews(res.previews);
      setCollegeName(res.collegeName);
      setDuplicateCount(res.duplicateCount);
      setSelectedPreviewIndex(0);
    } catch (err: any) {
      setError(err.message || 'Failed to generate preview messages.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const renderCustomMessage = (templateStr: string, item: MessagePreviewItem) => {
    let marksText = '';
    const subjectList: Array<{ name: string; marks: number | string; maxMarks: number | string; result: string }> = [];

    if (item.marks) {
      if (Array.isArray(item.marks)) {
        marksText = item.marks.map((m: any) => `• ${m.subjectCode || m.subjectName || m.subject}: ${m.marksObtained ?? m.marks}/${m.maximumMarks ?? m.maxMarks ?? 100}`).join('\n');
        item.marks.forEach((m: any) => {
          const sName = m.subjectCode || m.subjectName || m.subject || '';
          const sMarks = m.marksObtained ?? m.marks ?? 0;
          const sMax = m.maximumMarks ?? m.maxMarks ?? 100;
          const sRes = Number(sMarks) >= 50 ? 'Pass' : 'Fail';
          subjectList.push({ name: sName, marks: sMarks, maxMarks: sMax, result: sRes });
        });
      } else if (typeof item.marks === 'object') {
        marksText = Object.entries(item.marks).map(([k, v]) => `• ${k}: ${v}/100`).join('\n');
        Object.entries(item.marks).forEach(([k, v]) => {
          const sRes = Number(v) >= 50 ? 'Pass' : 'Fail';
          subjectList.push({ name: k, marks: v as any, maxMarks: 100, result: sRes });
        });
      } else {
        marksText = String(item.marks);
      }
    } else if (item.renderedWhatsApp && item.renderedWhatsApp.includes('Marks:')) {
      const parts = item.renderedWhatsApp.split('Marks:');
      if (parts[1]) {
        const lines = parts[1].split('Total:')[0].trim();
        if (lines) marksText = lines;
      }
    }

    if (subjectList.length === 0 && item.renderedWhatsApp) {
      const bulletMatches = item.renderedWhatsApp.match(/•\s*([^:\n]+):\s*(\d+)(?:\/\d+)?(?:\s*–\s*([^\n]+))?/g);
      if (bulletMatches) {
        bulletMatches.forEach(b => {
          const m = b.match(/•\s*([^:\n]+):\s*(\d+)(?:\/\d+)?(?:\s*–\s*([^\n]+))?/);
          if (m) {
            const sName = m[1].trim();
            const sMarks = Number(m[2]);
            const sRes = m[3] ? m[3].trim() : (sMarks >= 50 ? 'Pass' : 'Fail');
            subjectList.push({ name: sName, marks: sMarks, maxMarks: 100, result: sRes });
          }
        });
      }
    }

    if (!marksText) {
      marksText = '• Internal Assessment Score Recorded';
    }

    const currentExam = exams.find(e => e.id === selectedExamId);
    const examName = currentExam?.exam_name || 'Internal Assessment – II';

    const parentName = item.parentName || (item.studentName ? `${item.studentName}'s Parent` : 'Parent');
    const totalVal = Number(item.totalMarks ?? 0);
    const maxVal = Number(item.maxMarks ?? (subjectList.length > 0 ? subjectList.length * 100 : 600));
    const pct = item.percentage != null && !isNaN(Number(item.percentage)) && Number(item.percentage) > 0
      ? Number(item.percentage).toFixed(2)
      : (maxVal > 0 ? ((totalVal / maxVal) * 100).toFixed(2) : '0.00');

    const hasAnySubjectFail = subjectList.length > 0 && subjectList.some(s => Number(s.marks) < 50);
    const overallRes = String((item as any).overallResult || (item as any).overall_result || item.result || (hasAnySubjectFail ? 'FAIL' : (Number(pct) >= 50 ? 'PASS' : 'FAIL')));
    const dept = (item as any).department || 'Information Technology';
    const cls = (item as any).className || (item as any).class_name || item.classSection || 'IT-C';

    const subjectVars: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      const num = i + 1;
      const sub = subjectList[i];
      if (sub) {
        subjectVars[`subject${num}_name`] = sub.name;
        subjectVars[`subject${num}_marks`] = String(sub.marks);
        subjectVars[`subject${num}_result`] = sub.result;
      } else {
        subjectVars[`subject${num}_name`] = '';
        subjectVars[`subject${num}_marks`] = '';
        subjectVars[`subject${num}_result`] = '';
      }
    }

    const vars: Record<string, string> = {
      parent_name: parentName,
      student_name: item.studentName || '',
      register_number: item.registerNumber || '',
      department: dept,
      class_name: cls,
      class_section: item.classSection || `${dept} - ${cls}`,
      exam_name: examName,
      marks: marksText,
      total: String(item.totalMarks ?? totalVal),
      maximum_marks: String(item.maxMarks ?? maxVal),
      percentage: pct,
      result: overallRes,
      overall_result: overallRes,
      college_name: collegeName || 'VSB ENGINEERING COLLEGE',
      notice_message: 'The college will remain closed tomorrow on account of Government Holiday. Regular academic sessions will resume on Monday.',
      ...subjectVars
    };

    let rendered = templateStr;
    Object.entries(vars).forEach(([key, val]) => {
      rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
    // Clean up empty bullet lines for missing subjects
    rendered = rendered.replace(/^•\s*:\s*\/100\s*–\s*.*$\n?/gm, '');
    rendered = rendered.replace(/^•\s*\{subject\d+_[^}]+\}:.*$\n?/gm, '');
    return rendered;
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const t = BUILTIN_TEMPLATES.find(x => x.id === templateId);
    if (t) {
      setCurrentWhatsAppTemplate(t.bodyWhatsApp);
      setCurrentSMSTemplate(t.bodySMS);
      setTemplateSavedFeedback(`Loaded template: ${t.name}`);
      setTimeout(() => setTemplateSavedFeedback(null), 3000);
    }
  };

  const insertVariableToWhatsApp = (variableKey: string) => {
    setCurrentWhatsAppTemplate(prev => prev + `{${variableKey}}`);
  };

  const insertVariableToSMS = (variableKey: string) => {
    setCurrentSMSTemplate(prev => prev + `{${variableKey}}`);
  };

  const handleStartSend = () => {
    if (previews.length === 0) {
      setError('No student records available for sending.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmAndSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);
    setError(null);

    try {
      const recordsPayload = previews.map(p => ({
        studentId: p.studentId,
        registerNumber: p.registerNumber,
        studentName: p.studentName,
        parentMobile: p.parentMobileRaw,
        renderedWhatsApp: renderCustomMessage(currentWhatsAppTemplate, p),
        renderedSMS: renderCustomMessage(currentSMSTemplate, p)
      }));

      const res = await api.notifications.sendBatch({
        examId: selectedExamId,
        uploadedFileId: initialUploadId,
        channel,
        whatsappSenderType,
        records: recordsPayload,
        forceResend
      });

      setBatchId(res.batchId);
      setBatchProgress({
        total: res.totalCreated,
        processed: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: res.totalCreated,
        percentage: 0,
        status: 'PROCESSING'
      });
    } catch (err: any) {
      setIsSending(false);
      setError(err.message || 'Failed to initialize notification batch.');
    }
  };

  const currentPreview = previews[selectedPreviewIndex];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="ai-glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Send className="w-5 h-5" />
            </div>
            <span>Marks Notification Dispatcher</span>
          </h2>
         
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
              title="Return to marks upload and verification"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Upload</span>
            </button>
          )}

          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            disabled={isSending}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.exam_name} ({e.academic_year})</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-900 text-xs font-medium flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Duplicate Prevention Alert (Section 23) */}
      {duplicateCount > 0 && !isSending && !batchProgress && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm backdrop-blur-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-bold text-sm font-display">Duplicate Notifications Detected</div>
              <div className="text-xs text-amber-800/90 mt-0.5 font-sans">
                {duplicateCount} student(s) in this batch have already received marks for this exam. To prevent duplicate spam, they will be skipped automatically unless you check below.
              </div>
              <label className="inline-flex items-center gap-2 mt-2.5 text-xs font-bold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceResend}
                  onChange={(e) => setForceResend(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Force resend marks to already-notified parents</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Live Notification Progress Bar (Section 21) */}
      {(isSending || (batchProgress && batchProgress.total > 0)) && (
        <div className="ai-glass-card rounded-3xl p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ${
                batchProgress?.status === 'COMPLETED' ? 'bg-gradient-to-br from-indigo-600 to-blue-600' : 'bg-gradient-to-br from-indigo-500 to-blue-500 animate-pulse'
              }`}>
                {batchProgress?.status === 'COMPLETED' ? <CheckCheck className="w-6 h-6" /> : <Send className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-display font-bold text-slate-900">
                  {batchProgress?.status === 'COMPLETED' ? 'Notification Batch Dispatched Successfully!' : 'Sending Notifications to Parents...'}
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  Channel: <span className="font-mono font-bold text-indigo-700">{channel}</span> • Active Queue Worker
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-3xl font-extrabold font-mono text-indigo-600">{batchProgress?.percentage || 0}%</span>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">DISPATCHED</div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
            <div
              className="bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-400 h-2.5 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${batchProgress?.percentage || 0}%` }}
            ></div>
          </div>

          {/* Real-time counters */}
          <div className="grid grid-cols-5 gap-2.5 text-center pt-2">
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-400">Total</div>
              <div className="text-lg font-mono font-black text-slate-800">{batchProgress?.total}</div>
            </div>
            <div className="bg-blue-50/80 p-2.5 rounded-2xl border border-blue-200/60 shadow-2xs">
              <div className="text-[10px] font-mono uppercase font-bold text-blue-500">Sent</div>
              <div className="text-lg font-mono font-black text-blue-700">{batchProgress?.sent}</div>
            </div>
            <div className="bg-indigo-50/80 p-2.5 rounded-2xl border border-indigo-200/60 shadow-2xs">
              <div className="text-[10px] font-mono uppercase font-bold text-indigo-500">Delivered</div>
              <div className="text-lg font-mono font-black text-indigo-700">{batchProgress?.delivered}</div>
            </div>
            <div className="bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200/60 shadow-2xs">
              <div className="text-[10px] font-mono uppercase font-bold text-rose-500">Failed</div>
              <div className="text-lg font-mono font-black text-rose-700">{batchProgress?.failed}</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70 shadow-2xs">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-400">Pending</div>
              <div className="text-lg font-mono font-black text-slate-600">{batchProgress?.pending}</div>
            </div>
          </div>

          {batchProgress?.status === 'COMPLETED' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-indigo-500/10 p-4.5 rounded-2xl border border-indigo-500/20">
              <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-950 font-display">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>
                  {redirectCountdown !== null && redirectCountdown > 0
                    ? `Dispatched successfully! Redirecting to Dashboard in ${redirectCountdown}s...`
                    : 'All notifications successfully delivered!'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateToDashboard && (
                  <button
                    onClick={onNavigateToDashboard}
                    className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                  >
                    <span>Go to Dashboard Now →</span>
                  </button>
                )}
                <button
                  onClick={onNavigateToHistory}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>View History</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Send Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Channel Selection & Batch Confirmation */}
        <div className="space-y-6">
          {/* Channel Selector (Section 11) */}
          <div className="ai-glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>1. Dispatch Channel</span>
            </h3>

            <div className="space-y-3">
              {/* WhatsApp Option */}
              <div
                onClick={() => setChannel('WHATSAPP')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                  channel === 'WHATSAPP'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300 bg-white/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs font-display text-slate-900">WhatsApp Business</div>
                    <div className="text-[11px] text-slate-500 font-sans">Official Meta Cloud API • Rich format</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  channel === 'WHATSAPP' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {channel === 'WHATSAPP' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>

              {/* SMS Option */}
              <div
                onClick={() => setChannel('SMS')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                  channel === 'SMS'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300 bg-white/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs font-display text-slate-900">SMS Gateway</div>
                    <div className="text-[11px] text-slate-500 font-sans">Indian DLT Registered Sender ID</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  channel === 'SMS' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {channel === 'SMS' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>

              {/* WhatsApp + SMS Option */}
              <div
                onClick={() => setChannel('BOTH')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${
                  channel === 'BOTH'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300 bg-white/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs font-display text-slate-900">WhatsApp + SMS (Both)</div>
                    <div className="text-[11px] text-slate-500 font-sans">Dual channel delivery guarantee</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  channel === 'BOTH' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {channel === 'BOTH' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Sender Source Selection (Faculty Personal vs Central Gateway) */}
          {(channel === 'WHATSAPP' || channel === 'BOTH') && (
            <div className="ai-glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                  2. Sender Identity
                </h3>
                {waSession.status === 'CONNECTED' ? (
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Linked
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    ⚪ Not Linked
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Personal WhatsApp Device Option */}
                <div
                  onClick={() => setWhatsappSenderType('PERSONAL')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    whatsappSenderType === 'PERSONAL'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white/70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs font-display text-slate-900">
                          My Personal WhatsApp
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {waSession.phoneNumber || 'Faculty Mobile Number'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 mt-1 rounded-full border flex items-center justify-center ${
                      whatsappSenderType === 'PERSONAL' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {whatsappSenderType === 'PERSONAL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 mt-2 font-sans leading-tight">
                    Class parents will receive messages directly from your linked personal number.
                  </p>

                  {waSession.status !== 'CONNECTED' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-[11px] text-amber-800 font-medium">Device not connected</span>
                      {onNavigateToWhatsAppDevice && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToWhatsAppDevice();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition active:scale-95"
                        >
                          Link QR →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* College Central Gateway Option */}
                <div
                  onClick={() => setWhatsappSenderType('CENTRAL')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    whatsappSenderType === 'CENTRAL'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs font-display text-slate-900">College Central Gateway</div>
                      <div className="text-[11px] text-slate-500 font-sans">Institutional Notification Server</div>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    whatsappSenderType === 'CENTRAL' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                  }`}>
                    {whatsappSenderType === 'CENTRAL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatch Summary Box */}
          <div className="ai-glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
              3. Batch Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Recipients:</span>
                <span className="font-mono font-bold text-slate-800">{previews.length} Parents</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Channel:</span>
                <span className="font-mono font-bold text-indigo-600">{channel}</span>
              </div>
              {(channel === 'WHATSAPP' || channel === 'BOTH') && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">WhatsApp Sender:</span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[160px]">
                    {whatsappSenderType === 'PERSONAL'
                      ? (waSession.phoneNumber ? `Personal (${waSession.phoneNumber})` : 'Personal Device')
                      : 'Central Gateway'}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Estimated Messages:</span>
                <span className="font-mono font-bold text-slate-900">
                  {channel === 'BOTH' ? previews.length * 2 : previews.length}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Gateway Mode:</span>
                <span className="font-bold text-indigo-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Active
                </span>
              </div>
            </div>

            {/* Template requirement warning if none selected */}
            {!selectedTemplateId && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-start gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Select a parent notification template to enable sending.</span>
              </div>
            )}

            <button
              onClick={handleStartSend}
              disabled={!selectedTemplateId || isSending || previews.length === 0}
              className={`w-full py-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                !selectedTemplateId
                  ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2d0811] text-[#fff3b8] hover:shadow-[#7A1A2C]/30 active:scale-95 border border-[#C08A16]/40 cursor-pointer'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{selectedTemplateId ? 'Send Marks Notifications' : '1. Choose a Template to Enable Send'}</span>
            </button>
          </div>
        </div>

        {/* Right 2 Columns: Live Message Preview & Template Customizer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection & Customization Box */}
          <div className={`ai-glass-card rounded-3xl p-6 space-y-4 transition-all ${
            !selectedTemplateId ? 'ring-2 ring-amber-400/60 border-amber-300' : ''
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FBF7F2] border border-[#EADFD3] text-[#7A1A2C] flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <span>Parent Message Template</span>
                    {!selectedTemplateId && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold uppercase">
                        Action Required
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Choose an official template below to format the marks notification and activate sending.
                  </p>
                </div>
              </div>

              {selectedTemplateId && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                      isEditingTemplate
                        ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-white shadow-md'
                        : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingTemplate ? 'Done Editing' : 'Edit Template'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Template Selector Pills (Official Templates) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {BUILTIN_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                      isSelected
                        ? 'border-[#7A1A2C] bg-[#FBF7F2] shadow-sm ring-2 ring-[#F6C84C]/40'
                        : 'border-[#EADFD3] hover:border-[#C08A16]/70 bg-white hover:bg-[#FBF7F2]/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-[#2B1B1B]">{tmpl.name}</div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-[#fff3b8] flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#7A6A63] mt-1 line-clamp-2">{tmpl.description}</div>
                  </button>
                );
              })}
            </div>

            {templateSavedFeedback && (
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{templateSavedFeedback}</span>
              </div>
            )}

            {/* In-Place Live Template Editor (Accordion) */}
            {isEditingTemplate && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Customize Message Template Text</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Live dynamic placeholders</span>
                </div>

                {/* Variable helper pills */}
                <div>
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-indigo-500" />
                    <span>Click variable to insert into template:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'student_name', label: '{student_name}' },
                      { key: 'register_number', label: '{register_number}' },
                      { key: 'department', label: '{department}' },
                      { key: 'class_name', label: '{class_name}' },
                      { key: 'overall_result', label: '{overall_result}' },
                      { key: 'subject1_name', label: '{subject1_name}' },
                      { key: 'subject1_marks', label: '{subject1_marks}' },
                      { key: 'subject1_result', label: '{subject1_result}' },
                      { key: 'marks', label: '{marks}' },
                      { key: 'total', label: '{total}' },
                      { key: 'maximum_marks', label: '{maximum_marks}' },
                      { key: 'percentage', label: '{percentage}' },
                      { key: 'college_name', label: '{college_name}' }
                    ].map(v => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => {
                          insertVariableToWhatsApp(v.key);
                          insertVariableToSMS(v.key);
                        }}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 text-[11px] font-mono font-bold transition-all shadow-2xs"
                      >
                        +{v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* WhatsApp & SMS Textareas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Body Text
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">Rich formatting enabled</span>
                    </label>
                    <textarea
                      value={currentWhatsAppTemplate}
                      onChange={(e) => setCurrentWhatsAppTemplate(e.target.value)}
                      rows={8}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-inner leading-relaxed"
                      placeholder="Enter WhatsApp template..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <Smartphone className="w-3.5 h-3.5" /> SMS Body Text
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">GSM 7-bit standard</span>
                    </label>
                    <textarea
                      value={currentSMSTemplate}
                      onChange={(e) => setCurrentSMSTemplate(e.target.value)}
                      rows={8}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-inner leading-relaxed"
                      placeholder="Enter SMS template..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Message Preview */}
          <div className="ai-glass-card rounded-3xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/70 gap-3">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>Personalized Message Live Preview</span>
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Shows exact text parents receive with dynamic marks and student details populated.
                </p>
              </div>

              {/* Student Preview Selector & Status */}
              {previews.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">Student:</span>
                  <select
                    value={selectedPreviewIndex}
                    onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white shadow-2xs"
                  >
                    {previews.map((p, idx) => (
                      <option key={idx} value={idx}>
                        {p.registerNumber} - {p.studentName}
                      </option>
                    ))}
                  </select>
                  {currentPreview && (
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-black uppercase ${
                      (currentPreview.result === 'PASS' || currentPreview.percentage >= 60)
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {currentPreview.result || (currentPreview.percentage >= 60 ? 'PASS' : 'FAIL')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {loadingPreview ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-4 border-[#7A1A2C] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : !selectedTemplateId ? (
              <div className="text-center py-16 px-4 bg-[#FBF7F2]/60 rounded-3xl border border-dashed border-[#C08A16]/50 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#C08A16]/15 text-[#7A1A2C] flex items-center justify-center mx-auto shadow-sm">
                  <FileText className="w-6 h-6 text-[#C08A16]" />
                </div>
                <div className="font-bold text-sm text-[#2B1B1B]">No Template Selected Yet</div>
                <p className="text-xs text-[#7A6A63] max-w-md mx-auto">
                  Click on one of the template options above (e.g. <strong>Detailed Marks Report</strong> or <strong>Compact Grade Card</strong>) to see how the student marks will be personalized and activate the dispatch button.
                </p>
              </div>
            ) : currentPreview ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* WhatsApp Rendered Bubble */}
                <div className="space-y-2">
                  <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#7A1A2C]">
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp View
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">To: {currentPreview.parentMobileMasked}</span>
                  </div>

                  <div className="bg-[#efeae2] p-5 rounded-3xl border border-slate-300/80 shadow-inner min-h-[320px] flex flex-col justify-between">
                    <div className="bg-white rounded-2xl rounded-tl-xs p-4 shadow-sm text-xs text-slate-800 whitespace-pre-line font-sans leading-relaxed border border-slate-100 max-w-[95%]">
                      {renderCustomMessage(currentWhatsAppTemplate, currentPreview)}
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-mono mt-2 flex items-center justify-end gap-1">
                      <CheckCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
                      <span>WhatsApp Cloud Delivery</span>
                    </div>
                  </div>
                </div>

                {/* SMS Rendered Bubble */}
                <div className="space-y-2">
                  <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#C08A16]">
                      <Smartphone className="w-3.5 h-3.5" /> SMS Text View
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">Header: VSBENG</span>
                  </div>

                  <div className="bg-slate-100/90 p-5 rounded-3xl border border-slate-200 shadow-inner min-h-[320px] flex flex-col justify-between">
                    <div className="bg-white rounded-2xl p-4 shadow-sm text-xs text-slate-800 whitespace-pre-line font-sans leading-relaxed border border-slate-200/80">
                      {renderCustomMessage(currentSMSTemplate, currentPreview)}
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-mono mt-2">
                      Chars: {renderCustomMessage(currentSMSTemplate, currentPreview).length} • GSM 7-bit standard
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-400">
                No preview available. Please upload marks or select an exam with recorded marks.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Safety Confirmation Modal (Section 40) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="ai-glass-card bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/80 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/20 border border-amber-500/30 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-display font-extrabold text-slate-900">Confirm Notification Dispatch</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans">
                You are about to dispatch internal marks notifications to <span className="font-mono font-bold text-slate-900">{previews.length} parents</span>.
              </p>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2 font-sans">
              <div className="flex justify-between">
                <span className="text-slate-500">Examination:</span>
                <span className="font-bold text-slate-800">
                  {exams.find(e => e.id === selectedExamId)?.exam_name || 'Internal Assessment 1'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Channels:</span>
                <span className="font-mono font-bold text-indigo-700">{channel}</span>
              </div>
              {(channel === 'WHATSAPP' || channel === 'BOTH') && (
                <div className="flex justify-between">
                  <span className="text-slate-500">WhatsApp Sender:</span>
                  <span className="font-semibold text-indigo-700">
                    {whatsappSenderType === 'PERSONAL'
                      ? (waSession.phoneNumber ? `Personal (${waSession.phoneNumber})` : 'Personal Faculty Phone')
                      : 'College Central Gateway'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Recipients:</span>
                <span className="font-mono font-bold text-slate-800">{previews.length} Registered Parents</span>
              </div>
            </div>

            <p className="text-[11px] text-amber-900 text-center font-medium bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 font-sans">
              Please verify marks accurately before confirming. Once dispatched, message logs are permanently recorded.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSend}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
