import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useData } from '@/state/DataProvider';
import { LOCALES } from '@/i18n';
import { SESSION_MINUTES, type AppSettings, type Locale, type SessionMinutes } from '@/lib/storage/types';

export function SettingsPage() {
  const { data, setProfile, updateSettings, exportData, importData, resetAll, repositoryKind, t } = useData();
  const profile = data.profile!;
  const [name, setName] = useState(profile.displayName);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chesslab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      importData(await file.text());
      setMsg('Dades importades correctament.');
    } catch (e) {
      setMsg(`No s'ha pogut importar: ${(e as Error).message}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.settings')}</h1>
      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom</Label>
            <div className="flex gap-2">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="secondary" disabled={!name.trim() || name === profile.displayName} onClick={() => setProfile({ ...profile, displayName: name.trim() })}>{t('common.save')}</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Durada per defecte de la sessió</p>
            <Segmented label="Durada" value={profile.sessionMinutes} onChange={(m: SessionMinutes) => setProfile({ ...profile, sessionMinutes: m })} options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Idioma</p>
            <Segmented label="Idioma" value={profile.locale} onChange={(l: Locale) => setProfile({ ...profile, locale: l })} options={LOCALES.map((l) => ({ value: l.id, label: l.complete ? l.label : `${l.label} (parcial)` }))} />
            <p className="text-xs text-muted-foreground">El contingut pedagògic és en català. El castellà i l'anglès estan en preparació.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aparença i tauler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Segmented label="Tema" value={data.settings.theme} onChange={(v: AppSettings['theme']) => updateSettings({ theme: v })} options={[{ value: 'light', label: t('theme.light') }, { value: 'dark', label: t('theme.dark') }, { value: 'system', label: t('theme.system') }]} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={data.settings.showCoordinates} onChange={(e) => updateSettings({ showCoordinates: e.target.checked })} className="size-4 accent-[var(--primary)]" />
            Mostra les coordenades del tauler
          </label>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Punt de vista de l'avaluació</p>
            <Segmented label="Punt de vista" value={data.settings.evalPerspective} onChange={(v: AppSettings['evalPerspective']) => updateSettings({ evalPerspective: v })} options={[{ value: 'white', label: 'Des de les blanques' }, { value: 'player', label: 'Des del bàndol de baix del tauler' }]} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Profunditat d'anàlisi de Stockfish</p>
            <Segmented label="Profunditat" value={data.settings.engineDepth} onChange={(d: number) => updateSettings({ engineDepth: d })} options={[12, 16, 18, 20, 22].map((d) => ({ value: d, label: String(d) }))} />
            <p className="text-xs text-muted-foreground">Més profunditat és més precisa però més lenta, sobretot al mòbil.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Les teves dades</CardTitle>
          <CardDescription>
            Emmagatzematge actual: {repositoryKind === 'local' ? 'aquest navegador (localStorage)' : 'Supabase'}. Ningú més hi té accés. Fes una còpia de seguretat si
            canvies de navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && <p className="text-sm" role="status">{msg}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={download}><Download /> Exporta (JSON)</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Importa</Button>
            <input ref={fileRef} type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            {!confirmReset ? (
              <Button variant="danger" onClick={() => setConfirmReset(true)}>Esborra totes les dades</Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Segur? No es pot desfer.
                <Button variant="danger" size="sm" onClick={async () => { await resetAll(); setConfirmReset(false); setMsg('Dades esborrades.'); }}>Sí, esborra-ho</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel·la</Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sobre ChessLab</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Versió 0.1 (fase 1). Regles validades amb chess.js; anàlisi amb Stockfish 19 (WASM, llicència GPL-3.0) executat al teu dispositiu.</p>
          <p>Peces i tauler: react-chessboard (MIT).</p>
        </CardContent>
      </Card>
    </div>
  );
}
