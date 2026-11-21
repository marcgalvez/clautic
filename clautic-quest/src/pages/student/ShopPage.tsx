import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { HouseView, SLOTS } from '@/components/House';
import { useStudent } from '@/components/Shells';
import { Coin, ErrorBox, Modal, Spinner } from '@/components/ui';
import type { Catalog, ShopItem } from './shopTypes';

export default function ShopPage() {
  const { dash, reload } = useStudent();
  const toast = useToast();
  const { data, error, loading, reload: reloadCat } = useRpc<Catalog>('shop_catalog');
  const [slot, setSlot] = useState<string>('tot');
  const [pick, setPick] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (data?.items ?? []).filter((i) => slot === 'tot' || i.slot === slot), [data, slot]);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reloadCat()} />;

  async function buy(i: ShopItem, place: boolean) {
    setBusy(true);
    try {
      await rpc('buy_item', { p_item_id: i.id });
      if (place) {
        const h = dash.house;
        await rpc('save_house', {
          p_model: i.slot === 'model' ? i.key : h.model, p_wall_color: h.wall_color, p_accent_color: h.accent_color,
          p_slots: i.slot === 'model' ? h.slots : { ...h.slots, [i.slot]: i.key },
        });
      }
      toast({ kind: 'ok', text: `🎉 Ja tens ${i.name}!${place ? ' L’hem posat a la teva casa.' : ''}` });
      setPick(null);
      await Promise.all([reload(true), reloadCat(true)]);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  const preview = (i: ShopItem) => i.slot === 'model'
    ? { ...dash.house, model: i.key }
    : { ...dash.house, slots: { ...dash.house.slots, [i.slot]: i.key } };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">🛍️ Botiga</h1>
        <span className="flex items-center gap-1.5 rounded-xl bg-amber-400/10 px-3 py-1.5 font-display text-lg font-bold text-amber-300 ring-1 ring-amber-400/30"><Coin size={22} /> {data.coins}</span>
        <span className="text-sm text-ice/50">Guanya ClauCoins amb l’esforç, les missions i les activitats.</span>
      </div>
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
        {[{ key: 'tot', label: 'Tot', icon: '✨' }, ...SLOTS].map((s) => (
          <button key={s.key} onClick={() => setSlot(s.key)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${slot === s.key ? 'bg-cian text-night-900' : 'bg-white/5 text-ice/70 hover:bg-white/10'}`}>{s.icon} {s.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => {
          const locked = i.min_level > data.level;
          const afford = data.coins >= i.price;
          return (
            <button key={i.id} onClick={() => setPick(i)}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${i.owned ? 'border-mint/40 bg-mint/5' : 'border-white/10 bg-night-800/70 hover:border-cian/50'}`}>
              <div className="relative bg-gradient-to-b from-[#232e74] to-[#121a42] p-1">
                <HouseView tight className={`h-40 w-full ${locked || i.exclusive ? 'opacity-60 grayscale-[40%]' : ''}`}
                  cfg={i.slot === 'model' ? { model: i.key, wall_color: '#E8F1FF', accent_color: '#22D3EE', slots: {} } : { model: 'cub', wall_color: '#E8F1FF', accent_color: '#22D3EE', slots: { [i.slot]: i.key } }} />
                {i.owned && <span className="chip absolute left-2 top-2 bg-mint text-night-900">✓ Teu</span>}
                {i.exclusive && !i.owned && <span className="chip absolute left-2 top-2 bg-amber-400 text-night-900">★ Exclusiu</span>}
                {locked && !i.exclusive && !i.owned && <span className="chip absolute left-2 top-2 bg-night-950/80 text-ice">🔒 Nivell {i.min_level}</span>}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <span className="font-semibold leading-tight">{i.name}</span>
                <span className="mt-0.5 line-clamp-2 text-xs text-ice/50">{i.description}</span>
                <span className={`mt-2 flex items-center gap-1 font-display font-bold ${i.owned ? 'text-mint' : i.exclusive ? 'text-amber-300' : afford && !locked ? 'text-amber-300' : 'text-ice/40'}`}>
                  {i.owned ? 'A l’inventari' : i.exclusive ? 'Amb una insígnia' : <><Coin /> {i.price}</>}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Modal open={!!pick} onClose={() => setPick(null)} title={pick?.name ?? ''}>
        {pick && (() => {
          const locked = pick.min_level > data.level;
          const missing = pick.price - data.coins;
          return (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-b from-[#232e74] to-[#121a42] p-2">
                <HouseView cfg={preview(pick)} className="mx-auto w-full max-w-sm" />
                <p className="pb-1 text-center text-xs text-ice/50">Així quedaria a la teva casa</p>
              </div>
              <p className="text-sm text-ice/70">{pick.description}</p>
              {pick.owned ? <p className="text-mint">Ja el tens! Pots posar-lo des de «La meva casa».</p>
                : pick.exclusive ? <p className="text-amber-300">★ Objecte exclusiu: es desbloqueja automàticament quan aconsegueixes una insígnia especial.</p>
                : locked ? <p className="text-ice/70">🔒 Necessites el <strong>nivell {pick.min_level}</strong>. Ara ets nivell {data.level}.</p>
                : missing > 0 ? <p className="text-ice/70">Et falten <strong className="text-amber-300">{missing} ClauCoins</strong>. Continua així!</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary flex-1 py-3" disabled={busy} onClick={() => buy(pick, true)}>Compra i posa-ho <Coin /> {pick.price}</button>
                    <button className="btn-ghost" disabled={busy} onClick={() => buy(pick, false)}>Només comprar</button>
                  </div>
                )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
