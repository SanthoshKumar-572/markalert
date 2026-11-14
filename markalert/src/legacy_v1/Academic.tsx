import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Layers,
  GraduationCap,
  Calendar,
  X,
  FileCheck,
  Building2,
  Edit2,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  Award,
  Filter,
  Users,
  UserCheck,
  ShieldCheck,
  UploadCloud,
  Mail,
  Key,
  Shield,
  Check,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { Department, ClassItem, Subject, Exam, FacultyClassAssignment } from '../types';

interface AcademicProps {
  isAdmin: boolean;
  onNavigate?: (tab: string) => void;
}

export const Academic: React.FC<AcademicProps> = ({ isAdmin, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'faculty' | 'assignments' | 'classes' | 'departments' | 'subjects' | 'exams'>(
    isAdmin ? 'faculty' : 'classes'
  );

  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<FacultyClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>('ALL');

  // Modals
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);

  // Forms
  const [facultyForm, setFacultyForm] = useState({
    name: '',
    email: '',
    department_id: '',
    password: 'Faculty@123',
    is_active: 1
  });
  const [assignForm, setAssignForm] = useState({
    faculty_id: '',
    class_id: '',
    academic_year: '2026-27'
  });
  const [subjectForm, setSubjectForm] = useState({
    subject_code: '',
    subject_name: '',
    max_marks: 100,
    pass_marks: 50,
    semester: '5',
    department_id: ''
  });
  const [examForm, setExamForm] = useState({
    exam_name: '',
    academic_year: '2026-27',
    semester: '5',
    class_id: '',
    department_id: '',
    exam_date: ''
  });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [classForm, setClassForm] = useState({
    name: '',
    department_id: '',
    academic_year: '2026-27',
    semester: '5',
    section: 'A'
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [deptList, classList, subList, examList, facList, assignList] = await Promise.all([
        api.academic.getDepartments(),
        isAdmin ? api.academic.getClasses() : api.academic.getMyClasses(),
        api.academic.getSubjects(),
        api.academic.getExams(),
        isAdmin ? api.academic.getFaculty().catch(() => []) : Promise.resolve([]),
        isAdmin ? api.academic.getFacultyAssignments().catch(() => []) : Promise.resolve([])
      ]);
      setDepartments(deptList || []);
      setClasses(classList || []);
      setSubjects(subList || []);
      setExams(examList || []);
      setFacultyList(facList || []);
      setAssignments(assignList || []);

      if (deptList && deptList.length > 0) {
        setSubjectForm(prev => ({ ...prev, department_id: prev.department_id || deptList[0].id }));
        setClassForm(prev => ({ ...prev, department_id: prev.department_id || deptList[0].id }));
        setFacultyForm(prev => ({ ...prev, department_id: prev.department_id || deptList[0].id }));
      }
      if (facList && facList.length > 0 && classList && classList.length > 0) {
        setAssignForm(prev => ({
          ...prev,
          faculty_id: prev.faculty_id || facList[0].id,
          class_id: prev.class_id || classList[0].id
        }));
      }
      if (classList && classList.length > 0) {
        setExamForm(prev => ({ ...prev, class_id: prev.class_id || classList[0].id }));
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load academic records' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      subject_code: '',
      subject_name: '',
      max_marks: 100,
      pass_marks: 50,
      semester: selectedSemester !== 'ALL' ? selectedSemester : '5',
      department_id: departments[0]?.id || ''
    });
    setShowSubjectModal(true);
  };

  const openEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setSubjectForm({
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      max_marks: sub.max_marks || 100,
      pass_marks: sub.pass_marks ?? Math.round((sub.max_marks || 100) * 0.5),
      semester: sub.semester || '5',
      department_id: sub.department_id || departments[0]?.id || ''
    });
    setShowSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await api.academic.updateSubject(editingSubject.id, subjectForm);
        setStatusMessage({ type: 'success', text: `Subject '${subjectForm.subject_code}' updated successfully.` });
      } else {
        await api.academic.createSubject(subjectForm);
        setStatusMessage({ type: 'success', text: `Subject '${subjectForm.subject_code}' created with pass cutoff.` });
      }
      setShowSubjectModal(false);
      setEditingSubject(null);
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error saving subject: ${err.message}` });
    }
  };

  const handleDeleteSubject = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete subject '${code}'?`)) return;
    try {
      await api.academic.deleteSubject(id);
      setStatusMessage({ type: 'success', text: `Subject '${code}' deleted.` });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error deleting subject: ${err.message}` });
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.academic.createExam(examForm);
      setShowExamModal(false);
      setExamForm({ exam_name: '', academic_year: '2026-27', semester: '5', class_id: classes[0]?.id || '', department_id: '', exam_date: '' });
      setStatusMessage({ type: 'success', text: 'Exam session created.' });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error creating exam: ${err.message}` });
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.academic.createDepartment(deptForm);
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      setStatusMessage({ type: 'success', text: 'Department added.' });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Auto-generate name if empty (e.g. IT-A)
      const dept = departments.find(d => d.id === classForm.department_id);
      const generatedName = classForm.name.trim() || (dept ? `${dept.code}-${classForm.section}` : `CLASS-${classForm.section}`);
      await api.academic.createClass({ ...classForm, name: generatedName });
      setShowClassModal(false);
      setClassForm({ name: '', department_id: departments[0]?.id || '', academic_year: '2026-27', semester: '5', section: 'A' });
      setStatusMessage({ type: 'success', text: `Class '${generatedName}' created.` });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleSaveFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFaculty) {
        await api.academic.updateFaculty(editingFaculty.id, facultyForm);
        setStatusMessage({ type: 'success', text: `Faculty member '${facultyForm.name}' updated.` });
      } else {
        await api.academic.createFaculty(facultyForm);
        setStatusMessage({ type: 'success', text: `Faculty member '${facultyForm.name}' added successfully.` });
      }
      setShowFacultyModal(false);
      setEditingFaculty(null);
      setFacultyForm({
        name: '',
        email: '',
        department_id: departments[0]?.id || '',
        password: 'Faculty@123',
        is_active: 1
      });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleDeleteFaculty = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove faculty member '${name}'?`)) return;
    try {
      await api.academic.deleteFaculty(id);
      setStatusMessage({ type: 'success', text: `Faculty member '${name}' removed.` });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.academic.createFacultyAssignment(assignForm);
      setShowAssignModal(false);
      setStatusMessage({ type: 'success', text: 'Faculty assigned to class successfully.' });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Assignment failed: ${err.message}` });
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this faculty class assignment?')) return;
    try {
      await api.academic.deleteFacultyAssignment(id);
      setStatusMessage({ type: 'success', text: 'Class assignment removed.' });
      await loadAll();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  // Filtered subjects
  const filteredSubjects = subjects.filter(sub => {
    if (selectedSemester !== 'ALL' && (sub.semester || '5') !== selectedSemester) return false;
    if (selectedDeptId !== 'ALL' && sub.department_id !== selectedDeptId) return false;
    return true;
  });

  // Filtered faculty
  const filteredFaculty = facultyList.filter(f => {
    if (facultyDeptFilter !== 'ALL' && f.department_id !== facultyDeptFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-[#7A6A63] hover:text-[#2B1B1B]">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100">
            <BookOpen className="w-5 h-5 text-maroon-700" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">
              {isAdmin ? 'Faculty Management & Academic Structure' : 'My Academic Classes'}
            </h2>
            <p className="text-xs text-[#7A6A63] mt-0.5">
              {isAdmin
                ? 'Configure faculty accounts, create class sections, assign teachers to classes, and manage subjects/exams.'
                : 'View authorized class assignments and enrolled student counts.'}
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FBF7F2] border border-[#EADFD3] rounded-xl overflow-x-auto">
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('faculty')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'faculty' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
                }`}
              >
                Faculty ({facultyList.length})
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  activeTab === 'assignments' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
                }`}
              >
                Faculty-Class Assignments ({assignments.length})
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'classes' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
            }`}
          >
            Classes ({classes.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                activeTab === 'departments' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
              }`}
            >
              Departments ({departments.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'subjects' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
            }`}
          >
            Subjects ({subjects.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'exams' ? 'bg-maroon-700 text-white shadow-xs' : 'text-[#7A6A63] hover:text-[#2B1B1B]'
            }`}
          >
            Exams ({exams.length})
          </button>
        </div>
      </div>

      {/* Tab: Faculty & Staff */}
      {activeTab === 'faculty' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#7A6A63] font-semibold">
                <Filter className="w-4 h-4 text-maroon-700" />
                <span className="text-[#2B1B1B]">Filter by Department:</span>
              </div>
              <select
                value={facultyDeptFilter}
                onChange={e => setFacultyDeptFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-[#EADFD3] text-xs font-medium bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingFaculty(null);
                setFacultyForm({
                  name: '',
                  email: '',
                  department_id: departments[0]?.id || '',
                  password: 'Faculty@123',
                  is_active: 1
                });
                setShowFacultyModal(true);
              }}
              className="px-4 py-2 bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 self-start sm:self-auto transition-colors border border-maroon-900/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Faculty Member</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Faculty Name</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Assigned Classes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredFaculty.length > 0 ? (
                    filteredFaculty.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[11px]">
                            {f.name.charAt(0)}
                          </div>
                          <span>{f.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                            {f.department_code || f.department_name || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{f.email}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {f.assigned_classes && f.assigned_classes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {f.assigned_classes.map((c: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No class assigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            f.is_active !== 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {f.is_active !== 0 ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingFaculty(f);
                                setFacultyForm({
                                  name: f.name,
                                  email: f.email,
                                  department_id: f.department_id || departments[0]?.id || '',
                                  password: '',
                                  is_active: f.is_active !== 0 ? 1 : 0
                                });
                                setShowFacultyModal(true);
                              }}
                              title="Edit Faculty"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFaculty(f.id, f.name)}
                              title="Remove Faculty Member"
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                        No faculty members found. Click <strong>"Add Faculty Member"</strong> to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Faculty-Class Assignments (Requirement 1 & 4) */}
      {activeTab === 'assignments' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Class Access Control (Backend Enforced)</h3>
              <p className="text-[11px] text-slate-500">
                A Faculty member can ONLY view, upload marks for, and notify students in their assigned class(es).
              </p>
            </div>

            <button
              onClick={() => {
                if (facultyList.length > 0 && classes.length > 0) {
                  setAssignForm({
                    faculty_id: facultyList[0].id,
                    class_id: classes[0].id,
                    academic_year: '2026-27'
                  });
                }
                setShowAssignModal(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Faculty to Class</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Assigned Class</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Assigned At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {assignments.length > 0 ? (
                    assignments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[11px]">
                            {a.faculty_name?.charAt(0) || 'F'}
                          </div>
                          <div>
                            <div>{a.faculty_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{a.faculty_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {a.department_name || a.department_code || 'IT'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs border border-indigo-200">
                            {a.class_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {a.academic_year || '2026-27'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            title="Unassign Faculty from Class"
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                        No faculty-class assignments recorded. Click <strong>"Assign Faculty to Class"</strong> to link a teacher to a section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Classes (Requirement 3 & 4) */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Classes & Sections</h3>
              <p className="text-xs text-slate-500">Each class has an isolated student roster and distinct faculty assignment.</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowClassModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Class</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-500 transition-all flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                      {c.academic_year || '2026-27'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.department_name || c.department_code || 'General Department'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Enrolled Students:</span>
                  <span className="font-black text-slate-900">{c.student_count || 0}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Semester {c.semester || '5'}</span>
                  <span>Section {c.section || 'A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Departments */}
      {activeTab === 'departments' && isAdmin && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800">Academic Departments</h3>
            <button
              onClick={() => setShowDeptModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">{d.name}</div>
                  <div className="text-xs text-slate-500 font-mono">Code: {d.code}</div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  {d.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Subjects */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span>Semester:</span>
              </div>
              <select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-slate-50 focus:bg-white"
              >
                <option value="ALL">All Semesters (1–8)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={String(s)}>Semester {s}</option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <button
                onClick={openCreateSubject}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Subject & Pass Cutoff</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSubjects.map((sub) => (
              <div key={sub.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {sub.subject_code}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      Sem {sub.semester || '5'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 leading-snug">{sub.subject_name}</h4>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Max: {sub.max_marks || 100} • Pass: {sub.pass_marks || 50}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditSubject(sub)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(sub.id, sub.subject_code)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Exams (Requirement 3 & 11) */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Internal Examination Sessions</h3>
              <p className="text-xs text-slate-500">Exams belong to specific class sections (e.g. Internal Assessment 1 for IT-A).</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowExamModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Exam</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((ex) => (
              <div key={ex.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[10px]">
                    Academic Year {ex.academic_year}
                  </span>
                  <span className="text-xs text-slate-700 font-bold px-2 py-0.5 bg-slate-100 rounded">
                    Semester {ex.semester}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{ex.exam_name}</h4>
                {ex.class_name && (
                  <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                    Class: {ex.class_name}
                  </div>
                )}
                <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Conducted: {ex.exam_date || 'Current Term'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Faculty */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{editingFaculty ? 'Edit Faculty Member' : 'Add Faculty Member'}</h3>
              <button onClick={() => setShowFacultyModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveFaculty} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty Full Name *</label>
                <input
                  type="text"
                  placeholder="Rajesh Kumar"
                  value={facultyForm.name}
                  onChange={e => setFacultyForm({ ...facultyForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                <select
                  value={facultyForm.department_id}
                  onChange={e => setFacultyForm({ ...facultyForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email *</label>
                <input
                  type="email"
                  placeholder="rajesh@college.edu"
                  value={facultyForm.email}
                  onChange={e => setFacultyForm({ ...facultyForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingFaculty ? 'Change Password (optional)' : 'Default Password *'}
                </label>
                <input
                  type="text"
                  placeholder={editingFaculty ? 'Leave blank to keep current' : 'Faculty@123'}
                  value={facultyForm.password}
                  onChange={e => setFacultyForm({ ...facultyForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  required={!editingFaculty}
                />
              </div>
              {editingFaculty && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="fac-active"
                    checked={facultyForm.is_active === 1}
                    onChange={e => setFacultyForm({ ...facultyForm, is_active: e.target.checked ? 1 : 0 })}
                    className="rounded text-indigo-600"
                  />
                  <label htmlFor="fac-active" className="text-xs font-semibold text-slate-700">Account Active</label>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowFacultyModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Save Faculty</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Faculty to Class (Requirement 4) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Faculty-Class Assignment</span>
              </h3>
              <button onClick={() => setShowAssignModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAssignFaculty} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Faculty *</label>
                <select
                  value={assignForm.faculty_id}
                  onChange={e => setAssignForm({ ...assignForm, faculty_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.department_code || 'General'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Class *</label>
                <select
                  value={assignForm.class_id}
                  onChange={e => setAssignForm({ ...assignForm, class_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Sem {c.semester || '5'} • {c.department_code || 'IT'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={assignForm.academic_year}
                  onChange={e => setAssignForm({ ...assignForm, academic_year: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Assign Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Class (Requirement 4) */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Create Class Section</span>
              </h3>
              <button onClick={() => setShowClassModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                <select
                  value={classForm.department_id}
                  onChange={e => setClassForm({ ...classForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester *</label>
                  <select
                    value={classForm.semester}
                    onChange={e => setClassForm({ ...classForm, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section *</label>
                  <input
                    type="text"
                    placeholder="A"
                    value={classForm.section}
                    onChange={e => setClassForm({ ...classForm, section: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class Display Name (e.g. IT-A)</label>
                <input
                  type="text"
                  placeholder="IT-A"
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Leave empty to auto-generate like DEPT-SECTION</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={classForm.academic_year}
                  onChange={e => setClassForm({ ...classForm, academic_year: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowClassModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Exam */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create Internal Assessment Exam</h3>
              <button onClick={() => setShowExamModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateExam} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Name *</label>
                <input
                  type="text"
                  placeholder="Internal Assessment 1"
                  value={examForm.exam_name}
                  onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Class *</label>
                <select
                  value={examForm.class_id}
                  onChange={e => setExamForm({ ...examForm, class_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Sem {c.semester || '5'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={examForm.academic_year}
                    onChange={e => setExamForm({ ...examForm, academic_year: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={examForm.semester}
                    onChange={e => setExamForm({ ...examForm, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Date (Optional)</label>
                <input
                  type="date"
                  value={examForm.exam_date}
                  onChange={e => setExamForm({ ...examForm, exam_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowExamModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Save Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Department */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Add Department</span>
              </h3>
              <button onClick={() => setShowDeptModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  placeholder="Information Technology"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code *</label>
                <input
                  type="text"
                  placeholder="IT"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Save Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Subject */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{editingSubject ? `Edit Subject (${subjectForm.subject_code})` : 'Add Subject & Pass Cutoff'}</span>
              </h3>
              <button onClick={() => setShowSubjectModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    placeholder="IT501"
                    value={subjectForm.subject_code}
                    disabled={!!editingSubject}
                    onChange={e => setSubjectForm({ ...subjectForm, subject_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase disabled:bg-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester *</label>
                  <select
                    value={subjectForm.semester}
                    onChange={e => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name *</label>
                <input
                  type="text"
                  placeholder="Database Management Systems"
                  value={subjectForm.subject_name}
                  onChange={e => setSubjectForm({ ...subjectForm, subject_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Marks</label>
                  <input
                    type="number"
                    value={subjectForm.max_marks}
                    onChange={e => setSubjectForm({ ...subjectForm, max_marks: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pass Marks</label>
                  <input
                    type="number"
                    value={subjectForm.pass_marks}
                    onChange={e => setSubjectForm({ ...subjectForm, pass_marks: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                <select
                  value={subjectForm.department_id}
                  onChange={e => setSubjectForm({ ...subjectForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowSubjectModal(false)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">
                  {editingSubject ? 'Save Changes' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
