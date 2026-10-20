import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  Bell,
  Database,
  Shield,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsGroup {
  group: string;
  label: string;
  icon: React.ReactNode;
  fields: SettingField[];
}

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select';
  help?: string;
  options?: string[];
  placeholder?: string;
}

const SETTINGS_SCHEMA: SettingsGroup[] = [
  {
    group: 'whatsapp',
    label: 'WhatsApp (Meta Cloud API)',
    icon: <Bell className="w-4 h-4 text-indigo-600" />,
    fields: [
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', type: 'text', placeholder: 'e.g., 123456789012345' },
      { key: 'WHATSAPP_TOKEN', label: 'API Bearer Token', type: 'password', placeholder: 'EAAxxxxxxx...' },
      { key: 'WHATSAPP_TEMPLATE_NAME', label: 'Approved Template Name', type: 'text', placeholder: 'marks_notification' },
      { key: 'WHATSAPP_MOCK_MODE', label: 'Mock Mode (dev only)', type: 'boolean', help: 'In mock mode, messages are logged but not actually sent.' }
    ]
  },
  {
    group: 'sms',
    label: 'SMS Gateway (DLT)',
    icon: <Key className="w-4 h-4 text-blue-600" />,
    fields: [
      { key: 'SMS_API_URL', label: 'API Endpoint URL', type: 'text', placeholder: 'https://sms.gateway.com/api/send' },
      { key: 'SMS_API_KEY', label: 'API Key', type: 'password', placeholder: 'Your DLT gateway API key' },
      { key: 'SMS_SENDER_ID', label: 'Sender ID (DLT Header)', type: 'text', placeholder: 'CLGSMK' },
      { key: 'SMS_TEMPLATE_ID', label: 'DLT Template ID', type: 'text', placeholder: '1707xxxxxxxxxx' },
      { key: 'SMS_MOCK_MODE', label: 'Mock Mode (dev only)', type: 'boolean' }
    ]
  },
  {
    group: 'notifications',
    label: 'Notification Behavior',
    icon: <Bell className="w-4 h-4 text-violet-600" />,
    fields: [
      { key: 'NOTIFICATION_MAX_RETRIES', label: 'Max Retry Attempts', type: 'number', placeholder: '3' },
      { key: 'NOTIFICATION_BATCH_SIZE', label: 'Batch Size per Run', type: 'number', placeholder: '50' },
      { key: 'DUPLICATE_WINDOW_HOURS', label: 'Duplicate Prevention Window (hours)', type: 'number', placeholder: '24', help: 'Prevent re-sending the same marks within this many hours.' }
    ]
  },
  {
    group: 'college',
    label: 'College Details',
    icon: <Database className="w-4 h-4 text-amber-600" />,
    fields: [
      { key: 'COLLEGE_NAME', label: 'College Name', type: 'text', placeholder: 'Sunrise College of Engineering' },
      { key: 'COLLEGE_CODE', label: 'College Code', type: 'text', placeholder: 'SRCEG' },
      { key: 'COLLEGE_PHONE', label: 'Contact Phone', type: 'text', placeholder: '+91 98765 43210' }
    ]
  }
];

