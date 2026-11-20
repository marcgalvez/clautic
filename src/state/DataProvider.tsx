import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LocalRepository } from '@/lib/storage/localRepository';
import type { Repository } from '@/lib/storage/repository';
import { EMPTY_DATA, type AppData, type AppSettings, type Attempt, type DiagnosticResult, type ExternalRating, type ReviewItem, type TrainingSession, type UserProfile } from '@/lib/storage/types';
import type { StoredGame } from '@/lib/games/types';
import type { Exercise } from '@/lib/exercises/types';
import type { CoachConversation } from '@/lib/coach/types';
import { migrate } from '@/lib/storage/localRepository';
import { registerCustomExercises } from '@/lib/exercises/bank';
import { translate, type MessageKey } from '@/i18n';

interface DataContextValue {
  data: AppData;
  loading: boolean;
  saveError: string | null;
  repositoryKind: Repository['kind'];
  signOut?: () => void;
  setProfile: (p: UserProfile) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  addAttempt: (a: Attempt) => void;
  upsertSession: (s: TrainingSession) => void;
  setReviews: (r: ReviewItem[]) => void;
  addDiagnostic: (d: DiagnosticResult) => void;
  addExternalRatings: (r: ExternalRating[]) => void;
  removeExternalRating: (id: string) => void;
  upsertGame: (g: StoredGame) => void;
  removeGame: (id: string) => void;
  addCustomExercises: (e: Exercise[]) => void;
  upsertConversation: (c: CoachConversation) => void;
  exportData: () => string;
  importData: (json: string) => void;
  resetAll: () => Promise<void>;
  t: (key: MessageKey) => string;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children, repository, signOut }: { children: ReactNode; repository?: Repository; signOut?: () => void }) {
  const repoRef = useRef<Repository>(repository ?? new LocalRepository());
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    repoRef.current
      .load()
      .then((d) => {
        loaded.current = true;
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        // Never lose the session over a network error: keep working, show the problem.
        setSaveError(`No s'han pogut carregar les dades del núvol: ${e.message}`);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    repoRef.current
      .save(data)
      .then(() => setSaveError(null))
      .catch((e: Error) => setSaveError(`No s'han pogut desar les dades: ${e.message}`));
  }, [data]);

  const setProfile = useCallback((profile: UserProfile) => setData((d) => ({ ...d, profile })), []);
  const updateSettings = useCallback((s: Partial<AppSettings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...s } })), []);
  const addAttempt = useCallback((a: Attempt) => setData((d) => ({ ...d, attempts: [...d.attempts, a] })), []);
  const upsertSession = useCallback(
    (s: TrainingSession) =>
      setData((d) => {
        const exists = d.sessions.some((x) => x.id === s.id);
        return { ...d, sessions: exists ? d.sessions.map((x) => (x.id === s.id ? s : x)) : [...d.sessions, s] };
      }),
    [],
  );
  const setReviews = useCallback((reviews: ReviewItem[]) => setData((d) => ({ ...d, reviews })), []);
  const addDiagnostic = useCallback((dg: DiagnosticResult) => setData((d) => ({ ...d, diagnostics: [...d.diagnostics, dg] })), []);
  const addExternalRatings = useCallback(
    (r: ExternalRating[]) =>
      setData((d) => {
        // avoid duplicate API snapshots (same platform/time control/value on the same day)
        const key = (x: ExternalRating) => `${x.platform}|${x.timeControl}|${x.rating}|${x.recordedAt.slice(0, 10)}|${x.source}`;
        const seen = new Set(d.externalRatings.map(key));
        return { ...d, externalRatings: [...d.externalRatings, ...r.filter((x) => !seen.has(key(x)))] };
      }),
    [],
  );
  const removeExternalRating = useCallback((id: string) => setData((d) => ({ ...d, externalRatings: d.externalRatings.filter((r) => r.id !== id) })), []);
  const upsertGame = useCallback(
    (g: StoredGame) => setData((d) => ({ ...d, games: d.games.some((x) => x.id === g.id) ? d.games.map((x) => (x.id === g.id ? g : x)) : [...d.games, g] })),
    [],
  );
  const removeGame = useCallback((id: string) => setData((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) })), []);
  const addCustomExercises = useCallback(
    (e: Exercise[]) =>
      setData((d) => {
        const ids = new Set(d.customExercises.map((x) => x.id));
        return { ...d, customExercises: [...d.customExercises, ...e.filter((x) => !ids.has(x.id))] };
      }),
    [],
  );
  const upsertConversation = useCallback(
    (c: CoachConversation) =>
      setData((d) => ({
        ...d,
        coachConversations: d.coachConversations.some((x) => x.id === c.id) ? d.coachConversations.map((x) => (x.id === c.id ? c : x)) : [...d.coachConversations, c],
      })),
    [],
  );
  const exportData = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importData = useCallback((json: string) => {
    const parsed = JSON.parse(json) as AppData;
    if (parsed?.version !== 1) throw new Error('Format de còpia de seguretat no reconegut');
    setData(migrate(parsed));
  }, []);
  const resetAll = useCallback(async () => {
    await repoRef.current.clear();
    setData({ ...EMPTY_DATA, settings: data.settings });
  }, [data.settings]);

  // Keep the exercise registry in sync before children render.
  registerCustomExercises(data.customExercises);

  const locale = data.profile?.locale ?? 'ca';
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      loading,
      saveError,
      repositoryKind: repoRef.current.kind,
      signOut,
      setProfile,
      updateSettings,
      addAttempt,
      upsertSession,
      setReviews,
      addDiagnostic,
      addExternalRatings,
      removeExternalRating,
      upsertGame,
      removeGame,
      addCustomExercises,
      upsertConversation,
      exportData,
      importData,
      resetAll,
      t,
    }),
    [data, loading, saveError, signOut, setProfile, updateSettings, addAttempt, upsertSession, setReviews, addDiagnostic, addExternalRatings, removeExternalRating, upsertGame, removeGame, addCustomExercises, upsertConversation, exportData, importData, resetAll, t],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
