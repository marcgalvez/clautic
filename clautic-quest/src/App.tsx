import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './lib/session';
import type { Role } from './lib/types';
import { homeFor } from './lib/home';
import { ErrorBox, Spinner } from './components/ui';
import Login from './pages/Login';
import Activate from './pages/Activate';
import { AdminShell, FamilyShell, StudentShell, TeacherShell } from './components/Shells';

const CityPage = lazy(() => import('./pages/student/CityPage'));
const DistrictPage = lazy(() => import('./pages/student/DistrictPage'));
const MyHousePage = lazy(() => import('./pages/student/MyHousePage'));
const VisitHousePage = lazy(() => import('./pages/student/VisitHousePage'));
const ShopPage = lazy(() => import('./pages/student/ShopPage'));
const MuseumPage = lazy(() => import('./pages/student/MuseumPage'));
const LabPage = lazy(() => import('./pages/student/LabPage'));
const CompetitionsPage = lazy(() => import('./pages/student/CompetitionsPage'));
const CorePage = lazy(() => import('./pages/student/CorePage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));
const ClassMode = lazy(() => import('./pages/teacher/ClassMode'));
const AttendancePage = lazy(() => import('./pages/teacher/AttendancePage'));
const TeacherMissions = lazy(() => import('./pages/teacher/TeacherMissions'));
const BalancePage = lazy(() => import('./pages/teacher/BalancePage'));
const StudentDetail = lazy(() => import('./pages/teacher/StudentDetail'));
const FamilyHome = lazy(() => import('./pages/family/FamilyHome'));
const FamilyCompetencies = lazy(() => import('./pages/family/FamilyCompetencies'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminStudents = lazy(() => import('./pages/admin/AdminStudents'));
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople'));
const AdminGroups = lazy(() => import('./pages/admin/AdminGroups'));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig'));
const AdminActivities = lazy(() => import('./pages/admin/AdminActivities'));
const AdminMovements = lazy(() => import('./pages/admin/AdminMovements'));
const AdminInvitations = lazy(() => import('./pages/admin/AdminInvitations'));

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { session, ctx, loading, error, refresh } = useSession();
  const loc = useLocation();
  if (loading) return <Spinner label="Connectant amb ClauTIC City…" />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  if (error) return <ErrorBox error={error} onRetry={refresh} />;
  if (!ctx) return <Spinner />;
  if (!roles.some((r) => ctx.roles.includes(r))) return <Navigate to={homeFor(ctx.roles)} replace />;
  return <>{children}</>;
}

function Home() {
  const { session, ctx, loading } = useSession();
  if (loading) return <Spinner />;
  if (!session || !ctx) return <Navigate to="/entrar" replace />;
  return <Navigate to={homeFor(ctx.roles)} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/activar" element={<Activate />} />

        <Route path="/ciutat" element={<Guard roles={['student']}><StudentShell /></Guard>}>
          <Route index element={<CityPage />} />
          <Route path="barri/:id" element={<DistrictPage />} />
          <Route path="casa" element={<MyHousePage />} />
          <Route path="casa/:id" element={<VisitHousePage />} />
          <Route path="botiga" element={<ShopPage />} />
          <Route path="museu" element={<MuseumPage />} />
          <Route path="lab/:line" element={<LabPage />} />
          <Route path="competicions" element={<CompetitionsPage />} />
          <Route path="nucli" element={<CorePage />} />
          <Route path="jo" element={<ProfilePage />} />
        </Route>

        <Route path="/profe" element={<Guard roles={['teacher', 'admin']}><TeacherShell /></Guard>}>
          <Route index element={<ClassMode />} />
          <Route path="assistencia" element={<AttendancePage />} />
          <Route path="missions" element={<TeacherMissions />} />
          <Route path="equilibri" element={<BalancePage />} />
          <Route path="alumne/:id" element={<StudentDetail />} />
          <Route path="ciutat" element={<CityPage staff />} />
          <Route path="barri/:id" element={<DistrictPage />} />
          <Route path="casa/:id" element={<VisitHousePage />} />
        </Route>

        <Route path="/familia" element={<Guard roles={['family']}><FamilyShell /></Guard>}>
          <Route index element={<FamilyHome />} />
          <Route path="competencies" element={<FamilyCompetencies />} />
          <Route path="casa/:id" element={<VisitHousePage light />} />
        </Route>

        <Route path="/admin" element={<Guard roles={['admin']}><AdminShell /></Guard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="alumnes" element={<AdminStudents />} />
          <Route path="alumne/:id" element={<StudentDetail />} />
          <Route path="professors" element={<AdminPeople role="teacher" />} />
          <Route path="families" element={<AdminPeople role="family" />} />
          <Route path="grups" element={<AdminGroups />} />
          <Route path="config/:section" element={<AdminConfig />} />
          <Route path="activitats" element={<AdminActivities />} />
          <Route path="moviments" element={<AdminMovements />} />
          <Route path="invitacions" element={<AdminInvitations />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
