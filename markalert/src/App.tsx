import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query';
import { AuthProvider, ProtectedRoute, AdminRoute } from './lib/auth';
import { DashboardLayout } from './layouts/DashboardLayout';
import SplashScreen from './components/SplashScreen';

// Page Components
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { ReviewPage } from './pages/ReviewPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProgressPage } from './pages/ProgressPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubjectMarksPage } from './pages/SubjectMarksPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('splashSeen');
    } catch {
      return false;
    }
  });

  const finish = React.useCallback(() => {
    try {
      sessionStorage.setItem('splashSeen', '1');
    } catch {
      // ignore
    }
    setShowSplash(false);
  }, []);

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen onDone={finish} />}
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated Dashboard Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DashboardPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UploadPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/subject-marks"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SubjectMarksPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/batches/:id/review"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ReviewPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/batches/:id/messages"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MessagesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/batches/:id/progress"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProgressPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <HistoryPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin Management Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <DashboardLayout>
                    <AdminDashboardPage />
                  </DashboardLayout>
                </AdminRoute>
              }
            />

            <Route
              path="/admin/faculty"
              element={
                <AdminRoute>
                  <DashboardLayout>
                    <AdminDashboardPage />
                  </DashboardLayout>
                </AdminRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <DashboardLayout>
                    <SettingsPage />
                  </DashboardLayout>
                </AdminRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
