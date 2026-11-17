import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Building,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldAlert,
  Smartphone,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

export const SettingsPage: React.FC = () => {
  const { user, syncMobileNumber } = useAuth();
  const [mobileInput, setMobileInput] = useState(user?.mobile_number || '');
  const [syncingMobile, setSyncingMobile] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [collegeName, setCollegeName] = useState('');
  const [mockMode, setMockMode] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.reports.getSettings(),
  });

  useEffect(() => {
    if (user?.mobile_number && !mobileInput) {
      setMobileInput(user.mobile_number);
    }
  }, [user?.mobile_number]);

  const handleSyncMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncingMobile(true);
    setSyncSuccess(false);
    setSyncError(null);
    try {
      await syncMobileNumber(mobileInput);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err: any) {
      setSyncError(err.response?.data?.error || err.message || 'Failed to sync mobile number');
    } finally {
      setSyncingMobile(false);
    }
  };

  useEffect(() => {
    if (settingsData) {
      if (settingsData.COLLEGE_NAME) setCollegeName(settingsData.COLLEGE_NAME);
      if (settingsData.MOCK_NOTIFICATION_PROVIDER !== undefined) {
        setMockMode(String(settingsData.MOCK_NOTIFICATION_PROVIDER).toLowerCase() === 'true');
      }
    }
  }, [settingsData]);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.reports.updateSettings({
        COLLEGE_NAME: collegeName,
        MOCK_NOTIFICATION_PROVIDER: String(mockMode),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 font-sans">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#7A1A2C] block">
          System & Institution Configuration
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 leading-tight mt-0.5">
          System Preferences
        </h1>
        <p className="text-xs text-stone-500 mt-1 font-medium">
          Institution branding, notification provider modes, and dispatch parameters
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Settings updated successfully. Changes applied to all notification templates.</span>
        </div>
      )}

      {/* Faculty Profile & Mobile Number Sync Card */}
      <Card className="border border-stone-200/90 rounded-2xl shadow-xs bg-white">
        <CardHeader
          title="Faculty Profile & Mobile Sync"
          description="Your mobile number automatically syncs on every login. You can also use it to log in directly."
        />
        <CardContent className="space-y-4">
          {syncSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Mobile number successfully synced and verified with your faculty account!</span>
            </div>
          )}

          {syncError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-stone-400 font-bold block uppercase text-[10px]">Faculty</span>
              <span className="font-bold text-stone-900 mt-0.5 block truncate">{user?.full_name}</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-stone-400 font-bold block uppercase text-[10px]">Employee ID</span>
              <span className="font-mono font-bold text-stone-900 mt-0.5 block">{user?.employee_id}</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-stone-400 font-bold block uppercase text-[10px]">Department</span>
              <span className="font-semibold text-stone-900 mt-0.5 block truncate">{user?.department}</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-stone-400 font-bold block uppercase text-[10px]">Role</span>
              <span className="font-semibold text-stone-900 mt-0.5 block">{user?.role}</span>
            </div>
          </div>

          <form onSubmit={handleSyncMobile} className="space-y-3 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Your Respective Mobile Number (WhatsApp & SMS)</span>
              </label>
              <div className="flex gap-2">
                <div className="flex items-center bg-stone-100 border border-stone-200 px-3 rounded-xl text-xs font-bold text-stone-600">
                  +91
                </div>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={mobileInput}
                  onChange={e => setMobileInput(e.target.value)}
                  maxLength={10}
                  className="flex-1 px-4 py-2.5 min-h-[46px] bg-stone-50/60 border border-stone-200 rounded-xl text-sm font-mono font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
                />
                <Button
                  type="submit"
                  isLoading={syncingMobile}
                  className="gap-1.5 min-h-[46px] px-5"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Sync Mobile</span>
                </Button>
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5">
                When logging in from your mobile phone, you can enter this 10-digit mobile number directly instead of typing your email.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* College Branding */}
      <Card className="border border-stone-200/90 rounded-2xl shadow-xs bg-white">
        <CardHeader
          title="College & Institution Identity"
          description="Used dynamically in parent message templates under the {COLLEGE_NAME} variable"
        />
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
              College Name
            </label>
            <input
              type="text"
              placeholder="V.S.B. Engineering College, Karur"
              value={collegeName}
              onChange={e => setCollegeName(e.target.value)}
              className="w-full px-4 py-2.5 min-h-[46px] bg-stone-50/60 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mock Mode Control */}
      <Card className="border border-stone-200/90 rounded-2xl shadow-xs bg-white">
        <CardHeader
          title="Notification Dispatch Provider Mode"
          description="Switch between risk-free simulated test mode and real production sending"
        />
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-stone-900 block">
                Mock Simulation Provider Mode
              </span>
              <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                When enabled, WhatsApp and SMS dispatches are safely simulated with mock message IDs. Real parents will not be billed or messaged, allowing end-to-end testing with demo student records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMockMode(!mockMode)}
              className={`min-h-[44px] min-w-[56px] relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center ${
                mockMode ? 'bg-[#7A1A2C]' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  mockMode ? 'translate-x-5 bg-[#F6C84C]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="min-h-[48px] px-6 rounded-xl bg-[#7A1A2C] hover:bg-[#631524] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4 text-[#F6C84C]" />
          <span>{saving ? 'Saving Preferences...' : 'Save System Settings'}</span>
        </button>
      </div>
    </div>
  );
};
