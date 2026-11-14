import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Smartphone,
  Send,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Edit3,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { BatchPreviewResponse, MessagePreviewItem } from '../types';

const TEMPLATE_VARIABLES = [
  { token: '{EXAM_NAME}', label: 'Exam Name', desc: 'e.g. Internal Assessment - I' },
  { token: '{STUDENT_NAME}', label: 'Student Name', desc: 'Full student name' },
  { token: '{REGISTER_NUMBER}', label: 'Reg No', desc: 'Register / Roll number' },
  { token: '{OVERALL_RESULT}', label: 'Overall Result', desc: 'Pass or Fail' },
  { token: '{MARKS}', label: 'All Marks Block', desc: 'Formatted marks list' },
  { token: '{COLLEGE_NAME}', label: 'College Name', desc: 'Configured college title' },
  { token: '{SUBJECT_1}: {MARK_1}/100 – {STATUS_1}', label: 'Subject 1', desc: 'First subject line' },
  { token: '{SUBJECT_2}: {MARK_2}/100 – {STATUS_2}', label: 'Subject 2', desc: 'Second subject line' },
];

export const MessagesPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'BOTH'>('BOTH');
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
  const [customTemplate, setCustomTemplate] = useState<string>('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedAgreement, setConfirmedAgreement] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: previewData, isLoading } = useQuery({
    queryKey: ['batch-messages-preview', batchId, customTemplate],
    queryFn: () => api.batches.getMessagesPreview(batchId!, customTemplate || undefined),
    enabled: !!batchId,
  });

  // Initialize custom template editor with default WhatsApp template
  useEffect(() => {
    if (previewData?.templates?.whatsapp && !customTemplate) {
      setCustomTemplate(previewData.templates.whatsapp);
    }
  }, [previewData?.templates?.whatsapp, customTemplate]);

  const previews = previewData?.previews || [];
  const activeStudent: MessagePreviewItem | undefined = previews[selectedStudentIndex] || previews[0];

  const handleInsertVariable = (token: string) => {
    setCustomTemplate(prev => `${prev} ${token}`);
  };

  const handleResetTemplate = () => {
    if (previewData?.templates?.whatsapp) {
      setCustomTemplate(previewData.templates.whatsapp);
    } else {
      setCustomTemplate('');
    }
  };

  const handleSendBatch = async () => {
    if (!batchId) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      await api.batches.sendBatch(batchId, {
        channel,
        custom_template: customTemplate || undefined,
      });
      navigate(`/batches/${batchId}/progress`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to dispatch batch');
      setIsSending(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 1. Uploaded
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> 2. Validated
        </span>
        <span className="text-stone-300">──</span>
        <span className="text-[#7A1A2C] font-bold flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-[#7A1A2C] text-white flex items-center justify-center text-[10px]">3</span>
          Message Preview & Customization
        </span>
        <span className="text-stone-300">──</span>
        <span>4. Send & Track</span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Channel Selector & Top Controls Header */}
      <div className="bg-white border border-stone-200/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-1">
            Dispatch Channels
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChannel('BOTH')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                channel === 'BOTH'
                  ? 'bg-[#7A1A2C] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Both WhatsApp & SMS
            </button>
            <button
              onClick={() => setChannel('WHATSAPP')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                channel === 'WHATSAPP'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Only
            </button>
            <button
              onClick={() => setChannel('SMS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                channel === 'SMS'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> SMS Only
            </button>
          </div>
        </div>

        {/* Template Customization Toggle & Student Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <Button
            variant={isEditingTemplate ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsEditingTemplate(!isEditingTemplate)}
            className="gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingTemplate ? 'Hide Template Editor' : 'Edit WhatsApp Message'}</span>
          </Button>

          {previews.length > 0 && (
            <div className="w-full sm:w-auto">
              <select
                value={selectedStudentIndex}
                onChange={e => setSelectedStudentIndex(Number(e.target.value))}
                className="w-full sm:w-60 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
              >
                {previews.map((std, idx) => (
                  <option key={std.recipientId} value={idx}>
                    {std.registerNumber} - {std.studentName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Live Message Template Editor (Collapsible) */}
      {isEditingTemplate && (
        <Card className="border-[#7A1A2C]/30 bg-amber-50/20 shadow-sm animate-in fade-in duration-200">
          <CardHeader
            title="Edit WhatsApp Message Template"
            description="Customize the message sent to parents. Click any token below to insert dynamic student data."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetTemplate}
                className="gap-1 text-stone-600 hover:text-stone-900"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </Button>
            }
          />
          <CardContent className="space-y-4">
            {/* Quick Variable Pills */}
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#7A1A2C]" /> Click to Insert Personalization Tags:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => handleInsertVariable(v.token)}
                    title={v.desc}
                    className="px-2.5 py-1 bg-white hover:bg-[#7A1A2C] hover:text-white border border-stone-300 hover:border-[#7A1A2C] rounded-md text-xs font-mono font-medium text-stone-700 transition-colors shadow-2xs"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Editor Textarea */}
            <div>
              <textarea
                rows={6}
                value={customTemplate}
                onChange={e => setCustomTemplate(e.target.value)}
                placeholder="Dear {{parent_name}}, ward {{student_name}} scored..."
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] shadow-inner"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Tip: Changes reflect immediately in the live WhatsApp message preview below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Preview Display */}
      {isLoading ? (
        <div className="p-16 text-center text-stone-400 text-sm">
          <div className="w-8 h-8 border-3 border-[#7A1A2C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Rendering personalized message previews...
        </div>
      ) : activeStudent ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WhatsApp Preview Card */}
          <Card className="border-emerald-200/80">
            <CardHeader
              title="WhatsApp Cloud Message Preview"
              description={`Recipient: ${activeStudent.parentName} (${activeStudent.parentMobileMasked})`}
              className="bg-emerald-50/50"
              action={
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  WhatsApp Preview
                </span>
              }
            />
            <CardContent className="bg-[#EFEAE2] p-6 min-h-[340px] flex items-center justify-center">
              <div className="bg-white rounded-2xl rounded-tl-xs p-4 shadow-md max-w-sm w-full space-y-3 text-stone-800 font-sans border border-stone-200/60">
                <div className="text-xs whitespace-pre-line leading-relaxed font-sans">
                  {activeStudent.renderedWhatsApp}
                </div>
                <div className="flex items-center justify-end gap-1 text-[10px] text-stone-400 font-medium">
                  <span>12:00 PM</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMS Gateway Preview Card */}
          <Card className="border-sky-200/80">
            <CardHeader
              title="DLT SMS Message Preview"
              description={`Recipient: ${activeStudent.parentName} (${activeStudent.parentMobileMasked})`}
              className="bg-sky-50/50"
              action={
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 uppercase">
                  SMS Preview
                </span>
              }
            />
            <CardContent className="bg-stone-100 p-6 min-h-[340px] flex items-center justify-center">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200 max-w-sm w-full space-y-2">
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold border-b border-stone-100 pb-2">
                  <span>Sender: MRKALR (DLT)</span>
                  <span>160 char safe</span>
                </div>
                <div className="text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-line">
                  {activeStudent.renderedSMS}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/batches/${batchId}/review`)}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Column Review</span>
        </Button>

        <Button
          size="lg"
          onClick={() => setShowConfirmModal(true)}
          disabled={previews.length === 0}
          className="gap-2 shadow-md"
        >
          <Send className="w-4 h-4" />
          <span>Confirm & Send to {previews.length} Parents</span>
        </Button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#7A1A2C]/10 text-[#7A1A2C] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">
                  Confirm Notification Dispatch
                </h3>
                <p className="text-xs text-stone-500">
                  Examination: {previewData?.examName}
                </p>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl space-y-2 text-xs text-stone-700 border border-stone-200">
              <div className="flex justify-between py-1 border-b border-stone-200">
                <span className="font-medium text-stone-500">Eligible Recipients:</span>
                <span className="font-bold text-stone-900">{previews.length} parents</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200">
                <span className="font-medium text-stone-500">Channels Selected:</span>
                <span className="font-bold text-stone-900">
                  {channel === 'BOTH' ? 'WhatsApp & SMS' : channel}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-medium text-stone-500">Custom Template:</span>
                <span className="font-bold text-stone-900">
                  {customTemplate ? 'Yes (Customized)' : 'Default College Template'}
                </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmedAgreement}
                onChange={e => setConfirmedAgreement(e.target.checked)}
                className="mt-0.5 rounded-sm border-stone-300 text-[#7A1A2C] focus:ring-[#7A1A2C]"
              />
              <span>
                I confirm that the marks and parent details have been reviewed and verified for accuracy.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendBatch}
                isLoading={isSending}
                disabled={!confirmedAgreement}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Confirm & Dispatch Now</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
