import { useParams } from 'react-router-dom';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate } from '@/lib/format';
import { LINES } from '@/lib/types';
import { SLOTS } from '@/components/House';
import { ColorDot, CrudSection, YesNo, type FieldDef } from '@/components/Crud';
import { PageHeader } from '@/components/ui';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LINE_OPTS = (Object.keys(LINES) as (keyof typeof LINES)[]).map((k) => ({ value: k, label: LINES[k].name }));

function useOptions(table: string, label = 'name') {
  const { data } = useRpc<Row[]>('admin_list', { p_table: table }, [table]);
  return (data ?? []).map((r) => ({ value: String(r.id), label: `${r.icon ?? ''} ${r[label]}`.trim() }));
}

export default function AdminConfig() {
  const { section } = useParams();
  switch (section) {
    case 'cursos': return <Years />;
    case 'punts': return <Points />;
    case 'competencies': return <Competencies />;
    case 'missions': return <Missions />;
    case 'insignies': return <Badges />;
    case 'botiga': return <Shop />;
    default: return null;
  }
}

function Years() {
  const toast = useToast();
  return (
    <div className="space-y-5">
      <PageHeader title="Cursos acadèmics i barris" icon="📅" subtitle="El curs actual determina quins grups estan actius al Mode Classe." />
      <CrudSection<Row> table="academic_years" title="Cursos"
        fields={[{ key: 'name', label: 'Nom (2026-2027)', required: true }, { key: 'start_date', label: 'Inici', type: 'date', required: true }, { key: 'end_date', label: 'Final', type: 'date', required: true }, { key: 'is_current', label: 'Curs actual', type: 'bool' }]}
        columns={[{ label: 'Curs', render: (r) => <strong>{r.name}</strong> }, { label: 'Dates', render: (r) => `${fmtDate(r.start_date, true)} – ${fmtDate(r.end_date, true)}` }, { label: 'Actual', render: (r) => <YesNo v={r.is_current} /> }]}
        extraActions={(r) => (
          <button className="rounded-lg px-2 py-1 text-sm text-violet-soft hover:bg-white/10" onClick={async () => {
            try { const n = await rpc<number>('admin_create_standard_groups', { p_year_id: r.id }); toast({ kind: 'ok', text: `${n} grups creats (R1–R7, V1–V8, M1–M2)` }); }
            catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
          }}>+ Grups estàndard</button>
        )} />
      <CrudSection<Row> table="districts" title="Barris de ClauTIC City" description="Quan tots els barris són plens, se’n crea un de nou automàticament."
        fields={[{ key: 'name', label: 'Nom', required: true }, { key: 'color', label: 'Color LED', type: 'color' }, { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'capacity', label: 'Parcel·les', type: 'number' }]}
        defaults={{ color: '#22D3EE', capacity: 24 }}
        columns={[{ label: 'Barri', render: (r) => <span className="flex items-center gap-2"><ColorDot c={r.color} /> {r.name}</span> }, { label: 'Parcel·les', render: (r) => r.capacity }]} />
    </div>
  );
}

