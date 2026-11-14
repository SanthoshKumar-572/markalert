import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Save,
  X,
  Smartphone,
  Hash
} from 'lucide-react';
import { api } from '../services/api';

interface Template {
  id?: string;
  name: string;
  channel: 'WHATSAPP' | 'SMS';
  template_type: 'MARKS' | 'REMINDER' | 'GENERAL';
  subject?: string;
  body: string;
  is_active: boolean;
  variables?: string;
}

const SAMPLE_VARS: Record<string, string> = {
  parent_name: "Santhoshkumar R's Parent",
  student_name: 'Santhoshkumar R',
  register_number: '922524205146',
  department: 'Information Technology',
  class_name: 'IT-C',
  exam_name: 'Internal Assessment – II',
  class_section: 'Information Technology - Year 3, Section C',
  marks: '• CN: 96/100\n• BDA: 85/100\n• FSWT: 68/100\n• STA: 85/100\n• DC: 68/100\n• ESIOT: 68/100',
  subject1_name: 'Computer Networks',
  subject1_marks: '96',
  subject1_result: 'Pass',
  subject2_name: 'Big Data Analytics',
  subject2_marks: '85',
  subject2_result: 'Pass',
  subject3_name: 'Full Stack Web Tech',
  subject3_marks: '68',
  subject3_result: 'Pass',
  subject4_name: 'Software Testing & Automation',
  subject4_marks: '85',
  subject4_result: 'Pass',
  subject5_name: 'Distributed Computing',
  subject5_marks: '68',
  subject5_result: 'Pass',
  subject6_name: 'Embedded Systems & IoT',
  subject6_marks: '68',
  subject6_result: 'Pass',
  overall_result: 'PASS',
  total: '470',
  maximum_marks: '600',
  percentage: '78.33',
  result: 'PASS',
  college_name: 'VSB ENGINEERING COLLEGE',
  notice_message: 'The college will remain closed tomorrow on account of Government Holiday. Regular academic sessions will resume on Monday.'
};

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-ia2-whatsapp',
    name: 'Internal Assessment – II Marks (VSB Engineering College)',
    channel: 'WHATSAPP',
    template_type: 'MARKS',
    body: `VSB ENGINEERING COLLEGE

Dear Parent/Guardian of {student_name},

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
    is_active: true
  },
  {
    id: 'tpl-ia2-sms',
    name: 'Internal Assessment – II Marks (VSB SMS DLT)',
    channel: 'SMS',
    template_type: 'MARKS',
    body: `VSB ENGINEERING COLLEGE: Dear Parent/Guardian of {student_name}, Register No: {register_number}, Dept: {department}, Class: {class_name}. IA-II Marks: {subject1_name}: {subject1_marks} ({subject1_result}), {subject2_name}: {subject2_marks} ({subject2_result}), {subject3_name}: {subject3_marks} ({subject3_result}), {subject4_name}: {subject4_marks} ({subject4_result}), {subject5_name}: {subject5_marks} ({subject5_result}), {subject6_name}: {subject6_marks} ({subject6_result}). Overall Result: {overall_result}. Regards, VSB Engineering College`,
    is_active: true
  },
  {
    name: 'Internal Examination Marks Report (Detailed)',
    channel: 'WHATSAPP',
    template_type: 'MARKS',
    body: `Dear {parent_name},

{exam_name} marks of your ward:

Student: {student_name}
Register No: {register_number}

{marks}

Total: {total}/{maximum_marks}
Percentage: {percentage}%

Regards,
{college_name}`,
    is_active: true
  },
  {
    name: 'General / Holiday & Circular Notice (WhatsApp)',
    channel: 'WHATSAPP',
    template_type: 'GENERAL',
    body: `Dear {parent_name},

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
    is_active: true
  },
  {
    name: 'Internal Examination Marks Report (SMS)',
    channel: 'SMS',
    template_type: 'MARKS',
    body: `Dear {parent_name}, {exam_name} marks of your ward: Student: {student_name}, Register No: {register_number}\n{marks}\nTotal: {total}/{maximum_marks}\nPercentage: {percentage}%\nRegards, {college_name}`,
    is_active: true
  },
  {
    name: 'General / Holiday & Circular Notice (SMS)',
    channel: 'SMS',
    template_type: 'GENERAL',
    body: `Notice from {college_name}: Dear Parent of {student_name} (Register No: {register_number}): {notice_message}. Regards, {college_name}`,
    is_active: true
  }
];

