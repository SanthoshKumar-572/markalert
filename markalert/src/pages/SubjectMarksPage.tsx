import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  Printer,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { NotificationBatch, ValidatedRow } from '../types';
import vsbLogo from '../assets/vsb-logo.png';

export const SubjectMarksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  const [showPdfModal, setShowPdfModal] = useState(false);

  const { data: batchesData } = useQuery({
    queryKey: ['batches-list'],
    queryFn: () => api.batches.list({ limit: 10 }),
  });

  const batches = batchesData?.batches || [];
  const selectedBatch = batches.find((b: NotificationBatch) => b.id === batchId) || batches[0];

  const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['batch-preview', selectedBatch?.id],
    queryFn: () => (selectedBatch ? api.batches.getPreview(selectedBatch.id) : null),
    enabled: !!selectedBatch,
  });

  const rows: ValidatedRow[] = Array.isArray(previewData) ? previewData : [];
  const subjects = rows.length > 0 && rows[0].marks ? Object.keys(rows[0].marks) : ['Subject 1', 'Subject 2', 'Subject 3'];

  // Check if a student passed all subjects and has no ERROR status
  const isStudentPass = (row: ValidatedRow) => {
    if (row.status === 'ERROR') return false;
    const marksObj = row.marks || {};
    const markValues = Object.values(marksObj);
    if (markValues.length === 0) return false;

    // Per-subject pass threshold (50% of subject max, or 50 by default)
    const subMax = row.maxMarks && markValues.length > 0 ? (row.maxMarks / markValues.length) : 100;
    const passThreshold = subMax <= 50 ? 25 : 50;

    return markValues.every(val => {
      if (val === undefined || val === null) return false;
      const num = Number(val);
      if (isNaN(num)) return false;
      return num >= passThreshold;
    });
  };

  // Calculate Ranks: Highest total marks gets Rank 1 among PASSING students ONLY
  // Failed students are NOT ranked (marked as '-')
  const rankMap = new Map<string, number>();
  const passingRows = [...rows]
    .filter(r => isStudentPass(r) && typeof r.totalMarks === 'number')
    .sort((a, b) => (b.totalMarks || 0) - (a.totalMarks || 0));

  let currentRank = 1;
  for (let i = 0; i < passingRows.length; i++) {
    if (i > 0 && (passingRows[i].totalMarks || 0) < (passingRows[i - 1].totalMarks || 0)) {
      currentRank = i + 1;
    }
    const key = passingRows[i].registerNumber || String(i);
    rankMap.set(key, currentRank);
  }

  const passCount = rows.filter(isStudentPass).length;

  const subject = {
    name: selectedBatch?.exam_name || 'Internal Assessment - I',
    code: selectedBatch?.class_name || selectedBatch?.department || 'Department of IT',
    total: selectedBatch && selectedBatch.total_records > 0 ? Math.min(100, Math.round(((selectedBatch.valid_records || 1) / selectedBatch.total_records) * 100)) : 88,
    parts: [
      { label: 'Internal Assessment - I', got: 44, max: 50 },
      { label: 'Internal Assessment - II', got: 46, max: 50 },
      { label: 'Assignment / Practical', got: 9, max: 10 },
    ],
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-28 max-w-3xl mx-auto font-sans">
      {/* Print-specific style ensuring clean A4 PDF export */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-marks-report, #printable-marks-report * {
            visibility: visible;
          }
          #printable-marks-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen View */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#7A1A2C] hover:text-[#5c1321] min-h-[44px] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
          Subject Performance Overview
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 leading-tight mt-0.5">
          {subject.name}
        </h1>
        <p className="text-xs text-stone-500 font-medium mt-0.5">{subject.code} · V.S.B. Engineering College</p>
      </div>

      {/* Clean Pure White Hero Card */}
      <div className="rounded-2xl p-6 sm:p-7 text-center bg-white border border-stone-200/90 shadow-xs">
        <p className="text-xs tracking-[.18em] uppercase text-stone-600 font-bold">
          Internal Average & Student Performance
        </p>
        <p className="mt-2 font-display text-5xl sm:text-6xl font-bold leading-none text-stone-900">
          <span className="text-[#7A1A2C]">{subject.total}</span>
          <span className="text-xl sm:text-2xl text-stone-400 font-sans font-normal"> / 100</span>
        </p>
        <p className="text-xs text-stone-500 mt-2 font-medium">
          {selectedBatch ? `${selectedBatch.total_records} students evaluated across this session` : 'Active evaluation'}
        </p>
      </div>

      {/* Marks Breakdown Card: Clean Emerald/Blue Progress Bars */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs">
        <h3 className="text-xs uppercase tracking-wider font-bold text-stone-800">
          Assessment Score Weightage Breakdown
        </h3>
        {subject.parts.map(p => (
          <div key={p.label}>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-stone-700">{p.label}</span>
              <span className="font-bold text-emerald-700">
                {p.got} / {p.max}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
                style={{ width: `${(p.got / p.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Clean Light Action Buttons */}
      <div className="space-y-3 pt-2">
        <button
          onClick={() => setShowPdfModal(true)}
          className="w-full min-h-[50px] rounded-xl border-2 border-[#7A1A2C] bg-white hover:bg-[#fdf2f4] text-[#7A1A2C] text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-[#7A1A2C]" />
          <span>Download Examination Marks Report (PDF)</span>
        </button>

        <button
          onClick={() => {
            if (selectedBatch) {
              navigate(`/batches/${selectedBatch.id}/messages`);
            } else {
              navigate('/upload');
            }
          }}
          className="w-full min-h-[50px] rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-stone-600" />
          <span>Message Parents via WhatsApp / SMS</span>
        </button>
      </div>

      {/* PDF-Style Institutional Marks Statement Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Modal Controls Bar */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#7A1A2C]" />
                <span className="font-bold text-sm text-stone-900">
                  Institutional Examination Marks Statement
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPdf}
                  className="px-4 py-2 bg-[#7A1A2C] hover:bg-[#631524] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Institutional Report Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white" id="printable-marks-report">
              {/* College Header */}
              <div className="text-center pb-6 border-b-2 border-stone-900">
                <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-stone-900">
                  V.S.B. ENGINEERING COLLEGE, KARUR
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  An Autonomous Institution · Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai
                </p>
                <p className="text-xs text-stone-600 font-medium">NH-67, Covai Road, Karur - 639 111, Tamil Nadu</p>
                <div className="inline-block mt-3 px-4 py-1 bg-stone-100 rounded-md border border-stone-300">
                  <h3 className="text-sm font-bold uppercase text-stone-900">
                    STATEMENT OF INTERNAL EXAMINATION MARKS
                  </h3>
                </div>
              </div>

              {/* Session Meta Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 text-xs border-b border-stone-200 bg-stone-50/50 px-2 mt-2">
                <div>
                  <span className="text-stone-400 block uppercase text-[10px] font-bold">Examination</span>
                  <span className="font-bold text-stone-900">{selectedBatch?.exam_name || 'Internal Assessment - I'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block uppercase text-[10px] font-bold">Department / Class</span>
                  <span className="font-bold text-stone-900">{selectedBatch?.department || selectedBatch?.class_name || 'Information Technology'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block uppercase text-[10px] font-bold">Academic Session</span>
                  <span className="font-bold text-stone-900">{selectedBatch?.academic_year || '2026 - 2027'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block uppercase text-[10px] font-bold">Total Pass Candidates</span>
                  <span className="font-bold text-stone-900">{rows.length > 0 ? `${passCount} / ${rows.length}` : (selectedBatch?.valid_records || 0)} Students</span>
                </div>
              </div>

              {/* Marks Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border border-stone-300">
                  <thead className="bg-stone-100 border-b border-stone-300 text-stone-800 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-stone-300 text-center w-12">S.No</th>
                      <th className="py-2.5 px-3 border-r border-stone-300">Register Number</th>
                      <th className="py-2.5 px-3 border-r border-stone-300">Student Name</th>
                      {subjects.map(s => (
                        <th key={s} className="py-2.5 px-3 border-r border-stone-300 text-center">
                          {s}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 border-r border-stone-300 text-center">Total</th>
                      <th className="py-2.5 px-3 border-r border-stone-300 text-center w-16">Rank</th>
                      <th className="py-2.5 px-3 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={subjects.length + 6} className="py-6 text-center text-stone-400 italic">
                          No student records found in this batch session.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => {
                        const marksObj = row.marks || {};
                        const passed = isStudentPass(row);
                        const subMax = row.maxMarks && Object.keys(marksObj).length > 0 ? (row.maxMarks / Object.keys(marksObj).length) : 100;
                        const passThreshold = subMax <= 50 ? 25 : 50;

                        return (
                          <tr key={row.registerNumber || idx} className="hover:bg-stone-50">
                            <td className="py-2 px-3 border-r border-stone-300 text-center font-mono text-stone-600">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-stone-300 font-mono font-semibold text-stone-900">
                              {row.registerNumber}
                            </td>
                            <td className="py-2 px-3 border-r border-stone-300 font-medium text-stone-800">
                              {row.studentName || '—'}
                            </td>
                            {subjects.map(sub => {
                              const val = marksObj[sub];
                              const isSubjectFail = val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) < passThreshold;
                              return (
                                <td
                                  key={sub}
                                  className={`py-2 px-3 border-r border-stone-300 text-center font-mono ${
                                    isSubjectFail ? 'text-rose-600 font-bold bg-rose-50/50' : ''
                                  }`}
                                >
                                  {val !== undefined ? val : '—'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 border-r border-stone-300 text-center font-bold font-mono text-stone-900">
                              {row.totalMarks ?? '—'}
                            </td>
                            <td className="py-2 px-3 border-r border-stone-300 text-center font-bold font-mono text-stone-900">
                              {passed ? (rankMap.get(row.registerNumber || String(idx)) ?? '-') : '-'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {passed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Institutional Signatures Section */}
              <div className="grid grid-cols-3 gap-6 pt-16 mt-8 border-t border-stone-200 text-center text-xs">
                <div>
                  <div className="h-10 border-b border-stone-400 mb-1" />
                  <span className="font-bold text-stone-800 block">Class Advisor</span>
                  <span className="text-[10px] text-stone-500">Verified</span>
                </div>
                <div>
                  <div className="h-10 border-b border-stone-400 mb-1" />
                  <span className="font-bold text-stone-800 block">Head of the Department (HOD)</span>
                  <span className="text-[10px] text-stone-500">Department Of Information Technology</span>
                </div>
                <div>
                  <div className="h-10 border-b border-stone-400 mb-1" />
                  <span className="font-bold text-stone-800 block">Principal</span>
                  <span className="text-[10px] text-stone-500">V.S.B. Engineering College</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
