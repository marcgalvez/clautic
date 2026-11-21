import { useEffect, useState } from 'react';
import { useSession } from './session';

const KEY = 'cq-last-group';
/** Grup actiu del professor: recorda l'últim i, si no n'hi ha, tria el grup que toca avui. */
export function useActiveGroup() {
  const { ctx } = useSession();
  const groups = ctx?.groups ?? [];
  const [groupId, setGroupId] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });
  useEffect(() => {
    if (!groups.length) return;
    if (groupId && groups.some((g) => g.id === groupId)) return;
    const wd = ((new Date().getDay() + 6) % 7) + 1;
    setGroupId((groups.find((g) => g.weekday === wd) ?? groups[0]).id);
  }, [groups, groupId]);
  const select = (id: string) => {
    setGroupId(id);
    try { localStorage.setItem(KEY, id); } catch { /* sense emmagatzematge */ }
  };
  return { groups, groupId, group: groups.find((g) => g.id === groupId) ?? null, select };
}
