/**
 * NotifyWizard.tsx
 * Unified 5-step wizard:
 *  Step 1 – Select Department & Class
 *  Step 2 – Upload Excel File
 *  Step 3 – Auto-detect Subjects & Validate
 *  Step 4 – Select & Preview Template
 *  Step 5 – Send Notifications + Live Progress
 *
 * All state is preserved when navigating backward.
 * Errors on any step are shown inline without resetting prior steps.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  GraduationCap, UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, ArrowLeft, Send, MessageSquare, Smartphone,
  RefreshCw, Users, UserCheck, Eye, ShieldAlert, CheckCheck, FileText, Layers,
  Sparkles, Search, X, Download, ChevronLeft, ChevronRight, Tag,
  Database, History
} from 'lucide-react';
import { api } from '../services/api';
import {
  Exam, Subject, ColumnMapping, ValidationResult, PreviewRow,
  ClassItem, MessagePreviewItem
} from '../types';

/* ─────────────────────────── Types ─────────────────────────── */
interface WizardProps {
  initialDeptId?: string;
  initialClassId?: string;
  onNavigateToHistory: () => void;
  onNavigateToDashboard?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface DBTemplate {
  id: string;
  name: string;
  channel: string;
  body?: string;
  template_text?: string;
  is_active: boolean;
}

/* ─────────────────────────── Helpers ───────────────────────── */
const isNonSubjectColumn = (col: string): boolean => {
  if (!col) return true;
  const n = col.trim().toLowerCase();
  if (/^(s[\s._-]*no|sl[\s._-]*no|sno|serial|#|id)$/i.test(n)) return true;
  if (/^(reg(ister|istration)?[\s._-]*(no|num|number)?|roll[\s._-]*(no|num)?|usn|enrollment)$/i.test(n)) return true;
  if (/^((student|candidate)?[\s._-]*)?name|full[\s._-]*name$/i.test(n)) return true;
  if (/^(parent[\s._-]*)?(mobile|phone|contact|whatsapp|number|no)([\s._-]*(no|number))?$/i.test(n)) return true;
  if (/^parent[\s._-]*(name|guardian|father|mother|number|mobile|phone)$/i.test(n)) return true;
  if (/^(sec(tion)?|class|dept|department|year|sem(ester)?|academic[\s._-]*year|batch)$/i.test(n)) return true;
  if (/^(email|mail|e-mail)$/i.test(n)) return true;
  if (/^(total|grand[\s._-]*total|percentage|%|result|grade|cgpa|gpa|remarks?|attendance|signature)$/i.test(n)) return true;
  return false;
};

function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'), String(v));
    out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
  }
  out = out.replace(/^•\s*:\s*\/100\s*–\s*.*$\n?/gm, '');
  out = out.replace(/^•\s*\{subject\d+_[^}]+\}:.*$\n?/gm, '');
  return out;
}

function buildTemplateVars(
  item: MessagePreviewItem,
  examName: string,
  collegeName: string
): Record<string, string | number> {
  const marksObj: Record<string, number> = (item.marks && !Array.isArray(item.marks))
    ? item.marks as any
    : {};
  const marksArr = Array.isArray(item.marks) ? item.marks : [];

  const subjectList: Array<{ name: string; marks: number; result: string }> = [];
  let marksText = '';

  if (marksArr.length > 0) {
    marksArr.forEach((m: any) => {
      const n = m.subjectName || m.subject || m.subjectCode || '';
      const v = Number(m.marksObtained ?? m.marks ?? 0);
      subjectList.push({ name: n, marks: v, result: v >= 50 ? 'Pass' : 'Fail' });
    });
    marksText = marksArr.map((m: any) => {
      const n = m.subjectName || m.subject || m.subjectCode || '';
      const v = Number(m.marksObtained ?? m.marks ?? 0);
      const max = Number(m.maximumMarks ?? m.maxMarks ?? 100);
      return `• ${n}: ${v}/${max}`;
    }).join('\n');
  } else if (Object.keys(marksObj).length > 0) {
    Object.entries(marksObj).forEach(([k, v]) => {
      subjectList.push({ name: k, marks: Number(v), result: Number(v) >= 50 ? 'Pass' : 'Fail' });
    });
    marksText = Object.entries(marksObj).map(([k, v]) => `• ${k}: ${v}/100`).join('\n');
  } else if (item.renderedWhatsApp) {
    const bullets = item.renderedWhatsApp.match(/•\s*([^:\n]+):\s*(\d+)(?:\/\d+)?/g);
    if (bullets) {
      bullets.forEach(b => {
        const m = b.match(/•\s*([^:\n]+):\s*(\d+)/);
        if (m) subjectList.push({ name: m[1].trim(), marks: Number(m[2]), result: Number(m[2]) >= 50 ? 'Pass' : 'Fail' });
      });
      marksText = bullets.join('\n');
    }
  }
  if (!marksText) marksText = '• Internal Assessment Score Recorded';

  const totalVal = Number(item.totalMarks ?? 0);
  const maxVal = Number(item.maxMarks ?? (subjectList.length * 100 || 600));
  const pct = maxVal > 0 ? ((totalVal / maxVal) * 100).toFixed(2) : '0.00';
  const hasFail = subjectList.some(s => s.marks < 50);
  const overallRes = String((item as any).overallResult || (item as any).overall_result || item.result || (hasFail ? 'FAIL' : 'PASS'));
  const dept = (item as any).department || 'Information Technology';
  const cls = (item as any).className || (item as any).class_name || item.classSection || 'IT-C';
  const parentName = item.parentName || `${item.studentName}'s Parent`;

  const subjectVars: Record<string, string | number> = {};
  for (let i = 0; i < 6; i++) {
    const s = subjectList[i];
    subjectVars[`subject${i + 1}_name`] = s ? s.name : '';
    subjectVars[`subject${i + 1}_marks`] = s ? s.marks : '';
    subjectVars[`subject${i + 1}_result`] = s ? s.result : '';
  }

  return {
    parent_name: parentName,
    student_name: item.studentName || '',
    register_number: item.registerNumber || '',
    department: dept,
    class_name: cls,
    class_section: item.classSection || `${dept} – ${cls}`,
    exam_name: examName,
    marks: marksText,
    total: totalVal,
    maximum_marks: maxVal,
    percentage: pct,
    result: overallRes,
    overall_result: overallRes,
    college_name: collegeName,
    notice_message: 'The college will remain closed tomorrow. Regular sessions resume Monday.',
    ...subjectVars,
  };
}

function getStudentResult(item: MessagePreviewItem): 'PASS' | 'FAIL' {
  if (item.result === 'PASS' || item.result === 'FAIL') return item.result;
  if (item.overallResult === 'PASS' || item.overallResult === 'FAIL') return item.overallResult;
  if (Array.isArray(item.marks)) {
    const hasFail = item.marks.some((m: any) => Number(m.marksObtained ?? m.marks ?? 0) < 50);
    return hasFail ? 'FAIL' : 'PASS';
  }
  return 'PASS';
}

/* ═══════════════════════ STEP INDICATOR ═══════════════════════ */
const STEPS = [
  { num: 1, label: 'Select Class', icon: GraduationCap },
  { num: 2, label: 'Upload Excel', icon: UploadCloud },
  { num: 3, label: 'Validate Marks', icon: CheckCircle2 },
  { num: 4, label: 'Preview Message', icon: FileText },
  { num: 5, label: 'Send & Track', icon: Send },
];

