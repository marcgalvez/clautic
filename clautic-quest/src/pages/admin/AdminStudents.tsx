import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { LINES, type AvatarCfg, type Line } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner, Toggle } from '@/components/ui';

export interface AStudent {
  id: string; first_name: string; last_name: string; birth_year: number | null; start_year: number; active: boolean;
  consent_family: boolean; consent_images: boolean; notes: string; avatar: AvatarCfg; has_account: boolean; username: string | null;
  invite_code: string | null; group_ids: string[]; groups: string[]; families: string[]; xp: number; coins: number; level: number; years: number;
}
export interface AGroup { id: string; code: string; name: string; line: Line; active: boolean; is_current: boolean; year: string; student_ids: string[]; teachers: { id: string; name: string }[]; weekday: number | null; schedule: string; academic_year_id: string }

const HEADERS: Record<string, string[]> = {
  first_name: ['nom', 'first_name', 'name'], last_name: ['cognoms', 'cognom', 'last_name', 'surname'],
  birth_year: ['any_naixement', 'naixement', 'birth_year', 'any naixement'], start_year: ['any_inici', 'inici', 'start_year', 'any inici', 'any d\'inici'],
  groups: ['grups', 'grup', 'groups'], history: ['historial', 'history', 'trajectoria', 'trajectòria'], xp_previ: ['xp_previ', 'xp', 'xp previ'],
};