export const Settings: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({
    whatsapp: 'idle', sms: 'idle'
  });
  const [activeGroup, setActiveGroup] = useState('whatsapp');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.settings.getAll();
      const map: Record<string, string> = {};
      (data as any[]).forEach((s: any) => { map[s.key] = s.value ?? ''; });
      setValues(map);
    } catch {
      // Default empty
    } finally {
      setLoading(false);
    }
  };

  const saveGroup = async (group: string) => {
    setSaving(true);
    const groupFields = SETTINGS_SCHEMA.find(g => g.group === group)?.fields || [];
    const payload = groupFields.map(f => ({ key: f.key, value: values[f.key] || '', group }));
    try {
      await api.settings.bulkUpdate(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (channel: 'whatsapp' | 'sms') => {
    setTestStatus(p => ({ ...p, [channel]: 'testing' }));
    try {
      const result = await api.settings.testConnection(channel);
      setTestStatus(p => ({ ...p, [channel]: result.ok ? 'ok' : 'fail' }));
    } catch {
      setTestStatus(p => ({ ...p, [channel]: 'fail' }));
    }
    setTimeout(() => setTestStatus(p => ({ ...p, [channel]: 'idle' })), 5000);
  };

  const updateValue = (key: string, val: string) => setValues(p => ({ ...p, [key]: val }));
  const toggleReveal = (key: string) => setRevealedKeys(prev => {
    const n = new Set(prev);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });

  const currentGroup = SETTINGS_SCHEMA.find(g => g.group === activeGroup)!;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100">
            <SettingsIcon className="w-5 h-5 text-maroon-700" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">System Configuration</h2>
            <p className="text-xs text-[#7A6A63] mt-0.5">Configure API credentials, notification gateways, and institutional parameters.</p>
          </div>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Changes Saved!
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Tabs */}
        <div className="w-full md:w-52 shrink-0 space-y-1.5">
          {SETTINGS_SCHEMA.map(g => (
            <button
              key={g.group}
              onClick={() => setActiveGroup(g.group)}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                activeGroup === g.group
                  ? 'bg-maroon-700 text-white shadow-xs'
                  : 'text-[#7A6A63] hover:bg-white hover:text-[#2B1B1B] border border-transparent hover:border-[#EADFD3]'
              }`}
            >
              <span className={activeGroup === g.group ? 'text-white' : 'text-maroon-700'}>{g.icon}</span>
              <span>{g.label.split(' (')[0]}</span>
            </button>
          ))}
        </div>

        {/* Main Panel */}
        <div className="flex-1 bg-white rounded-2xl border border-[#EADFD3] shadow-xs p-6">
          {loading ? (
            <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-maroon-700 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#EADFD3] pb-4 mb-5">
                <div>
                  <h3 className="text-base font-bold font-serif text-[#2B1B1B] flex items-center gap-2">
                    <span className="text-maroon-700">{currentGroup.icon}</span>
                    <span>{currentGroup.label}</span>
                  </h3>
                  <p className="text-xs text-[#7A6A63] mt-0.5">Manage operational settings for this component.</p>
                </div>

                {(activeGroup === 'whatsapp' || activeGroup === 'sms') && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testConnection(activeGroup as 'whatsapp' | 'sms')}
                      disabled={testStatus[activeGroup] === 'testing'}
                      className="px-3 py-1.5 rounded-lg border border-[#EADFD3] hover:bg-[#FBF7F2] text-xs text-maroon-700 font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      {testStatus[activeGroup] === 'testing' ? (
                        <><RefreshCw className="w-3 h-3 animate-spin text-maroon-700" /> Testing…</>
                      ) : (
                        <><Wifi className="w-3 h-3 text-maroon-700" /> Test Connection</>
                      )}
                    </button>
                    {testStatus[activeGroup] === 'ok' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    )}
                    {testStatus[activeGroup] === 'fail' && (
                      <span className="flex items-center gap-1 text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {currentGroup.fields.map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-[#2B1B1B] block mb-1.5">{field.label}</label>
                    {field.type === 'boolean' ? (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => updateValue(field.key, values[field.key] === 'true' ? 'false' : 'true')}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            values[field.key] === 'true' ? 'bg-maroon-700' : 'bg-[#EADFD3]'
                          }`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            values[field.key] === 'true' ? 'translate-x-5' : ''
                          }`} />
                        </div>
                        <span className="text-xs font-medium text-[#2B1B1B]">{values[field.key] === 'true' ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : field.type === 'password' ? (
                      <div className="relative">
                        <input
                          type={revealedKeys.has(field.key) ? 'text' : 'password'}
                          value={values[field.key] || ''}
                          onChange={e => updateValue(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#EADFD3] text-xs font-mono bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => toggleReveal(field.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A6A63] hover:text-[#2B1B1B]"
                        >
                          {revealedKeys.has(field.key) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        value={values[field.key] || ''}
                        onChange={e => updateValue(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADFD3] text-xs font-sans bg-[#FBF7F2] text-[#2B1B1B] focus:ring-2 focus:ring-maroon-700/20 focus:border-maroon-700 transition-colors"
                      />
                    )}
                    {field.help && <p className="text-[11px] text-[#7A6A63] mt-1.5">{field.help}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between items-center border-t border-[#EADFD3] pt-4">
                <div className="flex items-center gap-1.5 text-[11px] text-[#7A6A63]">
                  <Shield className="w-3.5 h-3.5 text-maroon-700" />
                  <span>Credentials are encrypted server-side and never exposed to the client.</span>
                </div>
                <button
                  onClick={() => saveGroup(activeGroup)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white text-xs font-semibold shadow-xs flex items-center gap-2 disabled:opacity-50 border border-maroon-900/20 transition-colors"
                >
                  {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
