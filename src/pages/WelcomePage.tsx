import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useData } from '@/state/DataProvider';
import { SESSION_MINUTES, type SessionMinutes } from '@/lib/storage/types';
import { uid } from '@/lib/utils';

export function WelcomePage() {
  const { setProfile } = useData();
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState<SessionMinutes>(15);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProfile({ id: uid('usr'), displayName: name.trim(), createdAt: new Date().toISOString(), sessionMinutes: minutes, locale: 'ca' });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-secondary via-background to-background p-4">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-11" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Benvingut/da a Chess<span className="text-primary">Lab</span>
              </h1>
              <p className="text-sm text-muted-foreground">Un entrenador que t'ajuda a pensar millor davant del tauler.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Com et dius?</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="El teu nom" autoFocus autoComplete="given-name" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Quant de temps vols dedicar a cada sessió?</p>
              <Segmented
                label="Durada de la sessió"
                value={minutes}
                onChange={setMinutes}
                options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))}
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Encara no sabem el teu nivell: el començarem a estimar amb els teus resultats i, més endavant, amb un diagnòstic inicial. Fins aleshores el
              nivell es mostrarà com a <strong>provisional</strong>. Les dades es desen només en aquest navegador.
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
              Comença
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
