import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AuthSuccessPage } from './pages/AuthSuccess';
import { AuthErrorPage } from './pages/AuthError';
import { QueueWaitingPage } from './pages/QueueWaiting';
import { MatchPage } from './pages/MatchPage';
import { MatchHistoryPage } from './pages/MatchHistory';
import { LeaderboardPage } from './pages/Leaderboard';
import { AdminDashboardPage } from './pages/admin/AdminDashboard';
import { AdminDisputesPage } from './pages/admin/AdminDisputes';
import { AdminUsersPage } from './pages/admin/AdminUsers';
import { PrivateRoute } from './components/PrivateRoute';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/success" element={<AuthSuccessPage />} />
          <Route path="/auth/error" element={<AuthErrorPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/queue"
            element={
              <PrivateRoute>
                <QueueWaitingPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/match/:matchId"
            element={
              <PrivateRoute>
                <MatchPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <MatchHistoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <PrivateRoute>
                <LeaderboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminDashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/disputes"
            element={
              <PrivateRoute>
                <AdminDisputesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <PrivateRoute>
                <AdminUsersPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