function Points() {
  const comps = useOptions('competencies');
  return (
    <div className="space-y-5">
      <PageHeader title="Punts i accions ràpides" icon="⚡" subtitle="Tots els valors són configurables. Els canvis s’apliquen als nous reconeixements." />
      <CrudSection<Row> table="point_rules" title="Regles generals" pk="key" canDelete={false}
        fields={[{ key: 'key', label: 'Clau interna', required: true }, { key: 'label', label: 'Nom', required: true }, { key: 'xp', label: 'XP', type: 'number' }, { key: 'coins', label: 'ClauCoins', type: 'number' }, { key: 'description', label: 'Descripció', type: 'textarea' }, { key: 'sort', label: 'Ordre', type: 'number' }]}
        columns={[{ label: 'Regla', render: (r) => <strong>{r.label}</strong> }, { label: 'XP', render: (r) => <span className="font-display font-bold text-cian">{r.xp}</span> }, { label: 'Coins', render: (r) => <span className="text-amber-300">{r.coins}</span> }, { label: 'Descripció', render: (r) => <span className="text-ice/60">{r.description}</span>, className: 'hidden md:table-cell' }]} />
      <CrudSection<Row> table="quick_actions" title="Accions ràpides del Mode Classe"
        fields={[{ key: 'label', label: 'Text del botó', required: true }, { key: 'icon', label: 'Icona', type: 'emoji' }, { key: 'competency_id', label: 'Competència', type: 'select', options: comps }, { key: 'xp', label: 'XP', type: 'number' }, { key: 'coins', label: 'ClauCoins', type: 'number' }, { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Activa', type: 'bool' }]}
        defaults={{ icon: '⚡', xp: 10, coins: 5, active: true }}
        columns={[{ label: 'Acció', render: (r) => <span>{r.icon} {r.label}</span> }, { label: 'Competència', render: (r) => comps.find((c) => c.value === r.competency_id)?.label ?? '—' }, { label: 'XP', render: (r) => r.xp }, { label: 'Activa', render: (r) => <YesNo v={r.active} /> }]} />
      <CrudSection<Row> table="settings" title="Paràmetres" pk="key" canDelete={false}
        fields={[{ key: 'key', label: 'Clau', required: true }, { key: 'value', label: 'Valor (JSON)', hint: 'dedupe_seconds: segons de la finestra antiduplicats · undo_minutes: minuts per desfer' }]}
        columns={[{ label: 'Paràmetre', render: (r) => <code>{r.key}</code> }, { label: 'Valor', render: (r) => JSON.stringify(r.value) }]} />
    </div>
  );
}

const COMP_FIELDS: FieldDef[] = [
  { key: 'key', label: 'Clau interna', required: true }, { key: 'name', label: 'Nom', required: true },
  { key: 'icon', label: 'Icona', type: 'emoji' }, { key: 'color', label: 'Color', type: 'color' },
  { key: 'xp', label: 'XP per reconeixement', type: 'number' }, { key: 'coins', label: 'ClauCoins', type: 'number' },
  { key: 'description', label: 'Descripció', type: 'textarea' },
  { key: 'examples', label: 'Exemples de comportaments observables', type: 'tags' },
  { key: 'family_explanation', label: 'Explicació pedagògica per a les famílies', type: 'textarea' },
  { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Activa', type: 'bool' },
];
function Competencies() {
  return (
    <div className="space-y-5">
      <PageHeader title="Competències educatives" icon="🧭" subtitle="Apareixen al Mode Classe, als informes familiars i a les estadístiques." />
      <CrudSection<Row> table="competencies" title="Competències" fields={COMP_FIELDS} defaults={{ icon: '⭐', color: '#22D3EE', xp: 10, coins: 5, active: true, examples: [] }}
        columns={[
          { label: 'Competència', render: (r) => <span className="flex items-center gap-2"><span className="text-xl">{r.icon}</span><span><strong style={{ color: r.color }}>{r.name}</strong><span className="block text-xs text-ice/50">{r.description}</span></span></span> },
          { label: 'Exemples', render: (r) => <span className="text-xs text-ice/60">{(r.examples ?? []).length} exemples</span>, className: 'hidden md:table-cell' },
          { label: 'XP / Coins', render: (r) => `${r.xp} / ${r.coins}` }, { label: 'Activa', render: (r) => <YesNo v={r.active} /> },
        ]} />
    </div>
  );
}

function Missions() {
  const badges = useOptions('badges');
  return (
    <div className="space-y-5">
      <PageHeader title="Missions i reptes" icon="🎯" subtitle="Individuals (per línia educativa) i comunitàries (fites col·lectives que desbloquegen elements de la plaça)." />
      <CrudSection<Row> table="missions" title="Missions"
        fields={[
          { key: 'title', label: 'Títol', required: true }, { key: 'icon', label: 'Icona', type: 'emoji' },
          { key: 'kind', label: 'Tipus', type: 'select', options: [{ value: 'individual', label: 'Individual' }, { value: 'comunitaria', label: 'Comunitària' }], required: true },
          { key: 'line', label: 'Línia (buit = general)', type: 'select', options: LINE_OPTS },
          { key: 'description', label: 'Descripció', type: 'textarea' },
          { key: 'xp', label: 'XP', type: 'number' }, { key: 'coins', label: 'ClauCoins', type: 'number' },
          { key: 'badge_id', label: 'Insígnia que atorga', type: 'select', options: badges },
          { key: 'repeatable', label: 'Repetible', type: 'bool' },
          { key: 'goal', label: 'Objectiu col·lectiu (comunitàries)', type: 'number', hint: 'Nombre total de missions completades per tota la ciutat' },
          { key: 'unlock_key', label: 'Element de plaça que desbloqueja', type: 'select', options: [{ value: 'font_holografica', label: 'Font Hologràfica' }, { value: 'arbre_cristall', label: 'Arbre de Cristall' }, { value: 'satellit', label: 'Satèl·lit ClauTIC' }] },
          { key: 'unlock_name', label: 'Nom de l’element desbloquejat' },
          { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Activa', type: 'bool' },
        ]}
        defaults={{ kind: 'individual', icon: '🎯', xp: 15, coins: 10, goal: 1, active: true }}
        columns={[
          { label: 'Missió', render: (r) => <span>{r.icon} <strong>{r.title}</strong><span className="block text-xs text-ice/50">{r.description}</span></span> },
          { label: 'Tipus', render: (r) => r.kind === 'comunitaria' ? <span className="chip bg-violet/20 text-violet-soft">Comunitària · {r.goal}</span> : <span className="chip bg-white/10">{r.line ? LINES[r.line as keyof typeof LINES].name : 'General'}</span> },
          { label: 'Recompensa', render: (r) => `${r.xp} XP · ${r.coins} 🪙` }, { label: 'Activa', render: (r) => <YesNo v={r.active} /> },
        ]} />
    </div>
  );
}

function Badges() {
  return (
    <div className="space-y-5">
      <PageHeader title="Insígnies" icon="🏅" subtitle="Permanents. Les automàtiques s’atorguen soles segons la regla; les altres, manualment o en activitats i missions." />
      <CrudSection<Row> table="badges" title="Insígnies"
        fields={[
          { key: 'key', label: 'Clau interna', required: true }, { key: 'name', label: 'Nom', required: true },
          { key: 'icon', label: 'Icona', type: 'emoji' }, { key: 'color', label: 'Color', type: 'color' },
          { key: 'category', label: 'Categoria', type: 'select', options: ['antiguitat', 'fita', 'missio', 'activitat', 'especial'].map((v) => ({ value: v, label: v })) },
          { key: 'description', label: 'Descripció', type: 'textarea' },
          { key: 'rule_type', label: 'Regla automàtica', type: 'select', options: [{ value: 'anys', label: 'Anys a ClauTIC' }, { value: 'nivell', label: 'Nivell' }, { value: 'missions', label: 'Missions completades' }, { value: 'activitats', label: 'Activitats' }, { value: 'reconeixements', label: 'Reconeixements' }] },
          { key: 'rule_value', label: 'Valor de la regla', type: 'number' },
          { key: 'xp', label: 'XP', type: 'number', hint: 'Recomanat 0 per a l’antiguitat (equilibri)' }, { key: 'coins', label: 'ClauCoins', type: 'number' },
          { key: 'unlock_item_key', label: 'Objecte exclusiu que desbloqueja (clau)' },
          { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Activa', type: 'bool' },
        ]}
        defaults={{ icon: '🏅', color: '#8B5CF6', category: 'especial', xp: 0, coins: 10, active: true }}
        columns={[
          { label: 'Insígnia', render: (r) => <span className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ background: `${r.color}30`, boxShadow: `inset 0 0 0 2px ${r.color}` }}>{r.icon}</span><span><strong>{r.name}</strong><span className="block text-xs text-ice/50">{r.description}</span></span></span> },
          { label: 'Categoria', render: (r) => r.category },
          { label: 'Regla', render: (r) => r.rule_type ? `${r.rule_type} ≥ ${r.rule_value}` : 'Manual' },
          { label: 'Recompensa', render: (r) => `${r.xp} XP · ${r.coins} 🪙${r.unlock_item_key ? ' · ★' : ''}` },
        ]} />
    </div>
  );
}

function Shop() {
  return (
    <div className="space-y-5">
      <PageHeader title="Botiga de decoracions" icon="🛍️" subtitle="Només moneda virtual (ClauCoins). Els objectes exclusius es desbloquegen amb insígnies." />
      <CrudSection<Row> table="shop_items" title="Catàleg"
        fields={[
          { key: 'key', label: 'Clau (gràfic)', required: true, hint: 'Ha de coincidir amb un gràfic existent (p. ex. solar_basic, robot_gos…)' },
          { key: 'name', label: 'Nom', required: true },
          { key: 'slot', label: 'Ranura', type: 'select', options: SLOTS.map((s) => ({ value: s.key, label: `${s.icon} ${s.label}` })), required: true },
          { key: 'description', label: 'Descripció', type: 'textarea' },
          { key: 'price', label: 'Preu (ClauCoins)', type: 'number' }, { key: 'min_level', label: 'Nivell mínim', type: 'number' },
          { key: 'exclusive', label: 'Exclusiu (no es pot comprar)', type: 'bool' },
          { key: 'color', label: 'Color', type: 'color' }, { key: 'sort', label: 'Ordre', type: 'number' }, { key: 'active', label: 'Actiu', type: 'bool' },
        ]}
        defaults={{ price: 50, min_level: 1, active: true, color: '#22D3EE' }}
        columns={[
          { label: 'Objecte', render: (r) => <span><strong>{r.name}</strong><span className="block text-xs text-ice/50"><code>{r.key}</code></span></span> },
          { label: 'Ranura', render: (r) => SLOTS.find((s) => s.key === r.slot)?.label ?? r.slot },
          { label: 'Preu', render: (r) => r.exclusive ? <span className="chip bg-amber-400/20 text-amber-300">★ Exclusiu</span> : <span className="text-amber-300">{r.price} 🪙</span> },
          { label: 'Nivell', render: (r) => r.min_level }, { label: 'Actiu', render: (r) => <YesNo v={r.active} /> },
        ]} />
    </div>
  );
}
