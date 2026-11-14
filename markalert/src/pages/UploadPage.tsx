import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Layers,
  GraduationCap,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

const STANDARD_DEPARTMENTS = [
  'Information Technology',
  'Computer Science & Engineering',
  'Artificial Intelligence & Data Science',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Science & Humanities',
  'Master of Computer Applications (MCA)',
  'Master of Business Administration (MBA)',
];

const EXAM_OPTIONS = [
  { value: 'Internal Assessment - I', label: 'Internal 1 (Internal Assessment - I)' },
  { value: 'Internal Assessment - II', label: 'Internal 2 (Internal Assessment - II)' },
];

const SECTION_OPTIONS = [
  { value: 'Section A', label: 'Section A' },
  { value: 'Section B', label: 'Section B' },
  { value: 'Section C', label: 'Section C' },
];

const uploadSchema = z.object({
  exam_name: z.string().min(1, 'Please select Internal 1 or Internal 2'),
  department: z.string().min(1, 'Please select a department'),
  class_name: z.string().min(1, 'Please select a class section (A, B, or C)'),
  academic_year: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      exam_name: 'Internal Assessment - I',
      department: user?.department || 'Information Technology',
      class_name: 'Section A',
      academic_year: '2026-2027',
    },
  });

  // Auto-fill user's department when user profile loads
  useEffect(() => {
    if (user?.department) {
      setValue('department', user.department);
    }
  }, [user?.department, setValue]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setErrorMessage(null);
    } else {
      setErrorMessage('Please upload a valid Excel spreadsheet (.xlsx or .xls)');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMessage(null);
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!file) {
      setErrorMessage('Please select or drop an Excel marks spreadsheet to upload.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      // 1. Initialize Draft Batch
      const batch = await api.batches.create({
        exam_name: data.exam_name,
        department: data.department,
        class_name: data.class_name,
        academic_year: data.academic_year,
      });

      // 2. Upload Excel File to Batch
      const uploadRes = await api.batches.uploadFile(batch.id, file);

      // 3. Navigate to Review & Mapping Step
      navigate(`/batches/${batch.id}/review`, {
        state: { uploadData: uploadRes },
      });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
        <span className="text-[#7A1A2C] flex items-center gap-1.5 font-bold">
          <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-white flex items-center justify-center text-[10px]">1</span>
          Upload Excel
        </span>
        <span className="text-stone-300">──</span>
        <span>2. Review & Map</span>
        <span className="text-stone-300">──</span>
        <span>3. Preview Message</span>
        <span className="text-stone-300">──</span>
        <span>4. Send & Track</span>
      </div>

      <Card>
        <CardHeader
          title="Upload Examination Marks Sheet"
          description="Select examination, department, and class section dropdowns, then upload your Excel sheet."
        />

        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 3 Dropdown Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1. Examination Dropdown (Internal 1 or 2 only) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#7A1A2C]" />
                  Examination *
                </label>
                <select
                  {...register('exam_name')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
                >
                  {EXAM_OPTIONS.map(exam => (
                    <option key={exam.value} value={exam.value}>
                      {exam.label}
                    </option>
                  ))}
                </select>
                {errors.exam_name && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.exam_name.message}</p>
                )}
              </div>

              {/* 2. Department Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#7A1A2C]" />
                  Department *
                </label>
                <select
                  {...register('department')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
                >
                  <option value="">-- Select Department --</option>
                  {STANDARD_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.department.message}</p>
                )}
              </div>

              {/* 3. Class Section Dropdown (A, B, C) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#7A1A2C]" />
                  Class Section *
                </label>
                <select
                  {...register('class_name')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
                >
                  {SECTION_OPTIONS.map(sec => (
                    <option key={sec.value} value={sec.value}>
                      {sec.label}
                    </option>
                  ))}
                </select>
                {errors.class_name && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.class_name.message}</p>
                )}
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Excel Spreadsheet File (.xlsx, .xls) *
              </label>

              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-[#7A1A2C] bg-[#7A1A2C]/5'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/50'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-stone-900">{file.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5 font-mono">
                      {(file.size / 1024).toFixed(1)} KB — Ready to parse
                    </p>
                    <button
                      type="button"
                      className="text-xs text-[#7A1A2C] underline mt-3 hover:text-[#5c1321]"
                      onClick={e => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-stone-800">
                      Drag & drop your Excel sheet here, or <span className="text-[#7A1A2C]">browse</span>
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      Supports .xlsx and .xls formats (up to 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>



            {/* Submit CTA */}
            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={!file}
                isLoading={uploading}
              >
                <span>Upload & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