function StepBar({ current, maxReached }: { current: WizardStep; maxReached: WizardStep }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center py-1">
      {STEPS.map((s, idx) => {
        const done = s.num < current;
        const active = s.num === current;
        const locked = s.num > maxReached;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all select-none ${
              active
                ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-white shadow-md shadow-[#7A1A2C]/25 border border-[#C08A16]/40 ring-1 ring-[#F6C84C]/40'
                : done
                ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/30'
                : locked
                ? 'bg-[#F5EFE8] text-[#7A6A63]/60 border border-[#EADFD3] cursor-not-allowed'
                : 'bg-white text-[#7A6A63] border border-[#EADFD3]'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-black ${
                active ? 'bg-[#F6C84C] text-[#2D0811] shadow-xs'
                : done ? 'bg-[#2E7D32] text-white'
                : 'bg-[#EADFD3] text-[#7A6A63]'
              }`}>
                {done ? '✓' : s.num}
              </div>
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#F6C84C]' : done ? 'text-[#2E7D32]' : 'text-[#7A6A63]'}`} />
              <span className="hidden md:inline font-heading tracking-tight">{s.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 rounded-full mx-0.5 ${done ? 'bg-[#2E7D32]' : 'bg-[#EADFD3]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ═══════════════════════ MAIN WIZARD ══════════════════════════ */
export const NotifyWizard: React.FC<WizardProps> = ({
  initialDeptId,
  initialClassId,
  onNavigateToHistory,
  onNavigateToDashboard,
}) => {
  /* ── wizard step ── */
  const [step, setStep] = useState<WizardStep>(1);
  const [maxReached, setMaxReached] = useState<WizardStep>(1);

  const goTo = useCallback((s: WizardStep) => {
    setStep(s);
    setMaxReached(prev => (s > prev ? s : prev));
    try { window.history.pushState({ wizStep: s }, '', `?step=${s}`); } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const s = e.state?.wizStep || 1;
      if (s >= 1 && s <= 5) setStep(s as WizardStep);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const [error, setError] = useState<string | null>(null);

  /* ─────── STEP 1: Dept / Class / Exam ─────── */
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState(initialDeptId || '');
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || '');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedYear, setSelectedYear] = useState('3');
  const [selectedSemester, setSelectedSemester] = useState('5');
  const [selectedSection, setSelectedSection] = useState('C');
  const [classStudentCount, setClassStudentCount] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);

  /* ─────── STEP 2: Excel Upload ─────── */
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState('');
  const [fileName, setFileName] = useState('');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    registerNumberCol: '',
    studentNameCol: '',
    parentMobileCol: '',
    subjectCols: {},
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─────── STEP 3: Validation ─────── */
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  /* ─────── STEP 4: Template ─────── */
  const [dbTemplates, setDbTemplates] = useState<DBTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState('');
  const [waBody, setWaBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'BOTH'>('WHATSAPP');
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [previews, setPreviews] = useState<MessagePreviewItem[]>([]);
  const [collegeName, setCollegeName] = useState('VSB ENGINEERING COLLEGE');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [forceResend, setForceResend] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [whatsappSenderType, setWhatsappSenderType] = useState<'PERSONAL' | 'CENTRAL'>('PERSONAL');

  /* ─────── Recipient Selection ─────── */
  const [selectionMode, setSelectionMode] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedRegNos, setSelectedRegNos] = useState<Set<string>>(new Set());
  const [recipientFilterStatus, setRecipientFilterStatus] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [recipientSearch, setRecipientSearch] = useState('');

  /* ─────── STEP 5: Sending ─────── */
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    total: number; processed: number; sent: number;
    delivered: number; failed: number; pending: number;
    percentage: number; status: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [step5Search, setStep5Search] = useState('');

  /* ═══════════════ INITIAL LOAD ═══════════════ */
  useEffect(() => {
    loadMeta();
    loadDbTemplates();
  }, []);

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [deptList, classList, examList] = await Promise.all([
        api.academic.getDepartments(),
        api.academic.getClasses(),
        api.academic.getExams(),
      ]);
      setDepartments(deptList);
      setClasses(classList);
      setExams(examList);

      const deptId = initialDeptId || (deptList[0]?.id || '');
      let year = '3', semester = '5', section = 'C';

      if (initialClassId) {
        const c = classList.find((cl: ClassItem) => cl.id === initialClassId);
        if (c) { year = String(c.year); section = c.section; semester = c.semester || '5'; }
      }

      setSelectedDeptId(deptId);
      setSelectedYear(year);
      setSelectedSemester(semester);
      setSelectedSection(section);

      if (examList.length > 0) setSelectedExamId(examList[0].id);

      const matched = classList.find((c: ClassItem) =>
        (!deptId || c.department_id === deptId) &&
        String(c.year) === year &&
        c.section.toUpperCase() === section.toUpperCase()
      );
      const classId = matched?.id || (initialClassId || '');
      setSelectedClassId(classId);

      if (classId) {
        try {
          const r = await api.academic.getClassStudents(classId);
          setClassStudentCount(r.data?.length || 0);
        } catch {}
      }
      if (deptId) {
        try { setSubjects(await api.academic.getSubjects(deptId, semester)); } catch {}
      }
    } catch (e: any) {
      setError('Failed to load departments/classes. ' + (e.message || ''));
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadDbTemplates = async () => {
    try {
      const tpls = await api.notifications.getTemplates();
      setDbTemplates(tpls as DBTemplate[]);
      const waFirst = tpls.find((t: any) => t.channel === 'WHATSAPP' && t.is_active);
      const smsFirst = tpls.find((t: any) => t.channel === 'SMS' && t.is_active);
      if (waFirst) {
        setSelectedTplId(waFirst.id);
        setWaBody(waFirst.body || waFirst.template_text || '');
      }
      if (smsFirst) setSmsBody(smsFirst.body || smsFirst.template_text || '');
    } catch {}
  };

  /* ═══════════════ STEP 1 ACTIONS ═══════════════ */
  useEffect(() => {
    if (!departments.length || !classes.length) return;
    const matched = classes.find((c: ClassItem) =>
      (!selectedDeptId || c.department_id === selectedDeptId) &&
      String(c.year) === selectedYear &&
      c.section.toUpperCase() === selectedSection.toUpperCase()
    );
    setSelectedClassId(matched?.id || '');
  }, [selectedDeptId, selectedYear, selectedSection, classes]);

  useEffect(() => {
    if (selectedClassId) {
      api.academic.getClassStudents(selectedClassId)
        .then(r => setClassStudentCount(r.data?.length || 0))
        .catch(() => {});
    }
    if (selectedDeptId && selectedSemester) {
      api.academic.getSubjects(selectedDeptId, selectedSemester)
        .then(setSubjects)
        .catch(() => {});
    }
  }, [selectedClassId, selectedDeptId, selectedSemester]);

  const handleStep1Next = () => {
    if (!selectedDeptId) { setError('Please select a department.'); return; }
    if (!selectedExamId) { setError('Please select an exam.'); return; }
    setError(null);
    goTo(2);
  };

  /* ═══════════════ STEP 2 ACTIONS ═══════════════ */
  const validateAndSetFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Unsupported file type. Please upload an .xlsx or .xls file.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select an Excel file.'); return; }
    setUploading(true);
    setError(null);
    try {
      const res = await api.uploads.uploadFile(file);
      setUploadId(res.uploadId);
      setFileName(res.fileName);
      setDetectedColumns(res.detectedColumns);

      const cleanSubs: Record<string, string> = {};
      Object.entries(res.suggestedMapping?.subjectCols || {}).forEach(([id, col]) => {
        if (col && !isNonSubjectColumn(col as string)) cleanSubs[id] = col as string;
      });
      setMapping({ ...res.suggestedMapping, subjectCols: cleanSubs });
      setError(null);
      goTo(3);
    } catch (e: any) {
      setError(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const dept = departments.find(d => d.id === selectedDeptId);
    const code = dept?.code || 'DEPT';
    const rows = Array.from({ length: 3 }, (_, i) => {
      const row: Record<string, any> = {
        'Register Number': `2024${code}${String(i + 1).padStart(3, '0')}`,
        'Student Name': `Student ${i + 1}`,
      };
      subjects.forEach(s => { row[`${s.subject_code} - ${s.subject_name}`] = ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    XLSX.writeFile(wb, `${code}_Yr${selectedYear}_Sem${selectedSemester}_Marks.xlsx`);
  };

  /* ═══════════════ STEP 3 ACTIONS ═══════════════ */
  const handleValidate = async () => {
    if (!mapping.registerNumberCol) { setError('Please map the Register Number column.'); return; }
    setValidating(true);
    setError(null);
    try {
      const result = await api.uploads.validate(uploadId, mapping, selectedExamId, selectedClassId);
      setValidationResult(result);
      setImportDone(false);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Validation failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult) return;
    setImporting(true);
    setError(null);
    try {
      await api.uploads.importMarks(uploadId, selectedExamId, true);
      setImportDone(true);
    } catch (e: any) {
      setError(e.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleStep3Next = async () => {
    if (!validationResult) { setError('Please run validation first.'); return; }
    const valid = validationResult.rows.filter(r => r.status === 'VALID' || r.status === 'WARNING');
    if (valid.length === 0) { setError('No valid records to send notifications for.'); return; }
    setError(null);
    await loadPreviews(valid);
    goTo(4);
  };

  /* ═══════════════ STEP 4 ACTIONS ═══════════════ */
  const loadPreviews = async (rows?: PreviewRow[]) => {
    setLoadingPreviews(true);
    try {
      const src = rows || (validationResult?.rows.filter(r => r.status !== 'ERROR') || []);
      const records = src.map(r => ({
        registerNumber: r.registerNumber,
        studentName: r.studentName,
        parentMobile: r.parentMobileRaw || '',
        marks: r.marks,
        totalMarks: r.totalMarks,
        maxMarks: r.maxMarks,
        percentage: r.percentage,
        studentId: r.studentId,
      }));
      const res = await api.notifications.preview(selectedExamId, records);
      setPreviews(res.previews);
      setSelectedRegNos(new Set(res.previews.map(p => p.registerNumber)));
      setCollegeName(res.collegeName || 'VSB ENGINEERING COLLEGE');
      setDuplicateCount(res.duplicateCount || 0);
      setPreviewIdx(0);
    } catch (e: any) {
      setError(e.message || 'Failed to generate preview.');
    } finally {
      setLoadingPreviews(false);
    }
  };

  const selectTemplate = (tpl: DBTemplate) => {
    setSelectedTplId(tpl.id);
    const body = tpl.body || tpl.template_text || '';
    if (tpl.channel === 'WHATSAPP') {
      setWaBody(body);
      setChannel('WHATSAPP');
    } else if (tpl.channel === 'SMS') {
      setSmsBody(body);
      setChannel('SMS');
    }
  };

  /* ── Target Previews & Recipient Filtering ── */
  const targetPreviews = useMemo(() => {
    if (selectionMode === 'ALL') return previews;
    return previews.filter(p => selectedRegNos.has(p.registerNumber));
  }, [selectionMode, previews, selectedRegNos]);

  const passCount = useMemo(() => {
    return previews.filter(p => getStudentResult(p) === 'PASS').length;
  }, [previews]);

  const failCount = useMemo(() => {
    return previews.filter(p => getStudentResult(p) === 'FAIL').length;
  }, [previews]);

  const displayStudentList = useMemo(() => {
    return previews.filter(p => {
      const matchSearch = !recipientSearch ||
        p.studentName.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        p.registerNumber.toLowerCase().includes(recipientSearch.toLowerCase());
      const res = getStudentResult(p);
      const matchStatus = recipientFilterStatus === 'ALL' || res === recipientFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [previews, recipientSearch, recipientFilterStatus]);

  const toggleSelectStudent = (regNo: string) => {
    setSelectedRegNos(prev => {
      const next = new Set(prev);
      if (next.has(regNo)) next.delete(regNo);
      else next.add(regNo);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedRegNos(new Set(previews.map(p => p.registerNumber)));
  };

  const clearAll = () => {
    setSelectedRegNos(new Set());
  };

  const selectOnlyPass = () => {
    const passRegs = previews.filter(p => getStudentResult(p) === 'PASS').map(p => p.registerNumber);
    setSelectedRegNos(new Set(passRegs));
  };

  const selectOnlyFail = () => {
    const failRegs = previews.filter(p => getStudentResult(p) === 'FAIL').map(p => p.registerNumber);
    setSelectedRegNos(new Set(failRegs));
  };

  const toggleVisible = () => {
    const visibleRegs = displayStudentList.map(p => p.registerNumber);
    const allVisibleSelected = visibleRegs.length > 0 && visibleRegs.every(r => selectedRegNos.has(r));
    setSelectedRegNos(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleRegs.forEach(r => next.delete(r));
      } else {
        visibleRegs.forEach(r => next.add(r));
      }
      return next;
    });
  };

  const currentPreview = previews[previewIdx] || previews[0];
  const currentExamName = exams.find(e => e.id === selectedExamId)?.exam_name || 'Internal Assessment – II';

  const renderedPreviewWA = currentPreview && waBody
    ? renderTemplate(waBody, buildTemplateVars(currentPreview, currentExamName, collegeName))
    : '';
  const renderedPreviewSMS = currentPreview && smsBody
    ? renderTemplate(smsBody, buildTemplateVars(currentPreview, currentExamName, collegeName))
    : '';

  const handleStep4Next = () => {
    if (!waBody && !smsBody) { setError('Please load a template.'); return; }
    if (previews.length === 0) { setError('No preview records available.'); return; }
    if (selectionMode === 'SELECTED' && targetPreviews.length === 0) {
      setError('Please select at least 1 student recipient before proceeding.');
      return;
    }
    setError(null);
    goTo(5);
  };

  /* ═══════════════ STEP 5 ACTIONS ═══════════════ */
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (isSending && batchId) {
      iv = setInterval(async () => {
        try {
          const p = await api.notifications.getBatchProgress(batchId);
          setBatchProgress(p);
          if (['COMPLETED', 'PARTIAL', 'FAILED'].includes(p.status)) {
            setIsSending(false);
            if (iv) clearInterval(iv);
            if (p.status === 'COMPLETED' && onNavigateToDashboard) {
              setRedirectCountdown(5);
            }
          }
        } catch {}
      }, 600);
    }
    return () => { if (iv) clearInterval(iv); };
  }, [isSending, batchId]);

  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) { onNavigateToDashboard?.(); return; }
    const t = setTimeout(() => setRedirectCountdown(p => (p !== null && p > 0 ? p - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [redirectCountdown]);

  const handleSend = async () => {
    setShowConfirm(false);
    setIsSending(true);
    setError(null);
    setBatchProgress(null);
    try {
      const records = targetPreviews.map(p => ({
        studentId: p.studentId,
        registerNumber: p.registerNumber,
        studentName: p.studentName,
        parentMobile: p.parentMobileRaw,
        renderedWhatsApp: renderTemplate(waBody, buildTemplateVars(p, currentExamName, collegeName)),
        renderedSMS: renderTemplate(smsBody, buildTemplateVars(p, currentExamName, collegeName)),
      }));
      const res = await api.notifications.sendBatch({
        examId: selectedExamId,
        uploadedFileId: uploadId || undefined,
        channel,
        whatsappSenderType,
        records,
        forceResend,
      });
      setBatchId(res.batchId);
      setBatchProgress({ total: res.totalCreated, processed: 0, sent: 0, delivered: 0, failed: 0, pending: res.totalCreated, percentage: 0, status: 'PROCESSING' });
    } catch (e: any) {
      setIsSending(false);
      setError(e.message || 'Failed to start notification batch.');
    }
  };

  /* ═══════════════ FILTERED ROWS (step 3) ═══════════════ */
  const filteredRows = (validationResult?.rows || []).filter(r => {
    const matchF = activeFilter === 'ALL' || r.status === activeFilter;
    const matchS = !searchQuery || r.registerNumber.toLowerCase().includes(searchQuery.toLowerCase()) || r.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchF && matchS;
  });

  const validCount = validationResult?.validRows || 0;
  const warnCount = validationResult?.warningRows || 0;
  const errCount = validationResult?.errorRows || 0;

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* ── Top Header ── */}
      <div className="ai-glass-card p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-xl font-display font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-indigo-600" />
            </div>
            Marks Notification Wizard
          </h2>
          <p className="text-xs text-slate-500 font-sans">Select class → Upload Excel → Validate → Choose template → Send</p>
        </div>
        <StepBar current={step} maxReached={maxReached} />
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 font-bold shrink-0">✕</button>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 1 – CLASS & EXAM SELECTION
      ════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════
          STEP 1 – CLASS & EXAM SELECTION
      ════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-[#EADFD3] shadow-xs">
          <div className="flex items-center gap-3 pb-4 border-b border-[#F3ECE4]">
            <div className="w-10 h-10 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center border border-[#7A1A2C]/20">
              <GraduationCap className="w-5 h-5 text-[#7A1A2C]" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Step 1 — Select Department & Class</h3>
              <p className="text-xs text-[#7A6A63]">Choose the target academic department, class, and examination.</p>
            </div>
          </div>

          {loadingMeta ? (
            <div className="flex items-center justify-center py-10 gap-3 text-[#7A6A63]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#7A1A2C]" />
              <span className="text-sm font-medium">Loading academic records…</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Department + Year + Semester + Section */}
              <div>
                <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C] mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-[#fff3b8] flex items-center justify-center text-[10px] font-bold">1</span>
                  Academic Scope
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-[#FBF7F2] p-4 rounded-xl border border-[#EADFD3]">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold font-mono text-[#2B1B1B] uppercase tracking-wider mb-1.5">Department *</label>
                    <select
                      value={selectedDeptId}
                      onChange={e => setSelectedDeptId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B] shadow-xs"
                    >
                      {departments.length === 0 && <option value="">-- No Departments --</option>}
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold font-mono text-[#2B1B1B] uppercase tracking-wider mb-1.5">Year *</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B] shadow-xs">
                      {['1','2','3','4'].map(y => <option key={y} value={y}>{y}{y==='1'?'st':y==='2'?'nd':y==='3'?'rd':'th'} Year</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold font-mono text-[#2B1B1B] uppercase tracking-wider mb-1.5">Section *</label>
                    <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B] shadow-xs">
                      {['A','B','C','D','E'].map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Exam Selection */}
              <div>
                <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C] mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-[#fff3b8] flex items-center justify-center text-[10px] font-bold">2</span>
                  Examination
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {exams.length === 0 ? (
                    <div className="col-span-2 p-4 rounded-xl border border-dashed border-[#EADFD3] text-[#7A6A63] text-xs text-center">No examinations found in database</div>
                  ) : exams.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => setSelectedExamId(ex.id)}
                      className={`text-left p-4 rounded-xl border transition-all ${selectedExamId === ex.id
                        ? 'border-[#7A1A2C] bg-[#FDF2F4] shadow-sm ring-1 ring-[#7A1A2C]/30'
                        : 'border-[#EADFD3] bg-white hover:border-[#C08A16] hover:bg-[#FBF7F2]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#2B1B1B] font-heading">{ex.exam_name}</span>
                        {selectedExamId === ex.id && <CheckCircle2 className="w-4 h-4 text-[#7A1A2C]" />}
                      </div>
                      <p className="text-[11px] text-[#7A6A63] font-mono mt-0.5">{ex.academic_year} · Semester {ex.semester}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Info Pill */}
              {selectedClassId && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F5EFE8] border border-[#EADFD3]">
                  <Users className="w-4 h-4 text-[#7A1A2C] shrink-0" />
                  <span className="text-xs font-medium text-[#2B1B1B]">
                    Target Class: <span className="font-mono font-bold text-[#7A1A2C]">{departments.find(d=>d.id===selectedDeptId)?.code} – Year {selectedYear} – Section {selectedSection}</span>
                    {classStudentCount > 0 && <> · <span className="text-[#2B1B1B] font-semibold">{classStudentCount} students enrolled</span></>}
                    {subjects.length > 0 && <> · <span className="text-[#C08A16] font-semibold">{subjects.length} subjects configured</span></>}
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleStep1Next}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30 active:scale-95"
                >
                  Continue to Upload <ArrowRight className="w-4 h-4 text-[#F6C84C]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 2 – EXCEL UPLOAD
      ════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-[#EADFD3] shadow-xs">
          <div className="flex items-center gap-3 pb-4 border-b border-[#F3ECE4]">
            <div className="w-10 h-10 rounded-xl bg-[#C08A16]/10 flex items-center justify-center border border-[#C08A16]/20">
              <UploadCloud className="w-5 h-5 text-[#C08A16]" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Step 2 — Upload Marks Excel</h3>
              <p className="text-xs text-[#7A6A63]">Upload your marks spreadsheet (.xlsx/.xls). Subject columns will be automatically detected.</p>
            </div>
            <button
              onClick={() => goTo(1)}
              className="ml-auto px-3 py-1.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold flex items-center gap-1 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#7A6A63]" /> Back
            </button>
          </div>

          {/* Selected context badges */}
          <div className="flex flex-wrap gap-2 text-[11px] font-mono font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE8] border border-[#EADFD3] text-[#7A1A2C]">
              {departments.find(d=>d.id===selectedDeptId)?.name || 'Dept'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE8] border border-[#EADFD3] text-[#7A1A2C]">
              Year {selectedYear} · Sec {selectedSection}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#FEF9C3] border border-[#C08A16]/30 text-[#7a5209]">
              {exams.find(e=>e.id===selectedExamId)?.exam_name || 'Exam'}
            </span>
          </div>

          {/* Download template */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#C08A16] bg-[#FEF9C3]/50 text-[#7a5209] text-xs font-bold hover:bg-[#FEF9C3] transition-all"
          >
            <Download className="w-4 h-4 text-[#C08A16]" /> Download official blank marks template for this class
          </button>

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              file ? 'border-[#7A1A2C] bg-[#FDF2F4]' : 'border-[#EADFD3] hover:border-[#7A1A2C] hover:bg-[#FBF7F2] bg-[#FBF7F2]/40'
            }`}
          >
            <input
              ref={fileInputRef} type="file" accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]); }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="w-12 h-12 text-[#7A1A2C]" />
                <div>
                  <p className="text-sm font-bold text-[#2B1B1B]">{file.name}</p>
                  <p className="text-xs text-[#7A6A63] mt-0.5 font-mono">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); setError(null); }}
                  className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-[#C62828] text-xs font-bold hover:bg-red-100 transition-all"
                >
                  <X className="w-3 h-3 inline mr-1" />Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#7A6A63]">
                <UploadCloud className="w-12 h-12 text-[#C08A16]" />
                <div>
                  <p className="text-sm font-bold text-[#2B1B1B]">Drag & drop or click to upload</p>
                  <p className="text-xs mt-0.5 text-[#7A6A63]">Supported formats: Microsoft Excel (.xlsx, .xls)</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs text-[#7A6A63]">Subjects and student register numbers are matched automatically.</p>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <><RefreshCw className="w-4 h-4 animate-spin text-[#F6C84C]" /> Uploading…</> : <>Upload & Detect Subjects <ArrowRight className="w-4 h-4 text-[#F6C84C]" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 3 – COLUMN MAPPING + VALIDATE
      ════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-[#EADFD3] shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F3ECE4]">
              <div className="w-10 h-10 rounded-xl bg-[#C08A16]/10 flex items-center justify-center border border-[#C08A16]/20">
                <Layers className="w-5 h-5 text-[#C08A16]" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Step 3 — Column Mapping & Validation</h3>
                <p className="text-xs text-[#7A6A63]">Verify auto-detected columns, then validate marks data against student database records.</p>
              </div>
              <button onClick={() => goTo(2)} className="ml-auto px-3 py-1.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold flex items-center gap-1 transition-all">
                <ArrowLeft className="w-3.5 h-3.5 text-[#7A6A63]" /> Back
              </button>
            </div>

            {/* File badge */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#FBF7F2] border border-[#EADFD3]">
              <FileSpreadsheet className="w-5 h-5 text-[#7A1A2C] shrink-0" />
              <span className="text-xs font-mono font-semibold text-[#2B1B1B]">{fileName}</span>
              <span className="ml-auto text-[11px] font-mono text-[#7A6A63]">{detectedColumns.length} columns detected</span>
            </div>

            {/* Mapping grid */}
            <div className="space-y-3">
              <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C]">Core Identification Columns</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-[#FBF7F2] p-4 rounded-xl border border-[#EADFD3]">
                {/* Register No */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1B1B] mb-1.5 font-mono">Register Number *</label>
                  <select value={mapping.registerNumberCol} onChange={e => setMapping(m => ({ ...m, registerNumberCol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B]">
                    <option value="">-- Select Column --</option>
                    {detectedColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Student Name */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1B1B] mb-1.5 font-mono">Student Name</label>
                  <select value={mapping.studentNameCol} onChange={e => setMapping(m => ({ ...m, studentNameCol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B]">
                    <option value="">-- Select Column --</option>
                    {detectedColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Parent Mobile */}
                <div>
                  <label className="block text-xs font-bold text-[#2B1B1B] mb-1.5 font-mono">Parent Mobile (optional)</label>
                  <select value={mapping.parentMobileCol} onChange={e => setMapping(m => ({ ...m, parentMobileCol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B]">
                    <option value="">-- Use Database Mobile Numbers --</option>
                    {detectedColumns.filter(c => !isNonSubjectColumn(c) === false).map(c => <option key={c} value={c}>{c}</option>)}
                    {detectedColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Subject Cols */}
              {subjects.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#2B1B1B] mb-2 font-mono uppercase tracking-wider text-[#7A1A2C]">
                    Subject Mapping (Auto-detected from sheet)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-[#FBF7F2] p-4 rounded-xl border border-[#EADFD3]">
                    {subjects.map(sub => (
                      <div key={sub.id}>
                        <label className="block text-[11px] font-bold text-[#2B1B1B] mb-1 font-mono">{sub.subject_code} – {sub.subject_name}</label>
                        <select
                          value={mapping.subjectCols[sub.id] || ''}
                          onChange={e => setMapping(m => ({ ...m, subjectCols: { ...m.subjectCols, [sub.id]: e.target.value } }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B]"
                        >
                          <option value="">-- Not Mapped --</option>
                          {detectedColumns.filter(c => !isNonSubjectColumn(c)).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Validate button */}
            {!validationResult && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleValidate}
                  disabled={validating || !mapping.registerNumberCol}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C08A16] to-[#7a5209] text-white text-xs font-bold flex items-center gap-2 hover:from-[#9d6d0d] hover:to-[#5c3d07] transition-all shadow-md shadow-[#C08A16]/20 active:scale-95 disabled:opacity-50"
                >
                  {validating ? <><RefreshCw className="w-4 h-4 animate-spin text-[#F6C84C]" /> Validating Marks…</> : <><Sparkles className="w-4 h-4 text-[#F6C84C]" /> Run Validation</>}
                </button>
              </div>
            )}
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className="bg-white rounded-2xl p-6 space-y-5 border border-[#EADFD3] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2E7D32]/10 flex items-center justify-center border border-[#2E7D32]/20">
                    <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Validation Completed</h3>
                    <p className="text-xs text-[#7A6A63] font-mono">{validationResult.totalRows} student records processed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2E7D32]/10 border border-[#2E7D32]/30 text-[#2E7D32]">{validCount} Valid</span>
                  {warnCount > 0 && <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#D97706]/10 border border-[#D97706]/30 text-[#D97706]">{warnCount} Warnings</span>}
                  {errCount > 0 && <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C62828]/10 border border-[#C62828]/30 text-[#C62828]">{errCount} Errors</span>}
                  <button
                    onClick={() => { setValidationResult(null); handleValidate(); }}
                    className="px-3 py-1.5 rounded-xl border border-[#EADFD3] bg-white text-[#2B1B1B] text-xs font-bold flex items-center gap-1.5 hover:bg-[#FBF7F2] transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#7A6A63]" /> Re-validate
                  </button>
                </div>
              </div>

              {/* Filter & Search */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex gap-1 bg-[#F5EFE8] p-1 rounded-xl border border-[#EADFD3]">
                  {(['ALL','VALID','WARNING','ERROR'] as const).map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${activeFilter === f ? 'bg-white shadow-xs text-[#7A1A2C] border border-[#EADFD3]' : 'text-[#7A6A63] hover:text-[#2B1B1B]'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A6A63]" />
                  <input
                    type="text"
                    placeholder="Search student name or register number…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#EADFD3] text-xs focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-white text-[#2B1B1B]"
                  />
                </div>
              </div>

              {/* Rows table */}
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#EADFD3]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#FBF7F2] border-b border-[#EADFD3] z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-bold font-mono text-[#2B1B1B] uppercase tracking-wider">Reg No</th>
                      <th className="px-3 py-2.5 text-left font-bold font-mono text-[#2B1B1B] uppercase tracking-wider">Student Name</th>
                      <th className="px-3 py-2.5 text-center font-bold font-mono text-[#2B1B1B] uppercase tracking-wider">Total Marks</th>
                      <th className="px-3 py-2.5 text-center font-bold font-mono text-[#2B1B1B] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3ECE4] bg-white">
                    {filteredRows.map((row, i) => (
                      <tr key={i} className={`transition-colors ${row.status === 'ERROR' ? 'bg-red-50/50' : row.status === 'WARNING' ? 'bg-amber-50/50' : 'hover:bg-[#FBF7F2]/60'}`}>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#7A1A2C]">{row.registerNumber}</td>
                        <td className="px-3 py-2.5 text-[#2B1B1B] font-medium">{row.studentName}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-[#2B1B1B]">
                          {row.totalMarks}/{row.maxMarks}
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${row.result === 'PASS' ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/20' : 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/20'}`}>
                            {row.result}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status === 'VALID' ? 'bg-[#2E7D32]/10 text-[#2E7D32]' : row.status === 'WARNING' ? 'bg-[#D97706]/10 text-[#D97706]' : 'bg-[#C62828]/10 text-[#C62828]'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-[#7A6A63]">No records match selected filter</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Import + Proceed */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleImport}
                  disabled={importing || importDone}
                  className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    importDone
                      ? 'border-[#2E7D32]/40 bg-[#2E7D32]/10 text-[#2E7D32] cursor-default'
                      : 'border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] active:scale-95'
                  } disabled:opacity-50`}
                >
                  {importing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Marks to DB…</>
                    : importDone ? <><CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" /> Marks Recorded in Database</>
                    : <><Database className="w-3.5 h-3.5 text-[#C08A16]" /> Save Marks to Database</>}
                </button>

                <button
                  onClick={handleStep3Next}
                  disabled={validCount + warnCount === 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30 active:scale-95 disabled:opacity-50"
                >
                  Continue to Template <ArrowRight className="w-4 h-4 text-[#F6C84C]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 4 – TEMPLATE SELECTION & PREVIEW
      ════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-[#EADFD3] shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F3ECE4]">
              <div className="w-10 h-10 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center border border-[#7A1A2C]/20">
                <FileText className="w-5 h-5 text-[#7A1A2C]" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Step 4 — Select Message Template & Preview</h3>
                <p className="text-xs text-[#7A6A63]">Select the institutional notification template and inspect real-time recipient preview.</p>
              </div>
              <button onClick={() => goTo(3)} className="ml-auto px-3 py-1.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold flex items-center gap-1 transition-all">
                <ArrowLeft className="w-3.5 h-3.5 text-[#7A6A63]" /> Back
              </button>
            </div>

            {/* Channel selector */}
            <div>
              <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C] mb-3">Notification Channel</p>
              <div className="flex gap-2.5 flex-wrap">
                {([['WHATSAPP','WhatsApp (Official Parent Message)','bg-[#25D366] text-white border-transparent'], ['SMS','SMS Gateway','bg-[#7A1A2C] text-[#fff3b8] border-[#C08A16]/40'], ['BOTH','Both Channels','bg-[#4A101E] text-white border-[#F6C84C]/40']] as const).map(([val, label, activeClass]) => (
                  <button
                    key={val}
                    onClick={() => setChannel(val)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${channel === val
                      ? `shadow-sm ${activeClass}`
                      : 'border-[#EADFD3] bg-white text-[#7A6A63] hover:border-[#7A1A2C] hover:text-[#2B1B1B]'}`}
                  >
                    {val === 'WHATSAPP' ? <MessageSquare className="w-3.5 h-3.5" /> : val === 'SMS' ? <Smartphone className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* DB Template Cards */}
            <div>
              <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C] mb-3 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-[#C08A16]" /> Available Templates
              </p>
              {dbTemplates.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-[#EADFD3] text-[#7A6A63] text-xs text-center">
                  No templates found. Please create one in Message Templates.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dbTemplates.filter(t => t.is_active).map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className={`text-left p-4 rounded-xl border transition-all ${selectedTplId === tpl.id
                        ? 'border-[#7A1A2C] bg-[#FDF2F4] shadow-sm ring-1 ring-[#7A1A2C]/40'
                        : 'border-[#EADFD3] bg-white hover:border-[#C08A16] hover:bg-[#FBF7F2]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#2B1B1B] truncate font-heading">{tpl.name}</p>
                          <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            tpl.channel === 'WHATSAPP' ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/20' : 'bg-[#7A1A2C]/10 text-[#7A1A2C] border border-[#7A1A2C]/20'
                          }`}>
                            {tpl.channel}
                          </span>
                        </div>
                        {selectedTplId === tpl.id && <CheckCircle2 className="w-4 h-4 text-[#7A1A2C] shrink-0" />}
                      </div>
                      <p className="mt-2 text-[10px] text-[#7A6A63] font-mono line-clamp-2">
                        {(tpl.body || tpl.template_text || '').substring(0, 90)}…
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template editors */}
            {(channel === 'WHATSAPP' || channel === 'BOTH') && (
              <div>
                <label className="block text-xs font-bold font-mono text-[#2B1B1B] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" /> WhatsApp Template Body
                </label>
                <textarea
                  value={waBody}
                  onChange={e => setWaBody(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-[#EADFD3] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-[#F5EFE8] text-[#2B1B1B] resize-y"
                  placeholder="WhatsApp message template with {Student Name}, {Subject-wise Marks} placeholders…"
                />
              </div>
            )}
            {(channel === 'SMS' || channel === 'BOTH') && (
              <div>
                <label className="block text-xs font-bold font-mono text-[#2B1B1B] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#7A1A2C]" /> SMS Template Body
                </label>
                <textarea
                  value={smsBody}
                  onChange={e => setSmsBody(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-[#EADFD3] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-[#F5EFE8] text-[#2B1B1B] resize-y"
                  placeholder="SMS template…"
                />
              </div>
            )}
          </div>

            {/* ════════════ RECIPIENT AUDIENCE SELECTION ════════════ */}
            <div className="bg-white rounded-2xl p-6 border border-[#EADFD3] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3ECE4]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center border border-[#7A1A2C]/20">
                    <Users className="w-4 h-4 text-[#7A1A2C]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-heading font-bold text-[#2B1B1B] uppercase tracking-wider">
                      Recipient Audience Selection
                    </h4>
                    <p className="text-[11px] text-[#7A6A63]">
                      Choose whether to dispatch notifications to the entire class or select specific students.
                    </p>
                  </div>
                </div>

                {/* Selection Mode Toggle */}
                <div className="flex items-center bg-[#F5EFE8] p-1 rounded-xl border border-[#EADFD3] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('ALL')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      selectionMode === 'ALL'
                        ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-white shadow-xs border border-[#C08A16]/30'
                        : 'text-[#7A6A63] hover:text-[#2B1B1B]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Students ({previews.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('SELECTED')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      selectionMode === 'SELECTED'
                        ? 'bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] text-white shadow-xs border border-[#C08A16]/30'
                        : 'text-[#7A6A63] hover:text-[#2B1B1B]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Selected Students ({selectedRegNos.size})</span>
                  </button>
                </div>
              </div>

              {/* Mode: ALL STUDENTS */}
              {selectionMode === 'ALL' ? (
                <div className="p-4 rounded-xl bg-[#FBF7F2] border border-[#EADFD3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0" />
                    <span className="text-[#2B1B1B]">
                      <strong>All {previews.length} students</strong> in this batch are selected to receive notifications.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('SELECTED')}
                    className="text-xs font-bold text-[#7A1A2C] hover:text-[#4A101E] hover:underline flex items-center gap-1 self-start sm:self-auto"
                  >
                    Switch to Selected Students <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                /* Mode: SELECTED STUDENTS */
                <div className="space-y-3 pt-1">
                  {/* Controls: Search, Status Filter, Quick Select */}
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A6A63]" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={e => setRecipientSearch(e.target.value)}
                        placeholder="Search student name or register number…"
                        className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[#EADFD3] bg-[#FBF7F2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#7A1A2C] text-[#2B1B1B]"
                      />
                      {recipientSearch && (
                        <button
                          type="button"
                          onClick={() => setRecipientSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A6A63] hover:text-[#2B1B1B]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Result filters */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex gap-1 bg-[#F5EFE8] p-1 rounded-xl border border-[#EADFD3]">
                        {(['ALL', 'PASS', 'FAIL'] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setRecipientFilterStatus(f)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                              recipientFilterStatus === f
                                ? 'bg-white shadow-xs text-[#7A1A2C] border border-[#EADFD3]'
                                : 'text-[#7A6A63] hover:text-[#2B1B1B]'
                            }`}
                          >
                            {f === 'ALL' ? `ALL (${previews.length})` : f === 'PASS' ? `PASS (${passCount})` : `FAIL (${failCount})`}
                          </button>
                        ))}
                      </div>

                      {/* Quick Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={selectAll}
                          className="px-2.5 py-1.5 rounded-lg border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-[11px] font-bold transition-all"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={clearAll}
                          className="px-2.5 py-1.5 rounded-lg border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#7A6A63] text-[11px] font-bold transition-all"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={selectOnlyPass}
                          className="px-2 py-1.5 rounded-lg border border-[#2E7D32]/30 bg-[#2E7D32]/10 hover:bg-[#2E7D32]/20 text-[#2E7D32] text-[11px] font-bold transition-all"
                          title="Select only students who passed"
                        >
                          Pass Only
                        </button>
                        <button
                          type="button"
                          onClick={selectOnlyFail}
                          className="px-2 py-1.5 rounded-lg border border-[#7A1A2C]/30 bg-[#7A1A2C]/10 hover:bg-[#7A1A2C]/20 text-[#7A1A2C] text-[11px] font-bold transition-all"
                          title="Select only students who failed"
                        >
                          Fail Only
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-[#7A6A63]">
                      Showing <strong className="text-[#2B1B1B]">{displayStudentList.length}</strong> of {previews.length} students
                    </span>
                    <span className="font-mono font-bold text-[#7A1A2C]">
                      {selectedRegNos.size} recipient(s) selected
                    </span>
                  </div>

                  {/* Student Selection Table */}
                  <div className="border border-[#EADFD3] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F5EFE8] text-[#7A6A63] font-bold uppercase font-mono text-[10px] sticky top-0 border-b border-[#EADFD3] z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={displayStudentList.length > 0 && displayStudentList.every(s => selectedRegNos.has(s.registerNumber))}
                              onChange={toggleVisible}
                              className="rounded border-[#C08A16] text-[#7A1A2C] focus:ring-[#7A1A2C]"
                            />
                          </th>
                          <th className="p-2.5">Register No</th>
                          <th className="p-2.5">Student Name</th>
                          <th className="p-2.5 text-center">Score</th>
                          <th className="p-2.5 text-center">Result</th>
                          <th className="p-2.5">Parent Mobile</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3ECE4]">
                        {displayStudentList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-xs text-[#7A6A63]">
                              No students match your search filter.
                            </td>
                          </tr>
                        ) : (
                          displayStudentList.map(s => {
                            const isSelected = selectedRegNos.has(s.registerNumber);
                            const res = getStudentResult(s);
                            const isCurrentPreview = currentPreview?.registerNumber === s.registerNumber;

                            return (
                              <tr
                                key={s.registerNumber}
                                onClick={() => toggleSelectStudent(s.registerNumber)}
                                className={`cursor-pointer transition-colors ${
                                  isCurrentPreview
                                    ? 'bg-[#FEF9C3]/40 hover:bg-[#FEF9C3]/60'
                                    : isSelected
                                    ? 'bg-[#FDF2F4]/50 hover:bg-[#FDF2F4]'
                                    : 'bg-white hover:bg-[#FBF7F2] opacity-75'
                                }`}
                              >
                                <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectStudent(s.registerNumber)}
                                    className="rounded border-[#C08A16] text-[#7A1A2C] focus:ring-[#7A1A2C]"
                                  />
                                </td>
                                <td className="p-2.5 font-mono font-bold text-[#7A1A2C]">
                                  {s.registerNumber}
                                </td>
                                <td className="p-2.5 font-heading font-bold text-[#2B1B1B]">
                                  {s.studentName}
                                </td>
                                <td className="p-2.5 text-center font-mono">
                                  {s.totalMarks} / {s.maxMarks} ({s.percentage}%)
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    res === 'PASS'
                                      ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/30'
                                      : 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/30'
                                  }`}>
                                    {res}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono text-[#7A6A63] text-[11px]">
                                  {s.parentMobileMasked}
                                </td>
                                <td className="p-2.5 text-right" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const idx = previews.findIndex(p => p.registerNumber === s.registerNumber);
                                      if (idx !== -1) setPreviewIdx(idx);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ml-auto transition-all ${
                                      isCurrentPreview
                                        ? 'bg-[#7A1A2C] text-[#fff3b8] border-[#7A1A2C]'
                                        : 'bg-white text-[#7A6A63] border-[#EADFD3] hover:text-[#7A1A2C] hover:border-[#7A1A2C]'
                                    }`}
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>{isCurrentPreview ? 'Previewing' : 'Preview'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedRegNos.size === 0 && (
                    <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                      <span>Warning: No students are currently selected. Please select at least one student to send notifications.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Preview Panel with Authentic WhatsApp Smartphone Simulation */}
          {loadingPreviews ? (
            <div className="bg-white rounded-2xl p-8 flex items-center justify-center gap-3 text-[#7A6A63] border border-[#EADFD3]">
              <RefreshCw className="w-5 h-5 animate-spin text-[#7A1A2C]" />
              <span className="text-sm font-medium">Generating live previews…</span>
            </div>
          ) : previews.length > 0 && (
            <div className="bg-white rounded-2xl p-6 space-y-4 border border-[#EADFD3] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Eye className="w-5 h-5 text-[#7A1A2C]" />
                  <h4 className="text-sm font-heading font-bold text-[#2B1B1B]">Live Message Preview</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F5EFE8] border border-[#EADFD3] text-[#7A1A2C] text-[10px] font-mono font-bold">
                    Recipient {previewIdx + 1} of {previews.length}
                  </span>
                  {currentPreview && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedRegNos.has(currentPreview.registerNumber)
                        ? 'bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/30'
                        : 'bg-[#7A6A63]/10 text-[#7A6A63] border border-[#EADFD3]'
                    }`}>
                      {selectedRegNos.has(currentPreview.registerNumber) ? '✓ Included in Dispatch' : '✕ Excluded from Dispatch'}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setPreviewIdx(p => Math.max(0, p - 1))} disabled={previewIdx === 0}
                    className="p-1.5 rounded-lg border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] disabled:opacity-40 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPreviewIdx(p => Math.min(previews.length - 1, p + 1))} disabled={previewIdx === previews.length - 1}
                    className="p-1.5 rounded-lg border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] disabled:opacity-40 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {currentPreview && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* WhatsApp Simulation */}
                  {(channel === 'WHATSAPP' || channel === 'BOTH') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono text-[#075E54] uppercase flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" /> WhatsApp Phone Simulation
                        </span>
                        <span className="text-[10px] text-[#7A6A63] font-mono">To: {currentPreview.parentMobileMasked}</span>
                      </div>
                      
                      {/* Realistic WhatsApp Smartphone Container */}
                      <div className="rounded-2xl border border-[#EADFD3] shadow-md overflow-hidden bg-[#ECE5DD] max-w-md mx-auto">
                        {/* WhatsApp Top Header Bar */}
                        <div className="bg-[#075E54] px-3.5 py-2.5 text-white flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                              {currentPreview.studentName ? currentPreview.studentName.charAt(0) : 'P'}
                            </div>
                            <div className="leading-tight">
                              <div className="text-xs font-bold truncate max-w-[170px]">{currentPreview.studentName}'s Parent</div>
                              <div className="text-[9px] text-[#25D366] font-mono">online</div>
                            </div>
                          </div>
                          <div className="text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-mono font-semibold">WhatsApp</div>
                        </div>

                        {/* WhatsApp Chat Area */}
                        <div className="p-3.5 max-h-72 overflow-y-auto space-y-2">
                          <div className="flex justify-center my-1">
                            <span className="bg-white/90 text-[#7A6A63] text-[9px] font-semibold px-2 py-0.5 rounded-md shadow-xs">
                              TODAY
                            </span>
                          </div>

                          {/* Outgoing Message Bubble */}
                          <div className="flex justify-end">
                            <div className="max-w-[92%] bg-[#E7FFDB] text-[#2B1B1B] p-3 rounded-2xl rounded-tr-xs shadow-xs text-xs font-sans whitespace-pre-wrap leading-relaxed relative border border-[#cbeabb]">
                              <div>{renderedPreviewWA}</div>
                              <div className="flex items-center justify-end gap-1 mt-1.5 text-[9px] text-[#7A6A63]">
                                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SMS Simulation */}
                  {(channel === 'SMS' || channel === 'BOTH') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono text-[#7A1A2C] uppercase flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-[#C08A16]" /> Standard SMS Simulation
                        </span>
                        <span className="text-[10px] text-[#7A6A63] font-mono">To: {currentPreview.parentMobileMasked}</span>
                      </div>
                      
                      <div className="rounded-2xl border border-[#EADFD3] shadow-md overflow-hidden bg-[#FBF7F2] max-w-md mx-auto">
                        <div className="bg-[#4A101E] px-3.5 py-2.5 text-white flex items-center justify-between">
                          <span className="text-xs font-bold tracking-tight text-white font-heading">VSBENG SMS Gateway</span>
                          <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded text-[#F6C84C] font-mono font-bold">Standard SMS</span>
                        </div>
                        <div className="p-3.5 max-h-72 overflow-y-auto">
                          <div className="bg-white p-3.5 rounded-xl shadow-xs border border-[#EADFD3] text-xs font-sans text-[#2B1B1B] whitespace-pre-wrap leading-relaxed">
                            {renderedPreviewSMS}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Option 1 Direct Test Send */}
              {currentPreview && (
                <div className="mt-3 p-3 rounded-xl bg-[#FBF7F2] border border-[#EADFD3] flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs text-[#2B1B1B]">
                    <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Quick Test (Option 1): Send directly to <strong className="font-heading">{currentPreview.studentName}</strong>'s parent ({currentPreview.parentMobileMasked})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const clean = (currentPreview.parentMobileRaw || '').replace(/\D/g, '');
                      const digits = clean.length >= 10 ? clean.slice(-10) : '';
                      const vars = buildTemplateVars(currentPreview, currentExamName, collegeName);
                      const defaultSmsTpl = `VSB ENGINEERING COLLEGE: Dear Parent of {student_name} ({register_number}), {exam_name} Marks:\n{marks}\nTotal: {total}/{maximum_marks} ({percentage}%) - Result: {overall_result}. Regards, Principal.`;
                      const smsMsg = renderTemplate(smsBody || defaultSmsTpl, vars);
                      const waMsg = renderTemplate(waBody || smsBody || defaultSmsTpl, vars);
                      const testSmsUrl = digits ? `sms:${digits}?body=${encodeURIComponent(smsMsg)}` : null;
                      const testWaUrl = digits ? `https://wa.me/91${digits}?text=${encodeURIComponent(waMsg)}` : null;
                      return (
                        <>
                          {testSmsUrl ? (
                            <a
                              href={testSmsUrl}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                              title="Open Phone Messages app directly (100% Free via SIM)"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Test SMS (SIM)</span>
                            </a>
                          ) : null}
                          {testWaUrl ? (
                            <a
                              href={testWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                              title="Open in WhatsApp Web / App"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Test WhatsApp</span>
                            </a>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicateCount > 0 && (
            <div className="p-4 rounded-xl bg-[#FEF9C3] border border-[#C08A16]/40 text-[#7a5209] text-xs flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-[#C08A16] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{duplicateCount} student(s) have already received notifications for this examination.</p>
                <label className="inline-flex items-center gap-2 mt-2 cursor-pointer font-semibold">
                  <input type="checkbox" checked={forceResend} onChange={e => setForceResend(e.target.checked)} className="rounded text-[#7A1A2C]" />
                  <span>Force resend notifications to previously contacted parents</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleStep4Next}
              disabled={previews.length === 0 || loadingPreviews || (selectionMode === 'SELECTED' && targetPreviews.length === 0)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30 active:scale-95 disabled:opacity-50"
            >
              Proceed to Send ({targetPreviews.length} Recipients) <ArrowRight className="w-4 h-4 text-[#F6C84C]" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 5 – SEND NOTIFICATIONS
      ════════════════════════════════════════════ */}
      {step === 5 && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="bg-white rounded-2xl p-6 space-y-5 border border-[#EADFD3] shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F3ECE4]">
              <div className="w-10 h-10 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center border border-[#7A1A2C]/20">
                <Send className="w-5 h-5 text-[#7A1A2C]" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">Step 5 — Send Notifications & Track</h3>
                <p className="text-xs text-[#7A6A63]">Verify delivery counts and initiate parent notification dispatch.</p>
              </div>
              {!isSending && !batchProgress && (
                <button onClick={() => goTo(4)} className="ml-auto px-3 py-1.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold flex items-center gap-1 transition-all">
                  <ArrowLeft className="w-3.5 h-3.5 text-[#7A6A63]" /> Back
                </button>
              )}
            </div>

            {/* Batch summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: selectionMode === 'SELECTED' ? `Selected (${targetPreviews.length}/${previews.length})` : 'All Recipients',
                  value: targetPreviews.length,
                  color: 'text-[#7A1A2C]'
                },
                { label: 'Channel', value: channel, color: 'text-[#2B1B1B]' },
                { label: 'Exam', value: exams.find(e=>e.id===selectedExamId)?.exam_name?.split(' ').slice(-1)[0] || '–', color: 'text-[#2B1B1B]' },
                { label: 'Target Class', value: `${departments.find(d=>d.id===selectedDeptId)?.code||'–'}-${selectedSection}`, color: 'text-[#C08A16]' },
              ].map(s => (
                <div key={s.label} className="text-center p-3.5 rounded-xl bg-[#FBF7F2] border border-[#EADFD3]">
                  <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] font-bold font-mono uppercase text-[#7A6A63] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {selectionMode === 'SELECTED' && (
              <div className="p-3.5 rounded-xl bg-[#FDF2F4] border border-[#7A1A2C]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-[#7A1A2C]">
                  <UserCheck className="w-4 h-4 shrink-0 text-[#7A1A2C]" />
                  <span>
                    Selective Dispatch: Sending exclusively to <strong className="font-mono font-bold">{targetPreviews.length}</strong> selected student(s) out of <strong>{previews.length}</strong> in this class.
                  </span>
                </div>
                {!isSending && !batchProgress && (
                  <button
                    onClick={() => goTo(4)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#7A1A2C] bg-white border border-[#7A1A2C]/30 hover:bg-[#7A1A2C]/10 transition-all self-start sm:self-auto shrink-0"
                  >
                    Edit Selection
                  </button>
                )}
              </div>
            )}

            {/* WhatsApp sender type */}
            {(channel === 'WHATSAPP' || channel === 'BOTH') && (
              <div>
                <p className="text-xs font-bold font-mono uppercase tracking-wider text-[#7A1A2C] mb-2">WhatsApp Session Type</p>
                <div className="flex gap-2">
                  {(['PERSONAL','CENTRAL'] as const).map(t => (
                    <button key={t} onClick={() => setWhatsappSenderType(t)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${whatsappSenderType === t
                        ? 'border-[#7A1A2C] bg-[#FDF2F4] text-[#7A1A2C] shadow-xs'
                        : 'border-[#EADFD3] bg-white text-[#7A6A63] hover:border-[#7A1A2C]'}`}>
                      {t === 'PERSONAL' ? '📱 Faculty Personal Device (Linked QR)' : '🌐 College Central Gateway'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!batchProgress && !isSending && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={targetPreviews.length === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md shadow-[#7A1A2C]/25 border border-[#C08A16]/30 active:scale-[0.99] disabled:opacity-50"
              >
                <Send className="w-5 h-5 text-[#F6C84C]" />
                Send {targetPreviews.length} Notifications to Parents
              </button>
            )}
          </div>

          {/* Progress */}
          {(isSending || (batchProgress && batchProgress.total > 0)) && (
            <div className="bg-white rounded-2xl p-6 space-y-5 border border-[#EADFD3] shadow-xs relative overflow-hidden">
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${
                    batchProgress?.status === 'COMPLETED' ? 'bg-[#2E7D32]'
                    : batchProgress?.status === 'FAILED' ? 'bg-[#C62828]'
                    : 'bg-[#7A1A2C] animate-pulse'
                  }`}>
                    {batchProgress?.status === 'COMPLETED' ? <CheckCheck className="w-6 h-6 text-white" />
                      : batchProgress?.status === 'FAILED' ? <XCircle className="w-6 h-6 text-white" />
                      : <Send className="w-5 h-5 text-[#fff3b8]" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">
                      {batchProgress?.status === 'COMPLETED' ? 'All Notifications Dispatched!'
                        : batchProgress?.status === 'PARTIAL' ? 'Partially Sent'
                        : batchProgress?.status === 'FAILED' ? 'Batch Failed'
                        : 'Dispatching Messages to Parents…'}
                    </h3>
                    <p className="text-xs text-[#7A6A63] font-mono">{channel} · Status: {batchProgress?.status || 'PROCESSING'}</p>
                  </div>
                </div>
                <span className="text-3xl font-black font-mono text-[#7A1A2C]">{batchProgress?.percentage || 0}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#F5EFE8] rounded-full h-3.5 overflow-hidden p-0.5 border border-[#EADFD3]">
                <div
                  className="bg-gradient-to-r from-[#7A1A2C] via-[#C08A16] to-[#2E7D32] h-2.5 rounded-full transition-all duration-500 shadow-xs"
                  style={{ width: `${batchProgress?.percentage || 0}%` }}
                />
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: 'Total', val: batchProgress?.total, bg: 'bg-[#FBF7F2] border-[#EADFD3]', txt: 'text-[#2B1B1B]' },
                  { label: 'Sent', val: batchProgress?.sent, bg: 'bg-[#F5EFE8] border-[#EADFD3]', txt: 'text-[#7A1A2C]' },
                  { label: 'Delivered', val: batchProgress?.delivered, bg: 'bg-[#2E7D32]/10 border-[#2E7D32]/30', txt: 'text-[#2E7D32]' },
                  { label: 'Failed', val: batchProgress?.failed, bg: 'bg-[#C62828]/10 border-[#C62828]/30', txt: 'text-[#C62828]' },
                  { label: 'Pending', val: batchProgress?.pending, bg: 'bg-[#D97706]/10 border-[#D97706]/30', txt: 'text-[#D97706]' },
                ].map(s => (
                  <div key={s.label} className={`p-2.5 rounded-xl border ${s.bg}`}>
                    <div className={`text-lg font-black font-mono ${s.txt}`}>{s.val ?? '–'}</div>
                    <div className="text-[10px] font-bold font-mono uppercase text-[#7A6A63]">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Post-completion actions */}
              {batchProgress?.status === 'COMPLETED' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#2E7D32]/10 border border-[#2E7D32]/30">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-[#2E7D32]">
                      <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                      <span>All notifications dispatched!</span>
                    </div>
                    <div className="flex gap-2.5">
                      <button onClick={onNavigateToHistory}
                        className="px-4 py-2 rounded-xl border border-[#2E7D32]/40 bg-white text-[#2E7D32] text-xs font-bold flex items-center gap-1.5 hover:bg-[#2E7D32]/10 transition-all">
                        <History className="w-3.5 h-3.5" /> View Logs
                      </button>
                      {onNavigateToDashboard && (
                        <button onClick={onNavigateToDashboard}
                          className="px-4 py-2 rounded-xl bg-[#7A1A2C] text-[#fff3b8] text-xs font-bold flex items-center gap-1.5 hover:bg-[#631524] transition-all border border-[#C08A16]/30">
                          Dashboard <ArrowRight className="w-3.5 h-3.5 text-[#F6C84C]" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Option 1 Direct Device Dispatcher (Free Cellular SMS via SIM & WhatsApp) */}
                  {targetPreviews.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#FBF7F2] border border-[#EADFD3] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#2B1B1B] flex items-center gap-1.5 font-heading">
                            <Smartphone className="w-4 h-4 text-amber-600" />
                            <MessageSquare className="w-4 h-4 text-[#25D366]" />
                            <span>Option 1: Instant Direct Dispatch ({targetPreviews.length} Parent Recipients)</span>
                          </p>
                          <span className="text-[11px] text-[#7A6A63]">
                            100% Free · Click <strong className="text-amber-800">[Send SMS]</strong> to launch your phone's Messages app with SIM, or <strong className="text-[#075E54]">[WhatsApp]</strong> to open chat.
                          </span>
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A6A63]" />
                          <input
                            type="text"
                            placeholder="Search recipient..."
                            value={step5Search}
                            onChange={e => setStep5Search(e.target.value)}
                            className="pl-8 pr-3 py-1 text-xs rounded-lg border border-[#EADFD3] bg-white text-[#2B1B1B] focus:outline-hidden focus:border-[#7A1A2C] w-48"
                          />
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {targetPreviews
                          .filter(p => !step5Search ||
                            p.studentName.toLowerCase().includes(step5Search.toLowerCase()) ||
                            p.registerNumber.toLowerCase().includes(step5Search.toLowerCase()) ||
                            (p.parentMobileRaw && p.parentMobileRaw.includes(step5Search))
                          )
                          .map(p => {
                            const cleanNum = (p.parentMobileRaw || '').replace(/\D/g, '');
                            const digits = cleanNum.length >= 10 ? cleanNum.slice(-10) : '';
                            const vars = buildTemplateVars(p, currentExamName, collegeName);
                            const defaultSmsTpl = `VSB ENGINEERING COLLEGE: Dear Parent of {student_name} ({register_number}), {exam_name} Marks:\n{marks}\nTotal: {total}/{maximum_marks} ({percentage}%) - Result: {overall_result}. Regards, Principal.`;
                            const smsText = renderTemplate(smsBody || defaultSmsTpl, vars);
                            const waText = renderTemplate(waBody || smsBody || defaultSmsTpl, vars);
                            const smsLink = digits ? `sms:${digits}?body=${encodeURIComponent(smsText)}` : null;
                            const waLink = digits ? `https://wa.me/91${digits}?text=${encodeURIComponent(waText)}` : null;

                            return (
                              <div key={p.registerNumber} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-white border border-[#EADFD3] text-xs gap-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-heading font-bold text-[#2B1B1B]">{p.studentName}</span>
                                    <span className="font-mono text-[#7A6A63] text-[11px] bg-[#F5EFE8] px-1.5 py-0.5 rounded border border-[#EADFD3]">
                                      {p.registerNumber}
                                    </span>
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                      vars.overall_result === 'PASS' ? 'bg-[#2E7D32]/10 text-[#2E7D32]' : 'bg-[#C62828]/10 text-[#C62828]'
                                    }`}>
                                      {vars.overall_result}
                                    </span>
                                  </div>
                                  <div className="text-[#7A6A63] font-mono text-[11px] mt-0.5">
                                    Parent Phone: <strong className="text-[#2B1B1B]">{p.parentMobileRaw || p.parentMobileMasked}</strong>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {smsLink ? (
                                    <a
                                      href={smsLink}
                                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                      title="Open Phone Messages App (Uses Phone SIM)"
                                    >
                                      <Smartphone className="w-3.5 h-3.5" />
                                      <span>Send SMS (SIM)</span>
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-[#7A6A63] italic">No phone</span>
                                  )}

                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                      title="Open in WhatsApp Web / App"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(batchProgress?.status === 'PARTIAL' || batchProgress?.status === 'FAILED') && (
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-xs font-bold text-amber-900">
                    {batchProgress.failed} message(s) failed delivery. You can review and retry them in Notification History.
                  </div>
                  <button onClick={onNavigateToHistory}
                    className="px-4 py-2 rounded-xl border border-amber-300 bg-white text-amber-700 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-50 transition-all">
                    <History className="w-3.5 h-3.5" /> View & Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════ CONFIRM MODAL ════════════ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D0811]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 border border-[#EADFD3]">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center border border-[#7A1A2C]/20">
                <Send className="w-5 h-5 text-[#7A1A2C]" />
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-[#2B1B1B]">Confirm Notification Dispatch</h3>
                <p className="text-xs text-[#7A6A63] mt-0.5">This will send live messages to verified parent phone numbers.</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-[#2B1B1B] bg-[#FBF7F2] p-4 rounded-xl border border-[#EADFD3]">
              <div className="flex justify-between">
                <span className="text-[#7A6A63]">Total Recipients</span>
                <span className="font-mono font-bold text-[#7A1A2C]">
                  {targetPreviews.length} {selectionMode === 'SELECTED' ? `(Selected of ${previews.length})` : '(All Students)'}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-[#7A6A63]">Delivery Channel</span><span className="font-mono font-bold">{channel}</span></div>
              <div className="flex justify-between"><span className="text-[#7A6A63]">Examination</span><span className="font-mono font-bold">{currentExamName}</span></div>
              <div className="flex justify-between"><span className="text-[#7A6A63]">Target Class</span><span className="font-mono font-bold">{departments.find(d=>d.id===selectedDeptId)?.code} – Section {selectedSection}</span></div>
              {forceResend && <div className="text-[#C08A16] font-bold">⚠ Force resend is enabled for this batch</div>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#EADFD3] bg-white text-[#2B1B1B] text-xs font-bold hover:bg-[#FBF7F2] transition-all">
                Cancel
              </button>
              <button onClick={handleSend}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2D0811] text-[#fff3b8] text-xs font-bold transition-all shadow-md shadow-[#7A1A2C]/25 border border-[#C08A16]/30">
                Yes, Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
