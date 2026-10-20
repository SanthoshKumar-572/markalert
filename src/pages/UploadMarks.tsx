import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Search,
  Check,
  HelpCircle,
  Sparkles,
  Layers,
  Database,
  Users,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Exam, Subject, ColumnMapping, ValidationResult, PreviewRow, ClassItem, Student } from '../types';

interface UploadMarksProps {
  onProceedToSend: (examId: string, validatedRows: PreviewRow[], fileName: string, uploadId: string) => void;
  initialDeptId?: string;
  initialClassId?: string;
}

export const UploadMarks: React.FC<UploadMarksProps> = ({ onProceedToSend, initialDeptId, initialClassId }) => {
  // Step State: 1 = File Selection, 2 = Mapping, 3 = Preview & Validate
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const goToStep = (newStep: 1 | 2 | 3) => {
    setStep(newStep);
    try {
      window.history.pushState({ step: newStep }, '', `${window.location.pathname}?step=${newStep}`);
    } catch (e) {}
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = parseInt(params.get('step') || '1', 10);
    if (stepParam >= 1 && stepParam <= 3) {
      setStep(stepParam as 1 | 2 | 3);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.step) {
        setStep(e.state.step);
      } else {
        const p = new URLSearchParams(window.location.search);
        const s = parseInt(p.get('step') || '1', 10);
        if (s >= 1 && s <= 3) {
          setStep(s as 1 | 2 | 3);
        } else {
          setStep(1);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('2026-27');

  // Academic Scope (Year, Semester, Department, Section)
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('3');
  const [selectedSemester, setSelectedSemester] = useState<string>('5');
  const [selectedSection, setSelectedSection] = useState<string>('C');

  // Constant Class Master state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingClassStudents, setLoadingClassStudents] = useState(false);
  const [showMasterRosterModal, setShowMasterRosterModal] = useState(false);
  const [showAbsentList, setShowAbsentList] = useState(false);
  const [showUnrecognizedList, setShowUnrecognizedList] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Uploaded File Info & Column Detection
  const [uploadId, setUploadId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    registerNumberCol: '',
    studentNameCol: '',
    parentMobileCol: '',
    subjectCols: {}
  });

  // Validation Preview Results
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track if the initial load has applied the preset so the sync effect doesn't overwrite it
  const presetAppliedRef = useRef(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // When Department, Year, Semester, or Section changes, sync Class & Subjects
  // Skip on very first render — loadInitialData handles that inline
  useEffect(() => {
    if (!presetAppliedRef.current) return;
    if (departments.length > 0) {
      syncClassAndSubjects();
    }
  }, [selectedDepartmentId, selectedYear, selectedSemester, selectedSection, classes]);

  const loadInitialData = async () => {
    try {
      const [examList, classList, deptList] = await Promise.all([
        api.academic.getExams(),
        api.academic.getClasses(),
        api.academic.getDepartments()
      ]);
      setExams(examList);
      if (examList.length > 0) {
        setSelectedExamId(examList[0].id);
      }
      setClasses(classList);
      setDepartments(deptList);

      // Determine which dept/year/section to use
      let deptId = initialDeptId || (deptList.length > 0 ? deptList[0].id : '');
      let year = selectedYear;
      let section = selectedSection;

      if (initialClassId) {
        const presetClass = classList.find((c: ClassItem) => c.id === initialClassId);
        if (presetClass) {
          year = String(presetClass.year);
          section = presetClass.section;
        }
      }

      setSelectedDepartmentId(deptId);
      setSelectedYear(year);
      setSelectedSection(section);

      // Sync class + subjects immediately using the live data (no stale closure)
      const matchedClass = classList.find((c: ClassItem) =>
        (deptId ? c.department_id === deptId : true) &&
        String(c.year) === String(year) &&
        c.section.toUpperCase() === section.toUpperCase()
      );
      const classIdToUse = matchedClass?.id || '';
      setSelectedClassId(classIdToUse);

      // Load students for this class
      try {
        const studentList = await api.students.list({
          department_id: deptId,
          year,
          section,
          class_id: classIdToUse || undefined
        });
        setClassStudents(studentList);
      } catch (e) {
        console.error('Failed to load class students:', e);
      }

      // Load subjects for this dept + semester
      try {
        const semSubjects = await api.academic.getSubjects(deptId, selectedSemester);
        setSubjects(semSubjects);
      } catch (e) {
        console.error('Failed to load subjects:', e);
      }

      // Allow the sync effect to take over for subsequent user changes
      presetAppliedRef.current = true;
    } catch (err: any) {
      console.error('Failed to load initial metadata:', err);
      presetAppliedRef.current = true;
    }
  };

  const syncClassAndSubjects = async () => {
    // 1. Find or pick matching class
    const matchedClass = classes.find(c =>
      (selectedDepartmentId ? c.department_id === selectedDepartmentId : true) &&
      String(c.year) === String(selectedYear) &&
      c.section.toUpperCase() === selectedSection.toUpperCase()
    );

    const classIdToUse = matchedClass?.id || '';
    setSelectedClassId(classIdToUse);

    // Fetch students strictly for this selected Department, Year, and Section
    await loadClassStudents(selectedDepartmentId, selectedYear, selectedSection, classIdToUse);

    // 2. Load subjects for the chosen department & semester
    try {
      const semSubjects = await api.academic.getSubjects(selectedDepartmentId, selectedSemester);
      setSubjects(semSubjects);
    } catch (err) {
      console.error('Failed to load semester subjects:', err);
    }
  };

  const loadClassStudents = async (deptId?: string, year?: string, section?: string, classId?: string) => {
    setLoadingClassStudents(true);
    try {
      const list = await api.students.list({
        department_id: deptId || selectedDepartmentId,
        year: year || selectedYear,
        section: section || selectedSection,
        class_id: classId || undefined
      });
      setClassStudents(list);
    } catch (err) {
      console.error('Failed to load class students:', err);
    } finally {
      setLoadingClassStudents(false);
    }
  };

  const handleDownloadClassMarksTemplate = () => {
    const selectedDept = departments.find(d => d.id === selectedDepartmentId);
    const deptCode = selectedDept ? selectedDept.code : 'DEPT';
    const filename = `${deptCode}_Yr${selectedYear}_Sem${selectedSemester}_Sec${selectedSection}_Marks_Sheet.xlsx`;

    // Build rows from constant students of this selected section
    const rowsData = (classStudents.length > 0 ? classStudents : [
      { register_number: `2024${deptCode}001`, name: 'Student 1' },
      { register_number: `2024${deptCode}002`, name: 'Student 2' }
    ]).map((std: any) => {
      const row: Record<string, any> = {
        'Register Number': std.register_number,
        'Student Name': std.name
      };
      // Add columns for subjects of this semester
      if (subjects.length > 0) {
        subjects.forEach(sub => {
          row[`${sub.subject_code} - ${sub.subject_name}`] = '';
        });
      } else {
        row['Subject 1 Marks'] = '';
        row['Subject 2 Marks'] = '';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rowsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sec_${selectedSection}`);
    XLSX.writeFile(wb, filename);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      validateAndSetFile(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Unsupported file format. Please upload an Excel file (.xlsx or .xls).');
      return;
    }
    setFile(f);
    setError(null);
  };

  const isNonSubjectColumn = (colName: string): boolean => {
    if (!colName) return true;
    const norm = colName.trim().toLowerCase();
    if (/^(s[\s._-]*no|sl[\s._-]*no|sno|serial[\s._-]*(no|num|number)?|#|id)$/i.test(norm)) return true;
    if (/^(reg(ister|istration)?[\s._-]*(no|num|number)?|roll[\s._-]*(no|num|number)?|std[\s._-]*id|usn|enrollment)$/i.test(norm)) return true;
    if (/^((student|candidate)[\s._-]*)?name|full[\s._-]*name|first[\s._-]*name|last[\s._-]*name$/i.test(norm)) return true;
    if (/^(parent[\s._-]*)?(mobile|phone|contact|whatsapp|number|no)([\s._-]*(no|number|num))?$/i.test(norm)) return true;
    if (/^parent[\s._-]*(name|guardian|father|mother|number|no|mobile|phone|contact)$/i.test(norm)) return true;
    if (/^(sec(tion)?|class|dept|department|year|sem(ester)?|academic[\s._-]*year|batch)$/i.test(norm)) return true;
    if (/^(email|mail|e-mail)$/i.test(norm)) return true;
    if (/^(total|grand[\s._-]*total|total[\s._-]*marks|percentage|%|result|status|grade|gpa|cgpa|remarks?|attendance|signature)$/i.test(norm)) return true;
    return false;
  };

  const handleUploadAndDetect = async () => {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }
    if (!selectedExamId) {
      setError('Please select an Examination.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await api.uploads.uploadFile(file);
      setUploadId(res.uploadId);
      setFileName(res.fileName);
      setDetectedColumns(res.detectedColumns);

      // Sanitize subject column suggestions to never include metadata (Parent Number, S.No, etc.)
      const cleanSubjectCols: Record<string, string> = {};
      Object.entries(res.suggestedMapping?.subjectCols || {}).forEach(([subId, col]) => {
        if (col && !isNonSubjectColumn(col)) {
          cleanSubjectCols[subId] = col;
        }
      });

      setMapping({
        ...res.suggestedMapping,
        subjectCols: cleanSubjectCols
      });
      goToStep(2); // Advance to mapping step with browser history support
    } catch (err: any) {
      setError(err.message || 'Failed to upload and read file.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunValidation = async () => {
    if (!mapping.registerNumberCol) {
      setError('Please map the Register Number column.');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const result = await api.uploads.validate(uploadId, mapping, selectedExamId, selectedClassId);
      setValidationResult(result);
      goToStep(3); // Advance to preview & review step with browser history support
    } catch (err: any) {
      setError(err.message || 'Validation failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleImportMarks = async () => {
    if (!validationResult) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.uploads.importMarks(uploadId, selectedExamId, true);
      setSuccessMessage(res.message || 'Marks imported successfully into the institutional database.');
    } catch (err: any) {
      setError(err.message || 'Failed to import marks.');
    } finally {
      setImporting(false);
    }
  };

  const handleProceed = () => {
    if (!validationResult) return;
    const validRows = validationResult.rows.filter(r => r.status === 'VALID' || r.status === 'WARNING');
    if (validRows.length === 0) {
      setError('There are no valid student records to send notifications for.');
      return;
    }
    onProceedToSend(selectedExamId, validRows, fileName, uploadId);
  };

  // Filter rows for display
  const displayedRows = (validationResult?.rows || []).filter(r => {
    const matchesFilter = activeFilter === 'ALL' || r.status === activeFilter;
    const matchesSearch = searchQuery === '' ||
      r.registerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header and Step Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 ai-glass-card p-6 rounded-3xl">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <span>Upload Internal Examination Marks</span>
          </h2>
          <p className="text-xs text-slate-500 font-sans">
            Import college Excel marks sheets, automatically correlate with Admin Master Roster, and validate records.
          </p>
        </div>

        {/* Step tracker */}
        <div className="flex items-center gap-2">
          {/* Stepper Capsules */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner">
            <button
              onClick={() => goToStep(1)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition-all duration-200 ${
                step === 1
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 cursor-pointer'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 1 ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700 font-bold'
              }`}>1</span>
              <span>Upload</span>
            </button>

            <div className="w-2.5 h-0.5 bg-slate-300 rounded-full"></div>

            <button
              onClick={() => { if (fileName) goToStep(2); }}
              disabled={!fileName}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition-all duration-200 ${
                step === 2
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25'
                  : fileName
                  ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900 cursor-pointer'
                  : 'text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title={!fileName ? 'Upload an Excel file first' : 'Go to Column Mapping'}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 2 ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700 font-bold'
              }`}>2</span>
              <span>Map Columns</span>
            </button>

            <div className="w-2.5 h-0.5 bg-slate-300 rounded-full"></div>

            <button
              onClick={() => { if (validationResult) goToStep(3); }}
              disabled={!validationResult}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition-all duration-200 ${
                step === 3
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/25'
                  : validationResult
                  ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900 cursor-pointer'
                  : 'text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title={!validationResult ? 'Validate mapping first' : 'Go to Preview & Send'}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 3 ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700 font-bold'
              }`}>3</span>
              <span>Preview & Send</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-900 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 text-xs font-bold">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-900 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-indigo-700 hover:text-indigo-950 text-xs font-bold">✕</button>
        </div>
      )}

      {/* STEP 1: Select Department & Class, then Proceed to Upload Phase */}
      {step === 1 && (
        <div className="ai-glass-card rounded-3xl p-6 sm:p-8 space-y-7">
          {/* Card Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/70 gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                <GraduationCap className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-slate-900">Step 1: Class Selection & Marks Upload</h3>
                <p className="text-xs text-slate-500 font-sans">
                  Choose the Department and Class section, then upload the internal marks spreadsheet.
                </p>
              </div>
            </div>


          </div>

          {/* Phase 1: Academic & Class Selection Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Select Department & Academic Class</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-mono font-bold">
                {departments.find(d => d.id === selectedDepartmentId)?.code || 'IT'} • Year {selectedYear} • Sec {selectedSection}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200/80">
              {/* Department */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                  Department *
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                >
                  {departments.length === 0 && (
                    <option value="">-- No Departments Found --</option>
                  )}
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Year of Study */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                  Year of Study *
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const yr = e.target.value;
                    setSelectedYear(yr);
                    setSelectedSemester('5');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                >
                  <option value="3">3rd Year</option>
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                  Semester *
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                >
                  <option value="5">Semester 5</option>
                  <option value="6">Semester 6</option>
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                  Section *
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                >
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>
          </div>

          {/* Exam Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                Examination Assessment *
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
              >
                {exams.length === 0 && (
                  <option value="">-- No Examinations Found --</option>
                )}
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name} ({ex.academic_year} • Sem {ex.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold font-mono text-slate-600 uppercase tracking-wider mb-1.5">
                Academic Session
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026-27"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
              />
            </div>
          </div>

          {/* Phase 2: Upload Marks Excel Phase */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Upload Phase: Marks Excel Sheet</span>
              </span>
              <span className="text-xs text-slate-500 font-sans">
                Target: {departments.find(d => d.id === selectedDepartmentId)?.code || 'IT'} Sem {selectedSemester} Sec {selectedSection}
              </span>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-9 text-center cursor-pointer transition-all duration-300 group ${file
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/10'
                  : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-500/5 hover:shadow-lg'
                }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-200/80 flex items-center justify-center text-indigo-600 mx-auto mb-3.5 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              {file ? (
                <div>
                  <p className="text-base font-display font-bold text-indigo-900">{file.name}</p>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB • Click or drag another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm sm:text-base font-display font-bold text-slate-800">
                    Click to browse or drag and drop your Marks Excel sheet here
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-sans">
                    Auto-correlates student marks for Year {selectedYear} • Semester {selectedSemester} • Section {selectedSection}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 1 Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end pt-3 border-t border-slate-100 gap-3">
            <button
              onClick={handleUploadAndDetect}
              disabled={!file || uploading}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 text-white font-bold text-xs shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing File...</span>
                </>
              ) : (
                <>
                  <span>Upload & Detect Columns</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping Interface */}
      {step === 2 && (
        <div className="ai-glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="pb-4 border-b border-slate-200/70">
            <h3 className="text-base font-display font-bold text-slate-900">Configure Excel Column Mapping</h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              File: <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{fileName}</span> • Confirm that Excel columns correspond to the respective subject marks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Core Fields Mapping */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500">Core Student Identifiers</h4>

              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold font-mono text-slate-700">
                  Register Number Column <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mapping.registerNumberCol}
                  onChange={(e) => setMapping({ ...mapping, registerNumberCol: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                >
                  <option value="">-- Select Column --</option>
                  {detectedColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 font-sans">Unique student identifier e.g. REG NO or 922524205183</p>
              </div>
            </div>

            {/* Subject Columns Mapping */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500">Subject Marks Columns</h4>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  {subjects.length} Semester Subjects
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-200/80">
                {subjects.map((sub) => {
                  const availableSubjectColumns = detectedColumns.filter((c) =>
                    c !== mapping.registerNumberCol &&
                    !isNonSubjectColumn(c)
                  );
                  const displayCols = availableSubjectColumns.length > 0 ? availableSubjectColumns : detectedColumns;

                  return (
                    <div key={sub.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-xs font-display text-slate-900 truncate" title={sub.subject_name}>
                          {sub.subject_name}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold shrink-0 ml-1">
                          {sub.subject_code} • {sub.max_marks || 100}M
                        </span>
                      </div>
                      <select
                        value={mapping.subjectCols[sub.id] || ''}
                        onChange={(e) => {
                          const updated = { ...mapping.subjectCols };
                          if (e.target.value) {
                            updated[sub.id] = e.target.value;
                          } else {
                            delete updated[sub.id];
                          }
                          setMapping({ ...mapping, subjectCols: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 bg-white font-medium shadow-2xs"
                      >
                        <option value="">-- Not in this sheet --</option>
                        {displayCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200/70">
            <button
              onClick={() => goToStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              ← Back to File
            </button>

            <button
              onClick={handleRunValidation}
              disabled={validating}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 text-white font-bold text-xs shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {validating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Data...</span>
                </>
              ) : (
                <>
                  <span>Validate Data & Preview Records</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview Records & Validation Status (Section 8) */}
      {step === 3 && validationResult && (
        <div className="space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="ai-glass-card p-4 rounded-2xl">
              <div className="text-[11px] font-bold font-mono text-slate-500 uppercase">Total Students</div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{validationResult.totalRows}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Records in Excel</div>
            </div>

            <div className="ai-glass-card p-4 rounded-2xl">
              <div className="text-[11px] font-bold font-mono text-indigo-600 uppercase">Passed (60+)</div>
              <div className="text-2xl font-extrabold font-mono text-indigo-600 mt-1">
                {validationResult.rows.filter(r => r.result === 'PASS' || (Object.values(r.marks).length > 0 && Object.values(r.marks).every(m => m >= 60))).length}
              </div>
              <div className="text-[11px] text-indigo-600/80 mt-0.5">All subjects ≥ 60</div>
            </div>

            <div className="ai-glass-card p-4 rounded-2xl">
              <div className="text-[11px] font-bold font-mono text-rose-600 uppercase">Failed (&lt;60)</div>
              <div className="text-2xl font-extrabold font-mono text-rose-600 mt-1">
                {validationResult.rows.filter(r => r.result === 'FAIL' || (Object.values(r.marks).some(m => m < 60))).length}
              </div>
              <div className="text-[11px] text-rose-600/80 mt-0.5">Any subject &lt; 60</div>
            </div>

            <div className="ai-glass-card p-4 rounded-2xl">
              <div className="text-[11px] font-bold font-mono text-amber-600 uppercase">Warnings / Errors</div>
              <div className="text-2xl font-extrabold font-mono text-amber-600 mt-1">{validationResult.warningRows + validationResult.errorRows}</div>
              <div className="text-[11px] text-amber-600/80 mt-0.5">Auto-joined from Master</div>
            </div>
          </div>

          {/* 2-Excel Collision Engine Breakdown */}
          {validationResult.classSync && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 shadow-xl border border-slate-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-display font-extrabold text-white flex items-center gap-2">
                      <span>2-Excel Collision & Correlation Engine</span>
                      <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                        Matched by Reg No
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 font-sans">
                      Admin Constant Master (Excel 1) ⚡ Faculty Marks Sheet (Excel 2)
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  Class: {validationResult.classSync.className || `Year ${selectedYear} - Sec ${selectedSection}`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Matched / Correlated */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 backdrop-blur-xs">
                  <div className="text-[11px] font-bold font-mono uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Merged & Correlated</span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-white">
                    {validationResult.classSync.matchedCount}
                    <span className="text-xs font-normal text-slate-400 ml-1">/ {validationResult.classSync.totalClassStudents} Students</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    Register numbers matched with Admin Constant Excel. Parent numbers & names merged.
                  </div>
                </div>

                {/* 2. Absent in Marks Sheet */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 backdrop-blur-xs">
                  <div className="text-[11px] font-bold font-mono uppercase tracking-wider text-amber-400 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5" />
                      <span>Absent / Missing Marks</span>
                    </div>
                    {validationResult.classSync.absentStudents.length > 0 && (
                      <button
                        onClick={() => setShowAbsentList(!showAbsentList)}
                        className="text-[10px] text-amber-300 underline font-semibold hover:text-amber-200"
                      >
                        {showAbsentList ? 'Hide' : 'View List'}
                      </button>
                    )}
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-amber-300">
                    {validationResult.classSync.absentStudents.length}
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    Students in constant roster who were absent or missing in Marks Excel.
                  </div>
                </div>

                {/* 3. Unrecognized Register Numbers */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 backdrop-blur-xs">
                  <div className="text-[11px] font-bold font-mono uppercase tracking-wider text-rose-400 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Unrecognized Roll Nos</span>
                    </div>
                    {validationResult.classSync.unrecognizedRegisterNumbers.length > 0 && (
                      <button
                        onClick={() => setShowUnrecognizedList(!showUnrecognizedList)}
                        className="text-[10px] text-rose-300 underline font-semibold hover:text-rose-200"
                      >
                        {showUnrecognizedList ? 'Hide' : 'View List'}
                      </button>
                    )}
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-rose-300">
                    {validationResult.classSync.unrecognizedRegisterNumbers.length}
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    Roll numbers in Marks Excel not found in this class master roster.
                  </div>
                </div>
              </div>

              {/* Expandable Absent Students List */}
              {showAbsentList && validationResult.classSync.absentStudents.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-2 animate-in fade-in">
                  <div className="font-bold text-amber-200 font-display">
                    Absent / Unmarked Students in this Examination ({validationResult.classSync.absentStudents.length}):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {validationResult.classSync.absentStudents.map((std) => (
                      <div key={std.registerNumber} className="bg-black/40 p-2.5 rounded-xl border border-amber-500/20 text-[11px]">
                        <div className="font-bold font-mono text-white">{std.registerNumber}</div>
                        <div className="text-amber-200/90 truncate">{std.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Unrecognized Register Numbers List */}
              {showUnrecognizedList && validationResult.classSync.unrecognizedRegisterNumbers.length > 0 && (
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 text-xs space-y-2 animate-in fade-in">
                  <div className="font-bold text-rose-200 font-display">
                    Unrecognized Register Numbers in Uploaded File ({validationResult.classSync.unrecognizedRegisterNumbers.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {validationResult.classSync.unrecognizedRegisterNumbers.map((reg) => (
                      <span key={reg} className="px-2.5 py-1 rounded-lg bg-rose-900/60 border border-rose-500/40 text-rose-200 font-mono text-[11px]">
                        {reg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="ai-glass-card p-4.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                All ({validationResult.totalRows})
              </button>
              <button
                onClick={() => setActiveFilter('VALID')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'VALID' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
              >
                Valid ({validationResult.validRows})
              </button>
              <button
                onClick={() => setActiveFilter('WARNING')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'WARNING' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
              >
                Warnings ({validationResult.warningRows})
              </button>
              <button
                onClick={() => setActiveFilter('ERROR')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilter === 'ERROR' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
              >
                Errors ({validationResult.errorRows})
              </button>
            </div>

            {/* Search and Error report download */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or reg no..."
                  className="pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                />
              </div>

              {validationResult.errorRows > 0 && (
                <a
                  href={api.uploads.getErrorReportUrl(uploadId)}
                  download
                  className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Error Report</span>
                </a>
              )}
            </div>
          </div>

          {/* Interactive Preview Table with Result Status (PASS / FAIL) */}
          <div className="ai-glass-card rounded-3xl overflow-hidden border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Row</th>
                    <th className="py-3.5 px-4">Register No</th>
                    <th className="py-3.5 px-4">Student Name</th>
                    {/* Render mapped subject headers */}
                    {Object.keys(validationResult.rows[0]?.marks || {}).map((subName) => (
                      <th key={subName} className="py-3.5 px-3 text-center">{subName}</th>
                    ))}
                    <th className="py-3.5 px-3 text-center">Total</th>
                    <th className="py-3.5 px-3 text-center">Result</th>
                    <th className="py-3.5 px-4">Student Mobile</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Issues / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 font-medium">
                  {displayedRows.length > 0 ? (
                    displayedRows.map((r) => {
                      const isPass = r.result === 'PASS' || (Object.values(r.marks).length > 0 && Object.values(r.marks).every(m => m >= 60));

                      return (
                        <tr
                          key={r.rowNumber}
                          className={`hover:bg-slate-50/80 transition-colors ${r.status === 'ERROR' ? 'bg-rose-50/40' : r.status === 'WARNING' ? 'bg-amber-50/30' : ''
                            }`}
                        >
                          <td className="py-3 px-4 font-mono text-slate-400">{r.rowNumber}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.registerNumber}</td>
                          <td className="py-3 px-4 text-slate-800 font-display">
                            <div>{r.studentName}</div>
                            {r.mobileSource === 'DATABASE' && (
                              <span className="inline-block text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full mt-0.5">
                                Master Roster
                              </span>
                            )}
                          </td>

                          {/* Subject Marks */}
                          {Object.entries(r.marks).map(([sub, mark]) => (
                            <td key={sub} className="py-3 px-3 text-center font-mono">
                              <span className={mark < 60 ? 'text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg' : 'text-slate-700 font-semibold'}>
                                {mark}
                              </span>
                            </td>
                          ))}

                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                            {r.totalMarks}/{r.maxMarks}
                          </td>

                          {/* Result Status: PASS (60+) or FAIL (<60 in any subject) */}
                          <td className="py-3 px-3 text-center">
                            {isPass ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                FAIL
                              </span>
                            )}
                          </td>

                          {/* Masked Student Mobile */}
                          <td className="py-3 px-4 font-mono text-slate-600">
                            <div>{r.parentMobileMasked}</div>
                            {r.mobileSource === 'DATABASE' && (
                              <span className="inline-block text-[9px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full mt-0.5">
                                Constant Contact
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${r.status === 'VALID' ? 'bg-indigo-100 text-indigo-800' :
                                r.status === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                                  'bg-rose-100 text-rose-800'
                              }`}>
                              {r.status === 'VALID' ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> :
                                r.status === 'WARNING' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> :
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                              <span>{r.status}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs">
                            {r.issues && r.issues.length > 0 ? (
                              <div className="space-y-1">
                                {r.issues.map((iss, i) => (
                                  <div
                                    key={i}
                                    className={`text-[11px] font-medium leading-tight ${iss.type === 'ERROR' ? 'text-rose-600' : 'text-amber-700'
                                      }`}
                                  >
                                    • {iss.field}: {iss.message}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                                <Check className="w-3.5 h-3.5" /> All checks passed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                        No records match the current filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Confirmation & Action Bar with Step Navigation */}
          <div className="ai-glass-card p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => goToStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
              >
                <span>← Back to Column Mapping</span>
              </button>

              <button
                onClick={handleImportMarks}
                disabled={importing || validationResult.validRows === 0}
                className="px-4 py-2.5 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-2xs active:scale-95"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{importing ? 'Saving to Database...' : 'Save Marks to DB'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono">
                {validationResult.validRows + validationResult.warningRows} student records ready
              </span>

              <button
                onClick={handleProceed}
                disabled={validationResult.validRows === 0}
                className="px-7 py-3 rounded-2xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] hover:to-[#2d0811] active:scale-95 text-[#fff3b8] font-bold text-xs shadow-lg hover:shadow-[#7A1A2C]/30 border border-[#C08A16]/40 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>Proceed to Choose Template &amp; Send</span>
                <ArrowRight className="w-4 h-4 text-[#F6C84C]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faculty View Constant Class Roster Modal */}
      {showMasterRosterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Admin Constant Class Master Roster
                  </h3>
                  <p className="text-xs text-slate-500">
                    Year {selectedYear} • Section {selectedSection} • {classStudents.length} Students Pre-configured
                  </p>
                </div>
              </div>
              <button onClick={() => setShowMasterRosterModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 text-xs text-indigo-900 border border-indigo-200">
              💡 <strong>Faculty Guide:</strong> This is the constant student list uploaded by Admin. When you upload your marks sheet, the system uses the <strong>Register Number</strong> to merge your subject marks with these students.
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Register Number</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Student Mobile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {classStudents.length > 0 ? (
                    classStudents.map((std, idx) => (
                      <tr key={std.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{std.register_number}</td>
                        <td className="py-2 px-3 text-slate-800">{std.name}</td>
                        <td className="py-2 px-3 text-slate-600 font-bold">{std.class_section || selectedSection}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{std.mobile_number_masked || 'Verified'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No students enrolled yet in this class. Admin can upload the constant roster on the Students page.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDownloadClassMarksTemplate}
                className="px-4 py-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Download Marks Entry Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMasterRosterModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
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