export default function AdminStudents() {
  const toast = useToast();
  const { data, error, loading, reload } = useRpc<AStudent[]>('admin_students');
  const groupsQ = useRpc<AGroup[]>('admin_groups');
  const groups = useMemo(() => (groupsQ.data ?? []).filter((g) => g.is_current), [groupsQ.data]);
  const [q, setQ] = useState('');
  const [gf, setGf] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<Partial<AStudent> | null>(null);
  const [correct, setCorrect] = useState<AStudent | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const list = useMemo(() => (data ?? []).filter((s) =>
    (showInactive || s.active) && (!gf || s.group_ids.includes(gf)) &&
    (!q || `${s.first_name} ${s.last_name} ${s.username ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, q, gf, showInactive]);

  async function save() {
    if (!edit) return;
    try {
      await rpc('admin_save_student', { p: edit });
      toast({ kind: 'ok', text: 'Alumne desat' }); setEdit(null); reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }
  async function del(s: AStudent) {
    if (!confirm(`Esborrar definitivament ${s.first_name} ${s.last_name} i tot el seu historial? Si només marxa, és millor donar-lo de baixa.`)) return;
    try { await rpc('admin_delete_student', { p_id: s.id }); toast({ kind: 'ok', text: 'Esborrat' }); setEdit(null); reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Alumnes" icon="🧑‍🎓" subtitle={`${(data ?? []).filter((s) => s.active).length} actius · un alumne pot ser a diversos grups`}
        actions={<>
          <button className="btn-ghost" onClick={() => setImportOpen(true)}>⬆️ Importa CSV / Excel</button>
          <button className="btn-primary" onClick={() => setEdit({ first_name: '', last_name: '', start_year: new Date().getFullYear(), active: true, group_ids: [] })}>+ Nou alumne</button>
        </>} />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input max-w-xs" placeholder="Cerca per nom o usuari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={gf} onChange={(e) => setGf(e.target.value)}>
            <option value="">Tots els grups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
          </select>
          <Toggle checked={showInactive} onChange={setShowInactive} label="Mostra baixes" />
          <span className="ml-auto text-sm text-ice/50">{list.length} resultats</span>
        </div>
        {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead><tr><th>Alumne</th><th>Grups</th><th className="hidden md:table-cell">Anys</th><th>Nivell</th><th className="hidden lg:table-cell">XP / Coins</th><th className="hidden md:table-cell">Compte</th><th /></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                    <td>
                      <Link to={`/admin/alumne/${s.id}`} className="flex items-center gap-2 hover:text-cian">
                        <Avatar cfg={s.avatar} seed={s.id} size={32} />
                        <span><span className="font-medium">{s.first_name} {s.last_name}</span>{!s.active && <span className="chip ml-2 bg-white/10">Baixa</span>}
                          <span className="block text-xs text-ice/40">{s.families.length ? `👨‍👩‍👧 ${s.families.join(', ')}` : 'Sense família vinculada'}</span></span>
                      </Link>
                    </td>
                    <td><div className="flex flex-wrap gap-1">{s.groups.map((g) => <span key={g} className="chip bg-white/10">{g}</span>)}</div></td>
                    <td className="hidden md:table-cell">{s.years}</td>
                    <td>{s.level}</td>
                    <td className="hidden tabular-nums lg:table-cell">{s.xp} / {s.coins}</td>
                    <td className="hidden text-xs md:table-cell">{s.has_account ? <span className="text-mint">✓ {s.username?.split('@')[0]}</span> : <code className="text-cian">{s.invite_code}</code>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="rounded-lg px-2 py-1 text-sm text-amber-300 hover:bg-white/10" onClick={() => setCorrect(s)} title="Correcció de punts">±</button>
                      <button className="rounded-lg px-2 py-1 text-sm text-cian hover:bg-white/10" onClick={() => setEdit({ ...s })}>Edita</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edita l’alumne' : 'Nou alumne'} wide
        footer={<>
          {edit?.id && <button className="btn-danger mr-auto" onClick={() => del(edit as AStudent)}>Esborra</button>}
          <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel·la</button>
          <button className="btn-primary" onClick={save}>Desa</button>
        </>}>
        {edit && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nom"><input className="input" value={edit.first_name ?? ''} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} /></Field>
            <Field label="Cognoms"><input className="input" value={edit.last_name ?? ''} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} /></Field>
            <Field label="Any de naixement"><input className="input" type="number" value={edit.birth_year ?? ''} onChange={(e) => setEdit({ ...edit, birth_year: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Any d’inici a ClauTIC" hint="Determina les insígnies d’antiguitat"><input className="input" type="number" value={edit.start_year ?? ''} onChange={(e) => setEdit({ ...edit, start_year: Number(e.target.value) })} /></Field>
            <div className="md:col-span-2">
              <span className="label">Grups (curs actual)</span>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const on = edit.group_ids?.includes(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => setEdit({ ...edit, group_ids: on ? edit.group_ids!.filter((x) => x !== g.id) : [...(edit.group_ids ?? []), g.id] })}
                      className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${on ? 'text-white' : 'bg-white/5 text-ice/60'}`} style={on ? { background: LINES[g.line].color } : undefined}>{g.code}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 md:col-span-2">
              <Toggle checked={!!edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Actiu (desactiva per donar de baixa)" />
              <Toggle checked={!!edit.consent_family} onChange={(v) => setEdit({ ...edit, consent_family: v })} label="Autorització familiar signada" />
              <Toggle checked={!!edit.consent_images} onChange={(v) => setEdit({ ...edit, consent_images: v })} label="Autorització d’imatges" />
            </div>
            <div className="md:col-span-2"><Field label="Notes internes (no visibles per a l’alumne ni la família)"><textarea className="input" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field></div>
            {edit.id && !edit.has_account && (
              <div className="rounded-xl bg-cian/10 p-3 text-sm ring-1 ring-cian/30 md:col-span-2">
                Codi d’activació: <code className="font-display text-lg text-cian">{edit.invite_code}</code>
                <button className="btn-ghost ml-3 py-1 text-xs" onClick={async () => { const r = await rpc<{ code: string }>('admin_regenerate_invite', { p_student_id: edit.id }); setEdit({ ...edit, invite_code: r.code }); reload(true); }}>Genera’n un de nou</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {correct && <CorrectionModal s={correct} onClose={() => setCorrect(null)} onDone={() => { setCorrect(null); reload(true); }} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => reload(true)} />}
    </div>
  );
}

function CorrectionModal({ s, onClose, onDone }: { s: AStudent; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={`Correcció de punts · ${s.first_name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel·la</button><button className="btn-primary" disabled={!note.trim() || (!xp && !coins)} onClick={async () => {
        try { await rpc('admin_correct', { p_student_id: s.id, p_xp: xp, p_coins: coins, p_note: note }); toast({ kind: 'ok', text: 'Correcció registrada' }); onDone(); }
        catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
      }}>Aplica</button></>}>
      <p className="mb-3 text-sm text-ice/60">Saldo actual: {s.xp} XP · {s.coins} ClauCoins. Pots posar valors negatius. Queda registrat a l’historial i a l’auditoria.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="XP"><input className="input" type="number" value={xp} onChange={(e) => setXp(Number(e.target.value))} /></Field>
        <Field label="ClauCoins"><input className="input" type="number" value={coins} onChange={(e) => setCoins(Number(e.target.value))} /></Field>
        <div className="col-span-2"><Field label="Motiu (obligatori)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[]; codes: { name: string; code: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const mapped = raw.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const nk = k.trim().toLowerCase();
        const target = Object.entries(HEADERS).find(([, alts]) => alts.includes(nk))?.[0];
        if (target) out[target] = String(v).trim();
      }
      return out;
    }).filter((r) => r.first_name);
    setRows(mapped); setResult(null);
    if (!mapped.length) toast({ kind: 'error', text: 'No s’ha trobat cap fila amb la columna «nom».' });
  }
  function template() {
    const csv = 'nom,cognoms,any_naixement,any_inici,grups,historial,xp_previ\nAina,Serra Puig,2015,2022,"R2, V1","2022-23: R1 | 2023-24: R2",150\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'plantilla_alumnes_clautic.csv'; a.click();
  }
  async function run() {
    setBusy(true);
    try { const r = await rpc<typeof result>('admin_import_students', { p_rows: rows }); setResult(r); onDone(); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Importació massiva d’alumnes" wide
      footer={result ? <button className="btn-primary" onClick={onClose}>Fet</button> : <><button className="btn-ghost" onClick={onClose}>Cancel·la</button><button className="btn-primary" disabled={!rows.length || busy} onClick={run}>{busy ? 'Important…' : `Importa ${rows.length} alumnes`}</button></>}>
      {!result ? (
        <div className="space-y-4">
          <p className="text-sm text-ice/70">Puja un fitxer <strong>CSV o Excel</strong> amb les columnes: <code>nom</code>, <code>cognoms</code>, <code>any_naixement</code>, <code>any_inici</code>, <code>grups</code> (p. ex. «R1, V2»), <code>historial</code> (opcional, separat per «|») i <code>xp_previ</code> (opcional). Cada alumne rep un codi d’activació i una casa a ClauTIC City.</p>
          <div className="flex flex-wrap gap-2">
            <label className="btn-cian cursor-pointer">📄 Tria el fitxer<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
            <button className="btn-ghost" onClick={template}>Descarrega la plantilla</button>
          </div>
          {rows.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-xl ring-1 ring-white/10">
              <table className="table-clean">
                <thead><tr><th>Nom</th><th>Cognoms</th><th>Naix.</th><th>Inici</th><th>Grups</th><th>Historial</th></tr></thead>
                <tbody>{rows.slice(0, 100).map((r, i) => <tr key={i}><td>{r.first_name}</td><td>{r.last_name}</td><td>{r.birth_year}</td><td>{r.start_year}</td><td>{r.groups}</td><td className="text-xs text-ice/60">{r.history}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg">✅ <strong>{result.created}</strong> alumnes creats.</p>
          {result.errors.length > 0 && (
            <div className="rounded-xl bg-brand/10 p-3 text-sm ring-1 ring-brand/30">
              <p className="font-semibold">Files amb errors (no importades):</p>
              <ul className="mt-1 list-inside list-disc">{result.errors.map((e) => <li key={e.row}>Fila {e.row}: {e.error}</li>)}</ul>
            </div>
          )}
          <p className="text-sm text-ice/60">Codis d’activació (també els trobaràs a «Invitacions», preparats per imprimir):</p>
          <div className="grid max-h-60 gap-1 overflow-auto text-sm sm:grid-cols-2">{result.codes.map((c) => <div key={c.code} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5"><span>{c.name}</span><code className="text-cian">{c.code}</code></div>)}</div>
        </div>
      )}
    </Modal>
  );
}
