import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ColumnMapping, ExcelValidationResult, ValidatedRow } from '../types';

export const ReviewPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const uploadState = location.state?.uploadData;

  const [storedFileName, setStoredFileName] = useState<string>(uploadState?.storedFileName || '');
  const [availableSheets, setAvailableSheets] = useState<string[]>(uploadState?.availableSheets || ['Sheet1']);
  const [selectedSheet, setSelectedSheet] = useState<string>(uploadState?.activeSheet || 'Sheet1');
  const [columns, setColumns] = useState<string[]>(uploadState?.columns || []);

  const [mapping, setMapping] = useState<ColumnMapping>(
    uploadState?.suggestedMapping || {
      registerNumberCol: '',
      studentNameCol: '',
      parentNameCol: '',
      parentMobileCol: '',
      subjectCols: {},
    }
  );

  const [maxMarksMap, setMaxMarksMap] = useState<Record<string, number>>({});
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ExcelValidationResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBatchNotFound, setIsBatchNotFound] = useState(false);

  // If page was reloaded directly, fetch batch details
  useEffect(() => {
    if (!storedFileName && batchId) {
      api.batches.getById(batchId)
        .then(batch => {
          // Fetch existing preview rows if available
          api.batches.getPreview(batchId)
            .then(previewRows => {
              if (previewRows && previewRows.length > 0) {
                const sampleRow = previewRows[0];
                const subjectKeys = Object.keys(sampleRow.marks || {});
                const subjectColsMap: Record<string, string> = {};
                subjectKeys.forEach(k => {
                  subjectColsMap[k] = k;
                });

                const cols = ['Register Number', 'Student Name', 'Parent Name', 'Parent Mobile', ...subjectKeys];
                setColumns(cols);
                setMapping({
                  registerNumberCol: 'Register Number',
                  studentNameCol: 'Student Name',
                  parentNameCol: 'Parent Name',
                  parentMobileCol: 'Parent Mobile',
                  subjectCols: subjectColsMap,
                });

                setValidationResult({
                  fileName: batch.original_file_name,
                  sheetName: 'Sheet1',
                  availableSheets: ['Sheet1'],
                  totalRows: batch.total_records,
                  validRows: batch.valid_records,
                  warningRows: 0,
                  errorRows: batch.invalid_records,
                  detectedColumns: cols,
                  suggestedMapping: {
                    registerNumberCol: 'Register Number',
                    studentNameCol: 'Student Name',
                    parentNameCol: 'Parent Name',
                    parentMobileCol: 'Parent Mobile',
                    subjectCols: subjectColsMap,
                  },
                  detectedSubjects: subjectKeys,
                  rows: previewRows,
                });
              } else {
                setErrorMessage('No uploaded spreadsheet found in this session. Please upload your marks file.');
              }
            })
            .catch(() => {
              setErrorMessage('Could not load batch data. Please re-upload your file.');
            });
        })
        .catch(() => {
          setIsBatchNotFound(true);
          setErrorMessage('Batch not found or session has expired.');
        });
    }
  }, [batchId, storedFileName]);

  const handleRunValidation = async () => {
    if (!batchId || !storedFileName) {
      setErrorMessage('Missing upload session data. Please re-upload your Excel file.');
      return;
    }

    if (!mapping.registerNumberCol) {
      setErrorMessage('Please select the Register Number column.');
      return;
    }
    if (!mapping.parentMobileCol) {
      setErrorMessage('Please select the Parent Mobile column.');
      return;
    }

    setValidating(true);
    setErrorMessage(null);

    try {
      const res = await api.batches.validate(batchId, {
        stored_file_name: storedFileName,
        sheet_name: selectedSheet,
        mapping,
        max_marks: maxMarksMap,
      });
      setValidationResult(res);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const filteredRows = (validationResult?.rows || []).filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  if (isBatchNotFound) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">Batch Not Found</h2>
        <p className="text-xs text-stone-500">
          This notification batch does not exist or was created in a previous database session.
        </p>
        <Button onClick={() => navigate('/upload')} className="gap-2">
          <UploadCloud className="w-4 h-4" /> Upload New Excel File
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 1. Uploaded
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-[#7A1A2C] font-bold flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-white flex items-center justify-center text-[10px]">2</span>
          Review & Map Columns
        </span>
        <span className="text-stone-300">──</span>
        <span>3. Preview Message</span>
        <span className="text-stone-300">──</span>
        <span>4. Send & Track</span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          {!storedFileName && (
            <Button size="sm" variant="outline" onClick={() => navigate('/upload')}>
              Re-upload File
            </Button>
          )}
        </div>
      )}

      {/* Column Mapping Configuration Card */}
      <Card>
        <CardHeader
          title="Column Mapping & Header Alignment"
          description="Verify that columns in your uploaded Excel sheet match the expected student fields"
          action={
            (availableSheets || []).length > 1 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 font-medium">Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={e => setSelectedSheet(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded-md text-xs font-semibold text-stone-800"
                >
                  {(availableSheets || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : null
          }
        />

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Register Number Col */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Register / Roll No *
              </label>
              <select
                value={mapping.registerNumberCol || ''}
                onChange={e => setMapping({ ...mapping, registerNumberCol: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-2 focus:ring-[#7A1A2C] focus:outline-none"
              >
                <option value="">-- Select Column --</option>
                {(columns || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Student Name Col (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Student Name (Optional)
              </label>
              <select
                value={mapping.studentNameCol || ''}
                onChange={e => setMapping({ ...mapping, studentNameCol: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-2 focus:ring-[#7A1A2C] focus:outline-none"
              >
                <option value="">-- None / Default --</option>
                {(columns || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Parent Mobile Col */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Parent Mobile *
              </label>
              <select
                value={mapping.parentMobileCol || ''}
                onChange={e => setMapping({ ...mapping, parentMobileCol: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-2 focus:ring-[#7A1A2C] focus:outline-none"
              >
                <option value="">-- Select Column --</option>
                {(columns || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Parent Name Col (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Parent Name (Optional)
              </label>
              <select
                value={mapping.parentNameCol || ''}
                onChange={e => setMapping({ ...mapping, parentNameCol: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-2 focus:ring-[#7A1A2C] focus:outline-none"
              >
                <option value="">-- None / Default --</option>
                {(columns || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject Columns Detected */}
          <div className="pt-2 border-t border-stone-100">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
              Detected Subject Marks Columns
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.keys(mapping?.subjectCols || {}).length === 0 ? (
                <p className="text-xs text-stone-400 col-span-full">No subject columns detected.</p>
              ) : (
                Object.entries(mapping?.subjectCols || {}).map(([subName, colName]) => (
                  <div key={subName} className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="text-xs font-bold text-stone-800 block truncate" title={subName}>
                      {subName}
                    </span>
                    <span className="text-[10px] text-stone-400 block truncate font-mono mt-0.5">
                      Col: {colName}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {storedFileName && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleRunValidation}
                isLoading={validating}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{validationResult ? 'Re-Validate Data' : 'Validate Excel Data'}</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results Overview */}
      {validationResult && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div
              onClick={() => setFilterStatus('ALL')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Total Extracted
              </span>
              <span className="text-2xl font-bold">{validationResult.totalRows}</span>
              <span className="text-xs block mt-0.5 opacity-75">Student records</span>
            </div>

            <div
              onClick={() => setFilterStatus('VALID')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'VALID'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:border-emerald-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Ready to Send
              </span>
              <span className="text-2xl font-bold">{validationResult.validRows}</span>
              <span className="text-xs block mt-0.5 opacity-75">Valid records</span>
            </div>

            <div
              onClick={() => setFilterStatus('WARNING')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'WARNING'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50/50 text-amber-800 border-amber-200 hover:border-amber-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Warnings
              </span>
              <span className="text-2xl font-bold">{validationResult.warningRows}</span>
              <span className="text-xs block mt-0.5 opacity-75">Shared phone/empty sub</span>
            </div>

            <div
              onClick={() => setFilterStatus('ERROR')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                filterStatus === 'ERROR'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-sm'
                  : 'bg-rose-50/50 text-rose-800 border-rose-200 hover:border-rose-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Invalid
              </span>
              <span className="text-2xl font-bold">{validationResult.errorRows}</span>
              <span className="text-xs block mt-0.5 opacity-75">Cannot be notified</span>
            </div>
          </div>

          {/* Data Table Card */}
          <Card>
            <CardHeader
              title={`Recipient Records Preview (${filteredRows.length} shown)`}
              description="Parent phone numbers are masked for privacy. Hover on warning or error badges for details."
            />

            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-100 border-b border-stone-200 text-stone-600 uppercase font-bold text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">Row</th>
                      <th className="py-2.5 px-4">Register No</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Parent Phone (Masked)</th>
                      <th className="py-2.5 px-4 text-center">Total Marks</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Validation Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-sans">
                    {filteredRows.map(row => {
                      const displayMaxMarks =
                        typeof row.maxMarks === 'number'
                          ? row.maxMarks
                          : typeof (row as any).totalMaxMarks === 'number'
                          ? (row as any).totalMaxMarks
                          : 100;

                      const rowIssues = row.issues && Array.isArray(row.issues) ? row.issues : [];

                      return (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.status === 'ERROR'
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50/30 hover:bg-amber-50/60'
                              : 'hover:bg-stone-50/50'
                          }
                        >
                          <td className="py-2.5 px-4 text-center text-stone-400 font-mono">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-stone-900 font-mono">
                            {row.registerNumber}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-stone-800">
                            {row.studentName}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-stone-600">
                            {row.parentMobileMasked}
                          </td>
                          <td className="py-2.5 px-4 text-center font-bold text-stone-700">
                            {row.totalMarks} / {displayMaxMarks} ({row.percentage}%)
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge
                              variant={
                                row.status === 'VALID'
                                  ? 'success'
                                  : row.status === 'WARNING'
                                  ? 'warning'
                                  : 'error'
                              }
                            >
                              {row.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-stone-500 max-w-xs truncate">
                            {rowIssues.length > 0 ? (
                              <span
                                className={
                                  row.status === 'ERROR' ? 'text-rose-600' : 'text-amber-700'
                                }
                                title={rowIssues.map(i => `${i.field}: ${i.message}`).join('\n')}
                              >
                                {rowIssues[0]?.field}: {rowIssues[0]?.message}
                                {rowIssues.length > 1 && ` (+${rowIssues.length - 1} more)`}
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> All checks passed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Action Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => navigate('/upload')}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Upload</span>
            </Button>

            <Button
              size="lg"
              disabled={validationResult.validRows === 0 && validationResult.warningRows === 0}
              onClick={() => navigate(`/batches/${batchId}/messages`)}
            >
              <span>Proceed to Message Preview</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
