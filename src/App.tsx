import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useData } from '@/state/DataProvider';
import { useApplyTheme } from '@/state/theme';
import { HomePage } from '@/pages/HomePage';
import { WelcomePage } from '@/pages/WelcomePage';
const TrainPage = lazy(() => import('@/pages/TrainPage').then((m) => ({ default: m.TrainPage })));
const ExercisesPage = lazy(() => import('@/pages/ExercisesPage').then((m) => ({ default: m.ExercisesPage })));
const ExercisePage = lazy(() => import('@/pages/ExercisePage').then((m) => ({ default: m.ExercisePage })));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })));
const ProgressPage = lazy(() => import('@/pages/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export function App() {
  const { data, loading } = useData();
  useApplyTheme(data.settings.theme);

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregant…</div>;
  }
  if (!data.profile) return <WelcomePage />;

  return (
    <Routes>
      <Route
        element={
          <Suspense fallback={<div className="p-8 text-muted-foreground">Carregant…</div>}>
            <AppShell />
          </Suspense>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="entrenar" element={<TrainPage />} />
        <Route path="exercicis" element={<ExercisesPage />} />
        <Route path="exercicis/:id" element={<ExercisePage />} />
        <Route path="analisi" element={<AnalysisPage />} />
        <Route path="progres" element={<ProgressPage />} />
        <Route path="configuracio" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
