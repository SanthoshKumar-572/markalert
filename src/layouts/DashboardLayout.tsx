import React from 'react';
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  BookOpen,
  UploadCloud,
  Send,
  History,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  GraduationCap,
  Sparkles,
  Menu,
  X,
  Smartphone,
  QrCode,
  User as UserIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { User } from '../types';

interface DashboardLayoutProps {
  user: User | null;
  activePage: string;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  previousPageTitle?: string;
  nextPageTitle?: string;
  historyStack?: string[];
  historyIndex?: number;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  activePage,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  previousPageTitle,
  nextPageTitle,
  historyStack = [],
  historyIndex = 0,
  onNavigate,
  onLogout,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'ADMIN';

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, role: 'ALL' },
    { id: 'students', label: 'Student Roster', icon: Users, role: 'ALL' },
    { id: 'academic', label: 'Faculty Management', icon: BookOpen, role: 'ALL' },
    { id: 'upload', label: 'Upload Marks', icon: UploadCloud, role: 'ALL' },
    { id: 'send', label: 'Notify Parents', icon: Send, badge: 'WIZARD', role: 'ALL' },
    { id: 'whatsapp-device', label: 'Faculty WhatsApp', icon: Smartphone, role: 'ALL' },
    { id: 'templates', label: 'Message Templates', icon: FileText, role: 'ALL' },
    { id: 'notifications', label: 'Notification History', icon: History, role: 'ALL' },
    { id: 'reports', label: 'Reports', icon: BarChart3, role: 'ALL' },
    { id: 'settings', label: 'Settings', icon: Settings, role: 'ADMIN' },
  ];

  // Pages that should highlight the 'upload' or 'send' nav item
  const wizardPageIds = new Set(['upload', 'send', 'notify-wizard']);
  const visibleNavItems = navItems.filter(item => item.role === 'ALL' || (item.role === 'ADMIN' && isAdmin));

  return (
    <div className="min-h-screen bg-[#FBF7F2] flex flex-col md:flex-row text-[#2B1B1B]">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-gradient-to-r from-[#4A101E] to-[#2D0811] text-white px-4 py-3 flex items-center justify-between border-b border-[#7A1A2C]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white p-0.5 flex items-center justify-center shadow-md border border-[#C08A16]/40 overflow-hidden shrink-0">
            <img src="/app-logo.png" alt="App Logo" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight leading-none text-[#fff3b8]">CollegeSMS</div>
            <div className="text-[10px] text-[#F6C84C] font-semibold tracking-wide">VSB ENGINEERING COLLEGE</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Mobile Profile Circle */}
          <button
            onClick={() => {
              setProfileDropdownOpen(!profileDropdownOpen);
              if (mobileMenuOpen) setMobileMenuOpen(false);
            }}
            className="relative p-0.5 rounded-full ring-2 ring-[#F6C84C]/50 hover:ring-[#F6C84C] transition-all focus:outline-none"
            title="User Profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7A1A2C] to-[#C08A16] flex items-center justify-center text-[#fff3b8] font-bold text-xs shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#2E7D32] rounded-full border border-[#4A101E]"></span>
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              if (profileDropdownOpen) setProfileDropdownOpen(false);
            }}
            className="p-2 rounded-lg bg-[#7A1A2C]/60 text-[#fbeec4] hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Profile Dropdown Overlay */}
        {profileDropdownOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#2D0811] border-b border-[#7A1A2C] p-4 z-50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 text-left">
            <div className="flex items-center gap-3 pb-3 border-b border-[#7A1A2C]/60">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#7A1A2C] to-[#C08A16] flex items-center justify-center text-[#fff3b8] font-extrabold text-base ring-2 ring-[#F6C84C]/40">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-[#fff3b8] truncate">{user?.name}</div>
                <div className="text-xs text-[#fbeec4]/70 truncate">{user?.email}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    isAdmin ? 'bg-[#C08A16]/30 text-[#F6C84C]' : 'bg-[#7A1A2C]/60 text-[#fff3b8]'
                  }`}>
                    <Shield className="w-2.5 h-2.5 mr-1" />
                    {user?.role}
                  </span>
                  <span className="text-[10px] text-[#2E7D32] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>

            <div className="py-2 space-y-1 text-xs text-[#fbeec4]">
              <button
                onClick={() => {
                  onNavigate('whatsapp-device');
                  setProfileDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#7A1A2C] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-[#F6C84C]" />
                  <span>Faculty WhatsApp Session</span>
                </div>
                <span className="text-[10px] bg-[#C08A16]/30 text-[#F6C84C] font-semibold px-1.5 py-0.5 rounded">Setup</span>
              </button>
              <button
                onClick={() => {
                  onNavigate('notifications');
                  setProfileDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#7A1A2C] transition-colors"
              >
                <History className="w-4 h-4 text-[#fbeec4]/70" />
                <span>Notification History</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#7A1A2C] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#fbeec4]/70" />
                  <span>Settings & Audit</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[#7A1A2C]">
              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Navigation – Dark Burgundy Institutional Canvas */}
      <aside className={`
        ${mobileMenuOpen ? 'block' : 'hidden'} md:flex
        w-full md:w-64 bg-gradient-to-b from-[#2D0811] via-[#4A101E] to-[#2D0811] text-white flex-col shrink-0 border-r border-[#631524]/60 z-30 shadow-xl relative
      `}>
        {/* Branding Header */}
        <div className="p-5 border-b border-[#631524]/60 hidden md:flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-0.5 flex items-center justify-center shadow-lg border border-[#C08A16]/50 shrink-0 ring-2 ring-[#C08A16]/40 overflow-hidden">
            <img src="/app-logo.png" alt="College Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-black text-lg tracking-tight text-white leading-tight flex items-center gap-1.5">
              CollegeSMS
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#C08A16] text-[#2D0811] font-mono font-extrabold uppercase">v2</span>
            </h1>
            <p className="text-[10px] text-[#F6C84C] font-semibold tracking-wide truncate">VSB ENGINEERING COLLEGE</p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-3 border-b border-[#631524]/40 bg-[#1c060d]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7A1A2C] to-[#C08A16] flex items-center justify-center text-[#fff3b8] font-bold text-xs shadow-md border border-[#F6C84C]/40">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{user?.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-[#C08A16]/30 text-[#F6C84C] border border-[#C08A16]/50'
                    : 'bg-[#7A1A2C] text-[#fff3b8] border border-[#F6C84C]/30'
                }`}>
                  <Shield className="w-2.5 h-2.5 mr-1 text-[#F6C84C]" />
                  {user?.role}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = (item.id === 'upload' || item.id === 'send')
              ? (activePage === item.id || (item.id === 'send' && activePage === 'notify-wizard'))
              : activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7A1A2C] to-[#631524] text-white shadow-md shadow-[#2D0811]/50 border-l-4 border-[#F6C84C]'
                    : 'text-white/75 hover:bg-[#631524]/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#F6C84C]' : 'text-white/60 group-hover:text-[#F6C84C]'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                    isActive ? 'bg-[#F6C84C] text-[#2D0811]' : 'bg-[#C08A16]/30 text-[#F6C84C] border border-[#C08A16]/40'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#631524]/60 bg-[#1c060d]/60">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:bg-red-500/20 hover:text-white transition-all border border-transparent hover:border-red-500/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header – Warm Ivory / White Canvas with subtle borders */}
        <header className="bg-white/95 backdrop-blur-md border-b border-[#EADFD3] px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          {/* Left: Breadcrumbs & Academic Year Info */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs text-[#7A6A63] font-medium">
                <span className="hover:text-[#7A1A2C] cursor-pointer" onClick={() => onNavigate('dashboard')}>CollegeSMS</span>
                <span>/</span>
                <span className="font-bold text-[#2B1B1B]">
                  {visibleNavItems.find(i => i.id === activePage)?.label || 'Dashboard'}
                </span>
              </div>
              <h2 className="font-heading text-lg font-bold text-[#2B1B1B] capitalize tracking-tight mt-0.5">
                {visibleNavItems.find(i => i.id === activePage)?.label || 'Dashboard'}
              </h2>
            </div>

            {/* Academic Year Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5EFE8] border border-[#EADFD3] text-[11px] font-semibold text-[#7A6A63]">
              <GraduationCap className="w-3.5 h-3.5 text-[#C08A16]" />
              <span>AY 2024–25 • Even Semester</span>
            </div>
          </div>

          {/* Right: Quick actions, notifications, user profile */}
          <div className="flex items-center gap-3">
            {/* Notification History quick link */}
            <button
              onClick={() => onNavigate('notifications')}
              className="p-2 rounded-xl text-[#7A6A63] hover:text-[#7A1A2C] hover:bg-[#F5EFE8] transition-colors relative border border-transparent hover:border-[#EADFD3]"
              title="Notifications History"
            >
              <Send className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2E7D32]"></span>
            </button>

            {/* Separate Profile Circle & Account Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                id="top-profile-circle-btn"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="group flex items-center gap-2.5 p-1 rounded-full hover:bg-[#FBF7F2] transition-all border border-transparent hover:border-[#EADFD3] focus:outline-none focus:ring-2 focus:ring-[#7A1A2C]/30"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                title="User Profile & Settings"
              >
                {/* Distinct Profile Circle Avatar */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7A1A2C] to-[#C08A16] flex items-center justify-center text-[#fff3b8] font-bold text-sm shadow-sm ring-2 ring-[#F6C84C]/40 group-hover:ring-[#F6C84C] transition-all">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  {/* Status Indicator Dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#2E7D32] rounded-full border-2 border-white ring-1 ring-[#2E7D32]/30"></span>
                </div>

                {/* Name / Role Details */}
                <div className="hidden md:flex flex-col text-left">
                  <div className="text-xs font-bold text-[#2B1B1B] leading-tight truncate max-w-[130px]">
                    {user?.name || 'My Account'}
                  </div>
                  <div className="text-[10px] text-[#7A6A63] font-medium capitalize">
                    {user?.role === 'ADMIN' ? 'Administrator' : 'Faculty Member'}
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-[#7A6A63] hidden md:block transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-[#7A1A2C]' : ''}`} />
              </button>

              {/* Profile Dropdown Popup */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-2xl shadow-2xl border border-[#EADFD3] p-3 z-50 text-[#2B1B1B] animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Card Header */}
                  <div className="p-3 bg-gradient-to-br from-[#4A101E] to-[#1c060d] rounded-xl text-[#fff3b8] mb-2 shadow-inner border border-[#7A1A2C]">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#7A1A2C] to-[#C08A16] flex items-center justify-center text-[#fff3b8] font-extrabold text-lg shadow-md ring-2 ring-[#F6C84C]/50">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#fff3b8] truncate">{user?.name}</div>
                        <div className="text-xs text-[#fbeec4]/75 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-[#F6C84C] shrink-0" />
                          <span className="truncate">{user?.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#7A1A2C] flex items-center justify-between text-[11px]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
                        isAdmin
                          ? 'bg-[#C08A16]/30 text-[#F6C84C] border border-[#C08A16]/40'
                          : 'bg-[#7A1A2C]/60 text-[#fff3b8] border border-[#7A1A2C]'
                      }`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {user?.role === 'ADMIN' ? 'Administrator' : 'Faculty Member'}
                      </span>
                      <span className="inline-flex items-center text-[#2E7D32] gap-1 font-medium text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Links */}
                  <div className="space-y-1 py-1 text-xs">
                    <button
                      onClick={() => {
                        onNavigate('whatsapp-device');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[#2B1B1B] hover:bg-[#FBF7F2] hover:text-[#7A1A2C] font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-[#C08A16]" />
                        <span>Faculty WhatsApp Session</span>
                      </div>
                      <span className="text-[10px] bg-[#F6C84C]/20 text-[#7A1A2C] font-semibold px-1.5 py-0.5 rounded border border-[#C08A16]/20">Setup</span>
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('notifications');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#2B1B1B] hover:bg-[#FBF7F2] hover:text-[#7A1A2C] font-medium transition-colors"
                    >
                      <History className="w-4 h-4 text-[#7A6A63]" />
                      <span>Dispatch History</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          onNavigate('settings');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#2B1B1B] hover:bg-[#FBF7F2] hover:text-[#7A1A2C] font-medium transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[#7A6A63]" />
                        <span>System Settings & Audit</span>
                      </button>
                    )}
                  </div>

                  {/* Sign Out Button */}
                  <div className="pt-2 mt-1 border-t border-[#EADFD3]">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#C62828] hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
