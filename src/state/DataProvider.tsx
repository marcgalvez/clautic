import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LocalRepository } from '@/lib/storage/localRepository';
import type { Repository } from '@/lib/storage/repository';
import { EMPTY_DATA, type AppData, type AppSettings, type Attempt, type ReviewItem, type TrainingSession, type UserProfile } from '@/lib/storage/types';
import { translate, type MessageKey } from '@/i18n';

interface DataContextValue {
  data: AppData;
  loading: boolean;
  saveError: string | null;
  repositoryKind: Repository['kind'];
  setProfile: (p: UserProfile) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  addAttempt: (a: Attempt) => void;
  upsertSession: (s: TrainingSession) => void;
  setReviews: (r: ReviewItem[]) => void;
  exportData: () => string;
  importData: (json: string) => void;
  resetAll: () => Promise<void>;
  t: (key: MessageKey) => string;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children, repository }: { children: ReactNode; repository?: Repository }) {
  const repoRef = useRef<Repository>(repository ?? new LocalRepository());
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    repoRef.current.load().then((d) => {
      loaded.current = true;
      setData(d);
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
  const exportData = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importData = useCallback((json: string) => {
    const parsed = JSON.parse(json) as AppData;
    if (parsed?.version !== 1) throw new Error('Format de còpia de seguretat no reconegut');
    setData({ ...EMPTY_DATA, ...parsed, settings: { ...EMPTY_DATA.settings, ...parsed.settings } });
  }, []);
  const resetAll = useCallback(async () => {
    await repoRef.current.clear();
    setData({ ...EMPTY_DATA, settings: data.settings });
  }, [data.settings]);

  const locale = data.profile?.locale ?? 'ca';
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      loading,
      saveError,
      repositoryKind: repoRef.current.kind,
      setProfile,
      updateSettings,
      addAttempt,
      upsertSession,
      setReviews,
      exportData,
      importData,
      resetAll,
      t,
    }),
    [data, loading, saveError, setProfile, updateSettings, addAttempt, upsertSession, setReviews, exportData, importData, resetAll, t],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
