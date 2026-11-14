import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  EyeOff,
  Filter,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  HeartHandshake,
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { api } from '../services/api';
import { Student, Department, ClassItem } from '../types';

interface StudentsProps {
  isAdmin: boolean;
  onNavigateToUpload?: (deptId: string, classId: string) => void;
}

export const Students: React.FC<StudentsProps> = ({ isAdmin, onNavigateToUpload }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadMasterModal, setShowUploadMasterModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Constant Class Master Upload State
  const [masterDeptId, setMasterDeptId] = useState('');
  const [masterYear, setMasterYear] = useState('3');
  const [masterSection, setMasterSection] = useState('C');
  const [masterAcademicYear, setMasterAcademicYear] = useState('2026-27');
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [masterParsedRows, setMasterParsedRows] = useState<any[]>([]);
  const [masterValidationErrors, setMasterValidationErrors] = useState<string[]>([]);
  const [importingMaster, setImportingMaster] = useState(false);
  const [masterSuccessMsg, setMasterSuccessMsg] = useState<string | null>(null);
  const [masterErrorMsg, setMasterErrorMsg] = useState<string | null>(null);
  const masterFileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    register_number: '',
    name: '',
    email: '',
    department_id: '',
    class_id: '',
    year: '3',
    section: 'C',
    parent_name: '',
    mobile_number: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Unmask toggles for individual rows
  const [unmaskedRows, setUnmaskedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMetadata();
    loadStudents();
  }, [departmentFilter, classFilter]);

  const loadMetadata = async () => {
    try {
      const [depts, clss] = await Promise.all([
        api.academic.getDepartments(),
        api.academic.getClasses()
      ]);
      setDepartments(depts);
      setClasses(clss);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await api.students.list({
        search,
        department_id: departmentFilter,
        class_id: classFilter
      });
      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const handleOpenDetails = async (std: Student) => {
    setSelectedStudent(std);
    setLoadingDetails(true);
    try {
      const details = await api.students.getById(std.id);
      setStudentDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.register_number || !formData.name || !formData.parent_name || !formData.mobile_number) {
      setFormError('Register No, Student Name, Parent Name, and Mobile Number are required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await api.students.create(formData);
      setShowAddModal(false);
      setFormData({
        register_number: '',
        name: '',
        email: '',
        department_id: '',
        class_id: '',
        year: '2',
        section: 'A',
        parent_name: '',
        mobile_number: ''
      });
      await loadStudents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save student.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete student '${name}'? This removes related marks and parent records.`)) {
      return;
    }
    try {
      await api.students.delete(id);
      await loadStudents();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const toggleUnmask = (id: string) => {
    setUnmaskedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenMasterModal = () => {
    if (departments.length > 0 && !masterDeptId) {
      setMasterDeptId(departments[0].id);
    }
    setMasterFile(null);
    setMasterParsedRows([]);
    setMasterValidationErrors([]);
    setMasterSuccessMsg(null);
    setMasterErrorMsg(null);
    setShowUploadMasterModal(true);
  };

  const handleDownloadMasterTemplate = () => {
    const selectedDept = departments.find(d => d.id === masterDeptId) || departments[0];
    const deptCode = selectedDept ? selectedDept.code : 'CSE';
    const filename = `Constant_Student_Roster_${deptCode}_Yr${masterYear}_Sec${masterSection}.xlsx`;

    // Only 3 core columns needed: Registration Number, Student Name, Student Mobile Number
    const sampleData = [
      {
        'Registration Number': `24${deptCode}001`,
        'Student Name': 'Aravind Kumar',
        'Student Mobile Number': '9876543210'
      },
      {
        'Registration Number': `24${deptCode}002`,
        'Student Name': 'Bhavani Devi',
        'Student Mobile Number': '9876543211'
      },
      {
        'Registration Number': `24${deptCode}003`,
        'Student Name': 'Chandran S',
        'Student Mobile Number': '9876543212'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sec_${masterSection}_Roster`);
    XLSX.writeFile(wb, filename);
  };

  const handleMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processMasterExcelFile(file);
    }
  };

  const handleMasterFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMasterExcelFile(e.dataTransfer.files[0]);
    }
  };

  const processMasterExcelFile = async (file: File) => {
    setMasterFile(file);
    setMasterErrorMsg(null);
    setMasterSuccessMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setMasterErrorMsg('The selected Excel file has no student rows.');
        setMasterParsedRows([]);
        return;
      }

      const columns = Object.keys(rawRows[0]);
      const regCol = columns.find(c => /reg|roll|std.*id/i.test(c)) || columns[0];
      const nameCol = columns.find(c => /name|student/i.test(c)) || columns[1];
      const phoneCol = columns.find(c => /mobile|phone|contact|whatsapp/i.test(c)) || columns.find(c => /parent.*phone|parent.*mobile/i.test(c));
      const parentCol = columns.find(c => /parent.*name|guardian|father|mother/i.test(c));
      const sectionCol = columns.find(c => /sec|section/i.test(c));
      const emailCol = columns.find(c => /email|mail/i.test(c));

      const parsed: any[] = [];
      const errors: string[] = [];
      const seenRegs = new Set<string>();

      rawRows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const regNo = String(r[regCol] || '').trim().toUpperCase();
        const name = String(r[nameCol] || '').trim();
        const rawPhone = phoneCol ? String(r[phoneCol] || '').trim() : '';
        let cleanPhone = rawPhone.replace(/\D/g, '');
        if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.substring(2);

        const parentName = parentCol ? String(r[parentCol] || '').trim() : (name ? `${name}'s Parent` : 'Parent');
        const sec = sectionCol ? String(r[sectionCol] || '').trim().toUpperCase() : masterSection;
        const email = emailCol ? String(r[emailCol] || '').trim() : '';

        const issues: string[] = [];
        if (!regNo) issues.push('Missing Register No');
        if (!name) issues.push('Missing Student Name');
        if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
          issues.push(`Invalid phone '${rawPhone || 'Missing'}'`);
        }
        if (seenRegs.has(regNo)) {
          issues.push(`Duplicate Register No '${regNo}'`);
        } else if (regNo) {
          seenRegs.add(regNo);
        }

        if (issues.length > 0) {
          errors.push(`Row ${rowNum} (${regNo || 'Empty'}): ${issues.join(', ')}`);
        }

        parsed.push({
          rowNum,
          register_number: regNo,
          name,
          parent_name: parentName,
          mobile_number: cleanPhone || rawPhone,
          section: sec || masterSection,
          email,
          isValid: issues.length === 0,
          issues
        });
      });

      setMasterParsedRows(parsed);
      setMasterValidationErrors(errors);
    } catch (err: any) {
      console.error(err);
      setMasterErrorMsg(err.message || 'Failed to parse Excel file.');
    }
  };

  const handleImportMasterRoster = async () => {
    if (masterParsedRows.length === 0) return;
    const validRows = masterParsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setMasterErrorMsg('No valid rows available to import. Please correct Excel errors.');
      return;
    }

    setImportingMaster(true);
    setMasterErrorMsg(null);
    setMasterSuccessMsg(null);

    try {
      const res = await api.students.importClassMaster({
        department_id: masterDeptId,
        year: masterYear,
        section: masterSection,
        academic_year: masterAcademicYear,
        students: validRows.map(r => ({
          register_number: r.register_number,
          name: r.name,
          parent_name: r.parent_name,
          mobile_number: r.mobile_number,
          section: r.section,
          email: r.email
        }))
      });

      setMasterSuccessMsg(res.message || `Successfully imported ${validRows.length} constant class student records!`);
      await loadStudents();
      await loadMetadata();
    } catch (err: any) {
      setMasterErrorMsg(err.message || 'Failed to save master class roster.');
    } finally {
      setImportingMaster(false);
    }
  };

  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [cleanResultMsg, setCleanResultMsg] = useState<string | null>(null);

  const handleCleanDuplicates = async () => {
    if (!window.confirm('Are you sure you want to clean and erase any duplicate or orphan records from the database?')) {
      return;
    }
    setCleaningDuplicates(true);
    setCleanResultMsg(null);
    try {
      const res = await api.students.cleanDuplicates();
      setCleanResultMsg(res.message || 'Database deduplication completed successfully.');
      await loadStudents();
      await loadMetadata();
    } catch (err: any) {
      alert(`Failed to erase duplicates: ${err.message}`);
    } finally {
      setCleaningDuplicates(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-heading font-extrabold text-[#2B1B1B] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7A1A2C]/10 flex items-center justify-center text-[#7A1A2C] border border-[#7A1A2C]/20">
              <Users className="w-5 h-5" />
            </div>
            <span>Student Directory</span>
          </h2>
          <p className="text-xs text-[#7A6A63] font-sans">
            Registered students, constant class rosters (set by Admin), and verified student contact records.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleCleanDuplicates}
              disabled={cleaningDuplicates}
              className="px-3.5 py-2.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              title="Scan and erase duplicate student registrations and orphan records"
            >
              {cleaningDuplicates ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7A6A63]" />
                  <span>Cleaning...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 text-[#C62828]" />
                  <span>Erase Duplicates</span>
                </>
              )}
            </button>

            <button
              onClick={handleOpenMasterModal}
              className="px-4 py-2.5 rounded-xl bg-[#C08A16] hover:bg-[#9d6d0d] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 border border-[#F6C84C]/30 active:scale-95"
              title="Upload constant Excel roster (Student Roll, Name, Student Mobile) for a class"
            >
              <UploadCloud className="w-4 h-4 text-[#fff3b8]" />
              <span>Upload Constant Class Excel</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] text-[#fff3b8] text-xs font-bold shadow-md shadow-[#7A1A2C]/20 transition-all flex items-center gap-1.5 border border-[#C08A16]/30 active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#F6C84C]" />
              <span>Add Single Student</span>
            </button>
          </div>
        )}
      </div>

      {cleanResultMsg && (
        <div className="p-4 rounded-xl bg-[#2E7D32]/10 border border-[#2E7D32]/30 text-xs text-[#2B1B1B] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0" />
            <span className="font-bold font-sans">{cleanResultMsg}</span>
          </div>
          <button onClick={() => setCleanResultMsg(null)} className="text-[#7A6A63] hover:text-[#2B1B1B] font-bold text-xs">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7A6A63] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Reg No..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#EADFD3] text-xs font-sans text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] bg-[#F5EFE8]"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-[#7A1A2C] text-[#fff3b8] text-xs font-bold hover:bg-[#631524] transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#7A6A63] font-mono text-xs">
            <Filter className="w-3.5 h-3.5 text-[#C08A16]" />
            <span className="font-bold">Dept:</span>
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#EADFD3] text-xs font-semibold bg-white text-[#2B1B1B] shadow-2xs focus:ring-2 focus:ring-[#7A1A2C]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-[#7A6A63] font-mono ml-2 text-xs">
            <span className="font-bold">Class:</span>
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#EADFD3] text-xs font-semibold bg-white text-[#2B1B1B] shadow-2xs focus:ring-2 focus:ring-[#7A1A2C]"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>Year {c.year} - Sec {c.section}</option>
            ))}
          </select>

          {/* Upload Marks shortcut — shown when a specific dept + class is filtered */}
          {departmentFilter && classFilter && onNavigateToUpload && (
            <button
              onClick={() => onNavigateToUpload(departmentFilter, classFilter)}
              className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#7A1A2C] hover:bg-[#631524] text-[#fff3b8] text-xs font-bold shadow-sm transition-all active:scale-95 border border-[#C08A16]/30"
              title="Go to Upload Marks pre-filled with this department & class"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#F6C84C]" />
              <span>Upload Marks</span>
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#EADFD3] shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="w-8 h-8 border-4 border-[#7A1A2C] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FBF7F2] border-b border-[#EADFD3] text-[#2B1B1B] font-bold font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Register No</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Parent Name</th>
                  <th className="py-3.5 px-4">Student Mobile</th>
                  <th className="py-3.5 px-4">Parent Mobile</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECE4] font-medium bg-white">
                {students.length > 0 ? (
                  students.map((s) => {
                    const isUnmasked = !!unmaskedRows[s.id];
                    const displayedStudentPhone = isUnmasked ? (s.student_mobile || s.mobile_number) : (s.student_mobile_masked || s.mobile_number_masked);
                    const displayedParentPhone = isUnmasked ? (s.parent_mobile || s.parent_phone || s.mobile_number) : (s.parent_mobile_masked || s.parent_phone_masked || s.mobile_number_masked);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.register_number}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-display">
                          <div className="font-bold">{s.name}</div>
                          {s.email && <div className="text-[10px] font-mono text-slate-400">{s.email}</div>}
                        </td>
                        <td className="py-3.5 px-4 text-[#7A6A63]">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F5EFE8] text-[#7A1A2C] border border-[#EADFD3] font-mono font-bold text-[10px]">
                            {s.department_code || 'IT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#2B1B1B] font-mono text-xs">
                          Year {s.class_year || '3'} • Sec {s.class_section || 'C'}
                        </td>
                        <td className="py-3.5 px-4 text-[#2B1B1B]">{s.parent_name || 'N/A'}</td>
                        <td className="py-3.5 px-4 font-mono text-[#7A6A63]">
                          <div className="flex items-center gap-1.5">
                            <span>{displayedStudentPhone || 'Missing'}</span>
                            {isAdmin && (s.student_mobile || s.mobile_number) && (
                              <button
                                onClick={() => toggleUnmask(s.id)}
                                title={isUnmasked ? 'Mask' : 'Reveal student phone'}
                                className="text-[#7A6A63] hover:text-[#7A1A2C]"
                              >
                                {isUnmasked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-[#C08A16]" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#7A6A63]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#2B1B1B]">{displayedParentPhone || 'Missing'}</span>
                            {isAdmin && (s.parent_mobile || s.parent_phone || s.mobile_number) && (
                              <button
                                onClick={() => toggleUnmask(s.id)}
                                title={isUnmasked ? 'Mask' : 'Reveal parent phone'}
                                className="text-[#7A6A63] hover:text-[#7A1A2C]"
                              >
                                {isUnmasked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-[#C08A16]" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDetails(s)}
                              title="View Marks & Details"
                              className="p-2 rounded-xl border border-[#EADFD3] hover:bg-[#FBF7F2] text-[#2B1B1B] transition-all shadow-2xs active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#7A1A2C]" />
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteStudent(s.id, s.name)}
                                title="Delete Student"
                                className="p-2 rounded-xl border border-red-200 hover:bg-red-50 text-[#C62828] transition-all shadow-2xs active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Student & Parent Contact</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Register No *</label>
                  <input
                    type="text"
                    value={formData.register_number}
                    onChange={(e) => setFormData({ ...formData, register_number: e.target.value })}
                    placeholder="24CS011"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Sanjay Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class Section</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Year {c.year} - Sec {c.section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Parent Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Name *</label>
                    <input
                      type="text"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      placeholder="M. Kumar"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number (10-digits) *</label>
                    <input
                      type="tel"
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Details & Marks History Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedStudent.register_number} • {selectedStudent.department_name || 'CSE'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : studentDetails ? (
              <div className="space-y-4">
                {/* Parent Contact Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Parent / Guardian:</span>
                    <div className="font-semibold text-slate-800">{studentDetails.parent_name || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Registered Mobile:</span>
                    <div className="font-mono font-semibold text-slate-800">{studentDetails.mobile_number || 'N/A'}</div>
                  </div>
                </div>

                {/* Marks History */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <span>Recorded Internal Marks History</span>
                  </h4>
                  {studentDetails.marks && studentDetails.marks.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Exam</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3 text-center">Marks Obtained</th>
                            <th className="py-2.5 px-3 text-center">Max Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {studentDetails.marks.map((m: any) => (
                            <tr key={m.id}>
                              <td className="py-2 px-3 font-semibold text-slate-800">{m.exam_name}</td>
                              <td className="py-2 px-3 text-slate-700">{m.subject_name} ({m.subject_code})</td>
                              <td className="py-2 px-3 text-center font-bold text-slate-900">{m.marks_obtained}</td>
                              <td className="py-2 px-3 text-center font-mono text-slate-500">{m.max_marks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No marks recorded yet for this student.</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Constant Class Master Excel Modal (Admin Only) */}
      {showUploadMasterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center font-bold shadow-xs">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload Constant Class Master Excel (Admin Only)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Required Columns: <strong>Registration Number</strong>, <strong>Student Name</strong>, and <strong>Student Mobile Number</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadMasterModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Callout */}
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Faculty Auto-Correlation Rule:</span> When faculty logs in to upload internal marks, this constant student roster will be displayed to them. When they upload marks, the system will automatically match the two Excel files using the <strong>Register Number</strong>.
              </div>
            </div>

            {/* Academic Target Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department *
                </label>
                <select
                  value={masterDeptId}
                  onChange={(e) => setMasterDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Year *
                </label>
                <select
                  value={masterYear}
                  onChange={(e) => setMasterYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="3">3rd Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section *
                </label>
                <select
                  value={masterSection}
                  onChange={(e) => setMasterSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>

            {/* Template Download & File Drag-and-drop */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Excel File (.xlsx, .xls)
              </div>
              <button
                type="button"
                onClick={handleDownloadMasterTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Download Sample Template</span>
              </button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleMasterFileDrop}
              onClick={() => masterFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${masterFile
                ? 'border-indigo-500 bg-indigo-50/40'
                : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20'
                }`}
            >
              <input
                type="file"
                ref={masterFileInputRef}
                onChange={handleMasterFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-indigo-600 mx-auto mb-2">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              {masterFile ? (
                <div>
                  <p className="text-xs font-bold text-indigo-800">{masterFile.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {(masterFile.size / 1024).toFixed(1)} KB • {masterParsedRows.length} student rows parsed
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drop constant student roster Excel here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Required Columns: Registration Number, Student Name, Student Mobile Number
                  </p>
                </div>
              )}
            </div>

            {/* Error and Success Alerts */}
            {masterErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center justify-between">
                <span>{masterErrorMsg}</span>
                <button onClick={() => setMasterErrorMsg(null)} className="text-rose-500 font-bold">✕</button>
              </div>
            )}

            {masterSuccessMsg && (
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-800 text-xs border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{masterSuccessMsg}</span>
                </div>
                <button onClick={() => setMasterSuccessMsg(null)} className="text-indigo-500 font-bold">✕</button>
              </div>
            )}

            {/* Parsed Rows Preview */}
            {masterParsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Parsed Preview ({masterParsedRows.filter(r => r.isValid).length} Valid, {masterParsedRows.filter(r => !r.isValid).length} Errors)
                  </span>
                  {masterValidationErrors.length > 0 && (
                    <span className="text-rose-600 font-medium">
                      ⚠️ {masterValidationErrors.length} issues detected
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Reg No</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3">Section</th>
                        <th className="py-2 px-3">Student Mobile</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {masterParsedRows.map((r) => (
                        <tr key={r.rowNum} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                          <td className="py-1.5 px-3 font-mono text-slate-400">{r.rowNum}</td>
                          <td className="py-1.5 px-3 font-bold text-slate-900">{r.register_number || 'Missing'}</td>
                          <td className="py-1.5 px-3 text-slate-800">{r.name || 'Missing'}</td>
                          <td className="py-1.5 px-3 font-bold text-slate-600">{r.section}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-700">{r.mobile_number || 'Missing'}</td>
                          <td className="py-1.5 px-3">
                            {r.isValid ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                                VALID
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]" title={r.issues.join(', ')}>
                                {r.issues[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadMasterModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleImportMasterRoster}
                disabled={importingMaster || masterParsedRows.length === 0 || masterParsedRows.filter(r => r.isValid).length === 0}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {importingMaster ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Constant Roster...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Save Constant Class Roster</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
