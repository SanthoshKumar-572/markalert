import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NotifyWizard } from './pages/NotifyWizard';
import { NotificationHistory } from './pages/NotificationHistory';
import { Students } from './pages/Students';
import { Parents } from './pages/Parents';
import { Academic } from './pages/Academic';
import { Reports } from './pages/Reports';
import { Templates } from './pages/Templates';
import { Settings } from './pages/Settings';
import { WhatsAppDevice } from './pages/WhatsAppDevice';
import { SplashScreen } from './components/SplashScreen';
import { api } from './services/api';
import { User, PreviewRow } from './types';

export type PageId =
  | 'dashboard'
  | 'upload'
  | 'send'
  | 'notify-wizard'
  | 'whatsapp-device'
  | 'notifications'
  | 'students'
  | 'parents'
  | 'academic'
  | 'reports'
  | 'templates'
  | 'settings';

interface SendData {
  examId?: string;
  rows?: PreviewRow[];
  fileName?: string;
  uploadId?: string;
}

interface UploadPreset {
  deptId?: string;
  classId?: string;
}

export const getPageTitle = (page: string, isAdmin?: boolean): string => {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    upload: 'Marks Notification Wizard',
    send: 'Marks Notification Wizard',
    'notify-wizard': 'Marks Notification Wizard',
    'whatsapp-device': 'Faculty WhatsApp Session',
    notifications: 'Notification History',
    students: 'Students & Class Master',
    parents: 'Parents Directory',
    academic: isAdmin ? 'Faculty & Academic' : 'Academic Classes',
    reports: 'Class Marks Reports',
    templates: 'Message Templates',
    settings: 'System Settings'
  };
  return map[page] || 'Dashboard';
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sendData, setSendData] = useState<SendData | null>(null);
  const [uploadPreset, setUploadPreset] = useState<UploadPreset | null>(null);

  // Navigation History Stack for Backward / Forward navigation
  const [historyStack, setHistoryStack] = useState<PageId[]>(['dashboard']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  useEffect(() => {
    const stored = api.auth.getCurrentUser();
    if (stored) {
      setUser(stored);
    }
    setCheckingAuth(false);
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActivePage('dashboard');
    setHistoryStack(['dashboard']);
    setHistoryIndex(0);
  };

  const handleLogout = () => {
    api.auth.logout();
    setUser(null);
    setActivePage('dashboard');
    setHistoryStack(['dashboard']);
    setHistoryIndex(0);
  };

  const navigateTo = useCallback((page: PageId, extraData?: SendData) => {
    if (extraData) {
      setSendData(extraData);
    }

    setHistoryStack(prev => {
      // If already on this page and top of stack, keep
      if (prev[historyIndex] === page) return prev;
      const newStack = [...prev.slice(0, historyIndex + 1), page];
      setHistoryIndex(newStack.length - 1);
      return newStack;
    });

    setActivePage(page);

    try {
      window.history.pushState({ page, historyIndex: historyIndex + 1 }, '', `?page=${page}`);
    } catch (e) {}
  }, [historyIndex]);

  const handleGoBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevPage = historyStack[prevIndex];
      setHistoryIndex(prevIndex);
      setActivePage(prevPage);
      try {
        window.history.pushState({ page: prevPage, historyIndex: prevIndex }, '', `?page=${prevPage}`);
      } catch (e) {}
    }
  }, [historyIndex, historyStack]);

  const handleGoForward = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextPage = historyStack[nextIndex];
      setHistoryIndex(nextIndex);
      setActivePage(nextPage);
      try {
        window.history.pushState({ page: nextPage, historyIndex: nextIndex }, '', `?page=${nextPage}`);
      } catch (e) {}
    }
  }, [historyIndex, historyStack]);

  // Sync with browser back/forward buttons and keyboard shortcuts (Alt+Left / Alt+Right)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.page) {
        setActivePage(e.state.page);
        if (typeof e.state.historyIndex === 'number') {
          setHistoryIndex(e.state.historyIndex);
        }
      } else {
        const p = new URLSearchParams(window.location.search).get('page') as PageId;
        if (p) setActivePage(p);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoForward();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGoBack, handleGoForward]);

  const handleProceedToSend = (
    examId: string,
    rows: PreviewRow[],
    fileName: string,
    uploadId: string
  ) => {
    navigateTo('notify-wizard', { examId, rows, fileName, uploadId });
  };

  if (showSplash) {
    return (
      <SplashScreen
        onComplete={() => setShowSplash(false)}
        onLoginSuccess={handleLogin}
        isLoggedIn={Boolean(user)}
      />
    );
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  const isAdmin = user.role === 'ADMIN';
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;
  const previousPageTitle = canGoBack ? getPageTitle(historyStack[historyIndex - 1], isAdmin) : undefined;
  const nextPageTitle = canGoForward ? getPageTitle(historyStack[historyIndex + 1], isAdmin) : undefined;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={(page) => navigateTo(page as PageId)} user={user} />;
      case 'upload':
      case 'send':
      case 'notify-wizard': {
        const presetKey = uploadPreset ? `${uploadPreset.deptId}-${uploadPreset.classId}` : 'default';
        return (
          <NotifyWizard
            key={presetKey}
            initialDeptId={uploadPreset?.deptId}
            initialClassId={uploadPreset?.classId}
            onNavigateToHistory={() => navigateTo('notifications')}
            onNavigateToDashboard={() => navigateTo('dashboard')}
          />
        );
      }
      case 'whatsapp-device':
        return <WhatsAppDevice user={user} />;
      case 'notifications':
        return <NotificationHistory />;
      case 'students':
        return (
          <Students
            isAdmin={isAdmin}
            onNavigateToUpload={(deptId, classId) => {
              setUploadPreset({ deptId, classId });
              navigateTo('upload');
            }}
          />
        );
      case 'parents':
        return <Parents isAdmin={isAdmin} />;
      case 'academic':
        return <Academic isAdmin={isAdmin} />;
      case 'reports':
        return <Reports />;
      case 'templates':
        return <Templates />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={(page) => navigateTo(page as PageId)} user={user} />;
    }
  };

  return (
    <DashboardLayout
      user={user}
      activePage={activePage}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onGoBack={handleGoBack}
      onGoForward={handleGoForward}
      previousPageTitle={previousPageTitle}
      nextPageTitle={nextPageTitle}
      historyStack={historyStack}
      historyIndex={historyIndex}
      onNavigate={(page) => navigateTo(page as PageId)}
      onLogout={handleLogout}
    >
      {renderPage()}
    </DashboardLayout>
  );
}

export default App;

