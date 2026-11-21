// Editor isomètric senzill: ranures predefinides, colors i model. Només amb objectes de l'inventari.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { HouseCfg } from '@/lib/types';
import { ACCENT_COLORS, HouseView, SLOTS, WALL_COLORS } from '@/components/House';
import { useStudent } from '@/components/Shells';
import { Spinner } from '@/components/ui';
import type { Catalog } from './shopTypes';

export default function MyHousePage() {
  const { dash, reload } = useStudent();
  const toast = useToast();
  const cat = useRpc<Catalog>('shop_catalog');
  const [draft, setDraft] = useState<HouseCfg>(dash.house);
  const [slot, setSlot] = useState('model');
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(dash.house), [dash.house]);

  const owned = useMemo(() => (cat.data?.items ?? []).filter((i) => i.owned), [cat.data]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(dash.house);
  const slotItems = owned.filter((i) => i.slot === slot);

  function setSlotItem(key: string | null) {
    if (slot === 'model') return setDraft((d) => ({ ...d, model: key ?? 'cub' }));
    setDraft((d) => {
      const s = { ...d.slots };
      if (key) s[slot] = key; else delete s[slot];
      return { ...d, slots: s };
    });
  }
  async function save() {
    setBusy(true);
    try {
      await rpc('save_house', { p_model: draft.model, p_wall_color: draft.wall_color, p_accent_color: draft.accent_color, p_slots: draft.slots });
      toast({ kind: 'ok', text: '🏠 Casa desada! Tothom la pot veure a la ciutat.' });
      reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  const current = slot === 'model' ? draft.model : draft.slots[slot];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#24307a] via-[#151c45] to-[#0c1230]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,.18),transparent_60%)]" />
        <div className="relative flex items-center justify-between p-4">
          <h1 className="font-display text-2xl font-bold">La meva casa</h1>
          <div className="flex gap-2">
            {dirty && <button className="btn-ghost" onClick={() => setDraft(dash.house)}>Desfés</button>}
            <button className="btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Desant…' : '💾 Desa'}</button>
          </div>
        </div>
        <HouseView cfg={draft} className="relative mx-auto w-full max-w-xl drop-shadow-[0_30px_40px_rgba(0,0,0,.45)]" />
      </div>

      <div className="glass p-4">
        <div className="grid grid-cols-5 gap-1.5">
          {SLOTS.map((s) => {
            const has = s.key === 'model' ? draft.model !== 'cub' : !!draft.slots[s.key];
            return (
              <button key={s.key} onClick={() => setSlot(s.key)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition ${slot === s.key ? 'bg-cian text-night-900' : 'bg-white/5 text-ice/70 hover:bg-white/10'}`}>
                <span className="text-xl">{s.icon}</span>{s.label}
                {has && slot !== s.key && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mint" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {cat.loading && !cat.data ? <Spinner /> : (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSlotItem(null)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold ${!current || current === 'cub' ? 'bg-cian/20 ring-2 ring-cian' : 'bg-white/5 hover:bg-white/10'}`}>
                <span className="text-3xl">{slot === 'model' ? '🧊' : '∅'}</span>{slot === 'model' ? 'Cub' : 'Res'}
              </button>
              {slotItems.map((i) => (
                <button key={i.key} onClick={() => setSlotItem(i.key)} title={i.description}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl p-1 text-xs font-semibold ${current === i.key ? 'bg-cian/20 ring-2 ring-cian' : 'bg-white/5 hover:bg-white/10'}`}>
                  <HouseView tight className="h-16 w-full" cfg={slot === 'model' ? { ...draft, model: i.key, slots: {} } : { model: 'cub', wall_color: '#E8F1FF', accent_color: draft.accent_color, slots: { [i.slot]: i.key } }} />
                  <span className="line-clamp-1">{i.name}</span>
                </button>
              ))}
              <Link to="/ciutat/botiga" className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-white/20 text-xs font-semibold text-ice/60 hover:bg-white/5">
                <span className="text-3xl">🛍️</span>Més a la botiga
              </Link>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="label">Color de les parets</p>
            <div className="flex flex-wrap gap-2">
              {WALL_COLORS.map((c) => <button key={c} onClick={() => setDraft((d) => ({ ...d, wall_color: c }))} aria-label={`Color ${c}`} className={`h-9 w-9 rounded-lg ring-offset-2 ring-offset-night-800 ${draft.wall_color === c ? 'ring-2 ring-cian' : 'ring-1 ring-white/20'}`} style={{ background: c }} />)}
            </div>
          </div>
          <div>
            <p className="label">Color de detalls i finestres</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((c) => <button key={c} onClick={() => setDraft((d) => ({ ...d, accent_color: c }))} aria-label={`Color ${c}`} className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-night-800 ${draft.accent_color === c ? 'ring-2 ring-white' : ''}`} style={{ background: c, boxShadow: `0 0 12px ${c}88` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