const renderPreview = (body: string): string => {
  let result = body;
  Object.entries(SAMPLE_VARS).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  });
  return result;
};

const TemplateEditor: React.FC<{
  template: Template;
  onSave: (t: Template) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const [form, setForm] = useState<Template>(template);
  const [preview, setPreview] = useState(false);

  const update = (k: keyof Template, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs p-6 space-y-4">
      <h3 className="text-sm font-heading font-bold text-[#2B1B1B] flex items-center gap-2">
        <Edit2 className="w-4 h-4 text-[#7A1A2C]" />
        {template.id ? 'Edit Notification Template' : 'New Notification Template'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-[#2B1B1B] block mb-1">Template Name</label>
          <input
            value={form.name}
            onChange={e => update('name', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs bg-[#F5EFE8] text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
            placeholder="e.g., WhatsApp Internal Marks"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#2B1B1B] block mb-1">Channel</label>
            <select value={form.channel} onChange={e => update('channel', e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs bg-[#F5EFE8] text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#2B1B1B] block mb-1">Type</label>
            <select value={form.template_type} onChange={e => update('template_type', e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-[#EADFD3] text-xs bg-[#F5EFE8] text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]">
              <option value="MARKS">Marks</option>
              <option value="REMINDER">Reminder</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-[#2B1B1B]">Message Body</label>
          <button onClick={() => setPreview(!preview)}
            className="text-xs text-[#7A1A2C] font-semibold flex items-center gap-1 hover:text-[#C08A16]">
            <Eye className="w-3 h-3" />
            {preview ? 'Edit Body' : 'Live Preview'}
          </button>
        </div>
        {preview ? (
          <div className="bg-[#FBF7F2] rounded-xl border border-[#EADFD3] p-4 text-xs text-[#2B1B1B] whitespace-pre-line min-h-[180px] font-mono leading-relaxed">
            {renderPreview(form.body)}
          </div>
        ) : (
          <textarea
            value={form.body}
            onChange={e => update('body', e.target.value)}
            rows={8}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADFD3] text-xs font-mono bg-[#F5EFE8] text-[#2B1B1B] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C] resize-none"
            placeholder="Use {student_name}, {subject1_name}, {subject1_marks}, {overall_result}, etc."
          />
        )}
      </div>

      <div className="bg-[#FEF9C3] border border-[#C08A16]/30 rounded-xl p-3 text-[11px] text-[#7a5209]">
        <strong className="font-bold">Click variables to append:</strong>
        <span className="flex flex-wrap gap-1.5 mt-1.5">
          {Object.keys(SAMPLE_VARS).map(k => (
            <code key={k} className="bg-white/80 border border-[#C08A16]/30 px-1.5 py-0.5 rounded text-[#7a5209] cursor-pointer hover:bg-white transition-colors"
              onClick={() => update('body', form.body + `{${k}}`)}>
              {`{${k}}`}
            </code>
          ))}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)}
            className="w-3.5 h-3.5 rounded text-[#7A1A2C]" />
          <span className="text-xs font-semibold text-[#2B1B1B]">Active Template</span>
        </label>
        <div className="flex items-center gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#EADFD3] text-xs font-semibold text-[#7A6A63] hover:bg-[#FBF7F2] flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={() => onSave(form)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] text-[#fff3b8] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30">
            <Save className="w-3.5 h-3.5 text-[#F6C84C]" /> Save Template
          </button>
        </div>
      </div>
    </div>
  );
};

export const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<'ALL' | 'WHATSAPP' | 'SMS'>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.templates.list();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates(DEFAULT_TEMPLATES as Template[]);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (t: Template) => {
    try {
      if (t.id) {
        await api.templates.update(t.id, t);
        setStatusMessage({ type: 'success', text: `Template "${t.name}" updated successfully.` });
      } else {
        await api.templates.create(t);
        setStatusMessage({ type: 'success', text: `Template "${t.name}" created successfully.` });
      }
      setEditingTemplate(null);
      await loadTemplates();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save template.' });
    }
  };

  const deleteTemplate = async (id: string) => {
    const tpl = templates.find(t => t.id === id);
    const title = tpl ? tpl.name : 'this template';
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await api.templates.delete(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setStatusMessage({ type: 'success', text: `Template "${title}" deleted successfully.` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete template. Please check permissions.' });
    }
  };

  const filtered = filterChannel === 'ALL' ? templates : templates.filter(t => t.channel === filterChannel);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-[#7A6A63] hover:text-[#2B1B1B]">✕</button>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-bold text-[#2B1B1B] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#7A1A2C]" />
            <span>Message Templates</span>
          </h2>
          <p className="text-xs text-[#7A6A63] mt-0.5">
            Configure standardized SMS and WhatsApp notification templates with dynamic student and exam placeholders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#F5EFE8] rounded-xl border border-[#EADFD3]">
            {(['ALL', 'WHATSAPP', 'SMS'] as const).map(ch => (
              <button key={ch} onClick={() => setFilterChannel(ch)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterChannel === ch ? 'bg-white text-[#7A1A2C] shadow-xs font-bold' : 'text-[#7A6A63]'
                }`}>{ch}</button>
            ))}
          </div>
          <button
            onClick={() => setEditingTemplate({ name: '', channel: 'WHATSAPP', template_type: 'MARKS', body: '', is_active: true })}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7A1A2C] to-[#4A101E] hover:from-[#631524] text-[#fff3b8] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#7A1A2C]/20 border border-[#C08A16]/30"
          >
            <Plus className="w-3.5 h-3.5 text-[#F6C84C]" /> New Template
          </button>
        </div>
      </div>

      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onSave={saveTemplate}
          onCancel={() => setEditingTemplate(null)}
        />
      )}

      {loading ? (
        <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-[#7A1A2C] border-t-transparent rounded-full animate-spin mx-auto"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t, i) => (
            <div key={t.id || i} className="bg-white rounded-2xl border border-[#EADFD3] shadow-xs p-5 space-y-3 hover:border-[#C08A16]/50 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {t.channel === 'WHATSAPP' ? (
                      <span className="px-2 py-0.5 bg-[#2E7D32]/10 text-[#2E7D32] border border-[#2E7D32]/20 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-[#25D366]" /> WhatsApp
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#7A1A2C]/10 text-[#7A1A2C] border border-[#7A1A2C]/20 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <Hash className="w-3 h-3 text-[#C08A16]" /> SMS
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-[#F5EFE8] text-[#7A6A63] border border-[#EADFD3] rounded text-[10px] font-bold uppercase">{t.template_type}</span>
                    {!t.is_active && <span className="px-2 py-0.5 bg-red-50 text-[#C62828] border border-red-200 rounded text-[10px] font-bold">INACTIVE</span>}
                  </div>
                  <h3 className="text-sm font-heading font-bold text-[#2B1B1B]">{t.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPreviewId(previewId === (t.id || String(i)) ? null : (t.id || String(i)))}
                    className="p-1.5 rounded-lg hover:bg-[#FBF7F2] text-[#7A6A63] hover:text-[#7A1A2C]" title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingTemplate(t)}
                    className="p-1.5 rounded-lg hover:bg-[#FBF7F2] text-[#7A6A63] hover:text-[#7A1A2C]" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {t.id && (
                    <button onClick={() => deleteTemplate(t.id!)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#C62828]" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {previewId === (t.id || String(i)) ? (
                <div className="bg-[#FBF7F2] border border-[#EADFD3] rounded-xl p-3.5 text-xs text-[#2B1B1B] whitespace-pre-line max-h-48 overflow-y-auto font-mono leading-relaxed">
                  {renderPreview(t.body)}
                </div>
              ) : (
                <p className="text-xs text-[#7A6A63] line-clamp-3 font-mono">{t.body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
