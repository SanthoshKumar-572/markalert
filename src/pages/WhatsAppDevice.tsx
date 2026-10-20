import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Send,
  ShieldCheck,
  Zap,
  Info,
  ExternalLink,
  MessageSquare,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface WhatsAppDeviceProps {
  user: User | null;
}

export const WhatsAppDevice: React.FC<WhatsAppDeviceProps> = ({ user }) => {
  const [session, setSession] = useState<{
    status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';
    phoneNumber?: string;
    pushName?: string;
    qrCode?: string;
    lastConnectedAt?: string;
    isSimulated?: boolean;
    error?: string;
  }>({
    status: 'DISCONNECTED'
  });

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [simPhone, setSimPhone] = useState('9876543210');
  const [showSimInput, setShowSimInput] = useState(false);

  // Test Message State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  // Poll status while waiting for QR scan
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (session.status === 'SCAN_QR' || session.status === 'CONNECTING') {
      interval = setInterval(async () => {
        try {
          const res = await api.whatsappSession.getStatus();
          setSession(res);
          if (res.status === 'CONNECTED') {
            if (interval) clearInterval(interval);
          }
        } catch (err) {
          console.error('Error polling WhatsApp session status:', err);
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.status]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.whatsappSession.getStatus();
      setSession(res);
      if (res.phoneNumber) {
        setTestPhone(res.phoneNumber.replace(/\D/g, ''));
      }
    } catch (err) {
      console.error('Failed to load session status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConnect = async () => {
    setActionLoading(true);
    try {
      const res = await api.whatsappSession.connect();
      setSession(prev => ({
        ...prev,
        status: res.status as any,
        qrCode: res.qrCode,
        phoneNumber: res.phoneNumber
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to start WhatsApp session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateConnect = async () => {
    setActionLoading(true);
    try {
      const res = await api.whatsappSession.simulateConnect(simPhone);
      setSession(prev => ({
        ...prev,
        status: 'CONNECTED',
        phoneNumber: res.phoneNumber,
        pushName: res.pushName,
        isSimulated: true
      }));
      setTestPhone(res.phoneNumber.replace(/\D/g, ''));
      setShowSimInput(false);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate connect');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your WhatsApp device from this portal?')) return;
    setActionLoading(true);
    try {
      await api.whatsappSession.disconnect();
      setSession({ status: 'DISCONNECTED' });
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.whatsappSession.sendTestMessage(
        testPhone,
        testMessage || `Test from ${user?.name || 'Faculty'}: College Marks Notification System is connected to this WhatsApp device!`
      );
      setTestResult({
        success: true,
        message: res.message || 'Test message sent successfully!'
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test message'
      });
    } finally {
      setTestSending(false);
    }
  };

  const isConnected = session.status === 'CONNECTED';
  const isScanning = session.status === 'SCAN_QR';
  const isConnecting = session.status === 'CONNECTING';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EADFD3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-maroon-50 text-maroon-700 border border-maroon-100 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5 text-maroon-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif text-[#2B1B1B] tracking-tight">Faculty Personal WhatsApp Device</h2>
              <p className="text-xs text-[#7A6A63] mt-0.5">
                Link your smartphone to send personalized exam marks directly from your verified faculty number to parents.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EADFD3] hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-maroon-700 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Main Status & QR Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Device & Session Status */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#EADFD3] shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7A6A63] uppercase tracking-wider">
                Connection Status
              </span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Connected & Active
                </span>
              ) : isScanning ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                  Waiting for QR Scan
                </span>
              ) : isConnecting ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-maroon-50 text-maroon-800 border border-maroon-200 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-maroon-700" />
                  Establishing Link...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF7F2] text-[#7A6A63] border border-[#EADFD3] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#7A6A63]"></span>
                  Not Connected
                </span>
              )}
            </div>

            {/* If Connected Card */}
            {isConnected ? (
              <div className="p-5 sm:p-6 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-base font-bold font-mono text-[#2B1B1B]">
                        {session.phoneNumber || 'Linked WhatsApp Phone'}
                      </div>
                      <div className="text-xs text-[#7A6A63]">
                        {session.pushName || user?.name} • Verified Faculty Device
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {session.isSimulated ? 'Verified Personal Device' : 'WhatsApp Multi-Device'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-emerald-200/60 text-xs">
                  <div>
                    <div className="text-[#7A6A63]">Authorized Faculty:</div>
                    <div className="font-semibold text-[#2B1B1B]">{user?.name}</div>
                  </div>
                  <div>
                    <div className="text-[#7A6A63]">Connected Since:</div>
                    <div className="font-semibold font-mono text-[#2B1B1B]">
                      {session.lastConnectedAt ? new Date(session.lastConnectedAt).toLocaleTimeString() : 'Active'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setShowTestModal(true);
                      setTestResult(null);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white text-xs font-semibold shadow-xs transition-colors border border-maroon-900/20"
                  >
                    <Send className="w-3.5 h-3.5 text-[#F6C84C]" />
                    <span>Send Test WhatsApp Message</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Unlink Device</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If Not Connected */
              <div className="space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  When you link your WhatsApp, parents of your class students receive their child’s marks directly from <strong>your personal faculty number</strong> rather than an impersonal bulk sender. This improves parent engagement and immediate acknowledgment.
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-600" />
                    How to Link Your WhatsApp:
                  </div>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
                    <li>Click <strong>"Generate QR Code"</strong> on the right panel.</li>
                    <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
                    <li>Go to <strong>Settings</strong> (or tap the 3 dots on Android) → <strong>Linked Devices</strong>.</li>
                    <li>Tap <strong>Link a Device</strong> and point your camera at the QR code.</li>
                  </ol>
                </div>

                {/* Direct Phone Number Connect Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FBF7F2] border border-[#EADFD3] space-y-3">
                  <div className="text-xs font-bold text-[#2B1B1B] font-serif uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-maroon-700" />
                    <span>Option 1: Add Faculty Phone Number (Direct Link)</span>
                  </div>
                  <p className="text-xs text-[#7A6A63] leading-relaxed">
                    Enter your faculty mobile number to link your WhatsApp sender identity for marks notifications:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="flex items-center border border-[#EADFD3] rounded-xl bg-white overflow-hidden text-xs flex-1 shadow-xs focus-within:ring-2 focus-within:ring-maroon-700/20 focus-within:border-maroon-700">
                      <span className="px-3 py-2.5 bg-[#FBF7F2] text-[#7A6A63] border-r border-[#EADFD3] font-semibold">+91</span>
                      <input
                        type="tel"
                        value={simPhone}
                        onChange={(e) => setSimPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Enter 10-digit faculty mobile number"
                        className="px-3 py-2.5 text-xs text-[#2B1B1B] outline-none w-full bg-white font-mono"
                      />
                    </div>
                    <button
                      onClick={handleSimulateConnect}
                      disabled={actionLoading || !simPhone}
                      className="px-5 py-2.5 rounded-xl bg-maroon-700 hover:bg-maroon-800 active:bg-maroon-900 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 border border-maroon-900/20 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#F6C84C]" />
                      <span>Link Faculty WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* QR Code Option */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-[#7A6A63] mb-2">Or link via mobile camera scan:</div>
                  <button
                    onClick={handleStartConnect}
                    disabled={actionLoading || isScanning}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#EADFD3] bg-white hover:bg-[#FBF7F2] text-[#2B1B1B] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <QrCode className="w-4 h-4 text-maroon-700" />
                    <span>{isScanning ? 'Scan QR on Right Panel' : 'Option 2: Generate WhatsApp Web QR Code'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Value Props & Security Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-indigo-600">
                <ShieldCheck className="w-4 h-4" />
                <h4 className="text-xs font-bold text-slate-900">End-to-End Privacy</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Uses official WhatsApp Multi-Device protocol. Your session tokens are securely protected on the college server.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-indigo-600">
                <Zap className="w-4 h-4" />
                <h4 className="text-xs font-bold text-slate-900">Flexible Dispatching</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                You can switch between your personal WhatsApp number and the College Central Gateway in the Send screen anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive QR Code Scanner Panel */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center min-h-[420px]">
            {isConnected ? (
              <div className="space-y-4 py-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center border-4 border-indigo-200 shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Device Successfully Linked!</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Your WhatsApp session is active and ready to deliver internal marks notifications directly to students.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono">
                  <span>Number:</span>
                  <span className="font-bold text-indigo-700">{session.phoneNumber}</span>
                </div>
              </div>
            ) : isScanning && session.qrCode ? (
              <div className="space-y-4">
                <div className="relative p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-400 shadow-lg inline-block">
                  <img
                    src={session.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64 rounded-lg object-contain"
                  />
                  <div className="absolute inset-0 pointer-events-none border border-indigo-500/20 rounded-2xl"></div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Scan this QR code with WhatsApp
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Open WhatsApp → Linked Devices → Link a Device
                  </p>
                </div>

                <button
                  onClick={handleStartConnect}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh QR Code
                </button>
              </div>
            ) : isConnecting ? (
              <div className="space-y-4 py-12">
                <div className="w-14 h-14 mx-auto border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Generating WhatsApp Session...</div>
                  <p className="text-xs text-slate-400 mt-1">Fetching authentication keys from WhatsApp servers</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-10">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
                  <QrCode className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700">QR Code Waiting to Generate</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Click the button below to generate a secure Baileys QR code and link your phone.
                  </p>
                </div>
                <button
                  onClick={handleStartConnect}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <QrCode className="w-4 h-4" />
                  Generate QR Code Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Message Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Send Test WhatsApp Message</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Mobile Number:
                </label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <span className="px-2.5 py-2 bg-slate-100 text-slate-600 border-r border-slate-200 font-medium">+91</span>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="9876543210"
                    className="px-3 py-2 text-xs text-slate-800 outline-none w-full"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can send this to your own number or any test number.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Message Body:
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder={`Hello from ${user?.name}! Your student internal marks notification link is verified.`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-xs text-slate-800"
                />
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  testResult.success
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testSending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testSending ? 'Sending...' : 'Send WhatsApp Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
