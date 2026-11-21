import { useMemo, useState } from 'react';
import { useRpc } from '@/lib/api';
import { DEMO } from '@/lib/supabase';
import { ROLE_LABEL, type Role } from '@/lib/types';
import { Card, ErrorBox, PageHeader, Spinner, Tabs } from '@/components/ui';

interface I { code: string; role: Role; full_name: string; student_id: string | null; groups: string[] | null; created_at: string }

export default function AdminInvitations() {
  const { data, error, loading, reload } = useRpc<I[]>('admin_invitations');
  const [role, setRole] = useState<Role | 'tots'>('student');
  const list = useMemo(() => (data ?? []).filter((i) => role === 'tots' || i.role === role), [data, role]);
  const url = DEMO || import.meta.env.VITE_HASH_ROUTER === '1' ? `${window.location.origin}${window.location.pathname}#/activar` : `${window.location.origin}/activar`;
  return (
    <div className="space-y-5">
      <PageHeader title="Invitacions pendents" icon="🎟️" subtitle="Cada alumne, família o professor activa el seu compte amb un codi únic."
        actions={<button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimeix targetes</button>} />
      <div className="print:hidden"><Tabs value={role} onChange={setRole} items={[{ value: 'student', label: 'Alumnes' }, { value: 'family', label: 'Famílies' }, { value: 'teacher', label: 'Professors' }, { value: 'tots', label: 'Totes' }]} /></div>
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {list.map((i) => (
              <div key={i.code} className="break-inside-avoid rounded-xl border border-dashed border-cian/40 bg-night-950/40 p-4 print:border-black print:bg-white print:text-black">
                <div className="text-xs uppercase tracking-wider text-ice/50 print:text-black">ClauTIC Quest · {ROLE_LABEL[i.role]}</div>
                <div className="mt-1 font-semibold">{i.full_name}</div>
                {i.groups && <div className="text-xs text-ice/50 print:text-black">{i.groups.join(', ')}</div>}
                <div className="mt-2 font-display text-2xl font-bold tracking-widest text-cian print:text-black">{i.code}</div>
                <div className="mt-1 text-[11px] text-ice/50 print:text-black">Activa’l a {url}</div>
              </div>
            ))}
          </div>
          {!list.length && <p className="py-6 text-center text-sm text-ice/50">No hi ha invitacions pendents.</p>}
        </Card>
      )}
    </div>
  );
}
