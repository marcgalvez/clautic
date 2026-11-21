// CRUD genèric per a les taules de configuració (via admin_list / admin_save / admin_delete)
import { useState, type ReactNode } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Card, ErrorBox, Field, Modal, Spinner, Toggle } from './ui';

export type FieldDef = {
  key: string; label: string;
  type?: 'text' | 'number' | 'textarea' | 'bool' | 'color' | 'select' | 'tags' | 'date' | 'emoji';
  options?: { value: string; label: string }[];
  hint?: string; required?: boolean; wide?: boolean;
};
export type ColDef<T> = { label: string; render: (row: T) => ReactNode; className?: string };

export function CrudSection<T extends Record<string, unknown>>({ table, title, fields, columns, defaults = {}, pk = 'id', canDelete = true, extraActions, description }: {
  table: string; title: string; fields: FieldDef[]; columns: ColDef<T>[]; defaults?: Record<string, unknown>; pk?: string; canDelete?: boolean;
  extraActions?: (row: T, reload: () => void) => ReactNode; description?: ReactNode;
}) {
  const toast = useToast();
  const { data, error, loading, reload } = useRpc<T[]>('admin_list', { p_table: table }, [table]);
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!edit) return;
    for (const f of fields) if (f.required && (edit[f.key] === undefined || edit[f.key] === '')) return toast({ kind: 'error', text: `Falta «${f.label}»` });
    setBusy(true);
    try {
      const row: Record<string, unknown> = {};
      for (const f of fields) if (f.key in edit) row[f.key] = f.type === 'number' ? (edit[f.key] === '' || edit[f.key] === null ? null : Number(edit[f.key])) : edit[f.key] === '' && f.type === 'select' ? null : edit[f.key];
      if (edit[pk]) row[pk] = edit[pk];
      await rpc('admin_save', { p_table: table, p_row: row });
      toast({ kind: 'ok', text: 'Desat' });
      setEdit(null); reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function remove(row: T) {
    if (!confirm('Segur que vols esborrar-ho? Aquesta acció no es pot desfer.')) return;
    try { await rpc('admin_delete', { p_table: table, p_id: String(row[pk]) }); toast({ kind: 'ok', text: 'Esborrat' }); reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  return (
    <Card title={title} action={<button className="btn-primary py-2" onClick={() => setEdit({ ...defaults })}>+ Nou</button>}>
      {description && <div className="mb-3 text-sm text-ice/60">{description}</div>}
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead><tr>{columns.map((c) => <th key={c.label} className={c.className}>{c.label}</th>)}<th className="w-1" /></tr></thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={String(row[pk])}>
                  {columns.map((c) => <td key={c.label} className={c.className}>{c.render(row)}</td>)}
                  <td className="whitespace-nowrap text-right">
                    {extraActions?.(row, () => reload(true))}
                    <button className="rounded-lg px-2 py-1 text-sm text-cian hover:bg-white/10" onClick={() => setEdit({ ...row })}>Edita</button>
                    {canDelete && <button className="rounded-lg px-2 py-1 text-sm text-brand-soft hover:bg-white/10" onClick={() => remove(row)}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.length && <p className="py-6 text-center text-sm text-ice/50">Encara no hi ha res.</p>}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.[pk] ? `Edita · ${title}` : `Nou · ${title}`} wide={fields.length > 6}
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel·la</button><button className="btn-primary" disabled={busy} onClick={save}>Desa</button></>}>
        {edit && (
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.wide || f.type === 'textarea' || f.type === 'tags' ? 'md:col-span-2' : ''}>
                <FieldInput f={f} value={edit[f.key]} onChange={(v) => setEdit((e) => ({ ...e!, [f.key]: v }))} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const t = f.type ?? 'text';
  if (t === 'bool') return <div className="pt-5"><Toggle checked={!!value} onChange={onChange} label={f.label} /></div>;
  return (
    <Field label={f.label} hint={f.hint}>
      {t === 'textarea' ? <textarea className="input min-h-[80px]" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        : t === 'select' ? (
          <select className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
        : t === 'tags' ? <textarea className="input" value={Array.isArray(value) ? value.join('\n') : ''} onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} placeholder="Un element per línia" />
        : t === 'color' ? (
          <div className="flex gap-2"><input type="color" className="h-10 w-14 rounded-lg bg-transparent" value={(value as string) || '#22D3EE'} onChange={(e) => onChange(e.target.value)} /><input className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} /></div>
        )
        : <input className="input" type={t === 'number' ? 'number' : t === 'date' ? 'date' : 'text'} value={(value as string | number) ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={t === 'emoji' ? 8 : undefined} />}
    </Field>
  );
}

export const ColorDot = ({ c }: { c: string }) => <span className="inline-block h-3.5 w-3.5 rounded-full align-middle" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />;
export const YesNo = ({ v }: { v: unknown }) => v ? <span className="chip bg-mint/15 text-mint">Sí</span> : <span className="chip bg-white/10 text-ice/50">No</span>;
