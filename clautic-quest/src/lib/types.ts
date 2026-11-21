export type Role = 'admin' | 'teacher' | 'student' | 'family';
export type Line = 'robotica' | 'videojocs' | 'minecraft';
export type AvatarCfg = Partial<Record<'skin' | 'suit' | 'visor' | 'helmet' | 'antenna' | 'face', string>>;
export type HouseCfg = { model: string; wall_color: string; accent_color: string; slots: Record<string, string> };

export interface GroupLite { id: string; code: string; name: string; line: Line; weekday?: number | null; schedule?: string; students?: number }
export interface MyContext {
  user_id: string;
  full_name: string;
  roles: Role[];
  academic_year?: { id: string; name: string } | null;
  student?: { id: string; first_name: string; name: string; avatar: AvatarCfg };
  children?: { id: string; name: string; first_name: string; avatar: AvatarCfg }[];
  groups?: GroupLite[];
}
export interface Competency {
  id: string; key: string; name: string; icon: string; color: string; description: string;
  examples: string[]; family_explanation: string; xp: number; coins: number; sort: number; active: boolean;
}
export interface QuickAction { id: string; label: string; icon: string; competency_id: string | null; xp: number; coins: number; sort: number; active: boolean }
export interface Recognition {
  id: string; label: string; xp: number; coins: number; source: string; created_at: string; note?: string;
  competency: null | { key: string; name: string; icon: string; color: string; family_explanation: string };
}
export interface BadgeLite { id?: string; key?: string; name: string; icon: string; color: string; description?: string; category?: string; awarded_at?: string }

export const LINES: Record<Line, { name: string; icon: string; color: string; building: string }> = {
  robotica: { name: 'Robòtica', icon: '🤖', color: '#E5213B', building: 'Laboratori de Robòtica' },
  videojocs: { name: 'Videojocs', icon: '🎮', color: '#8B5CF6', building: 'Estudi de Videojocs' },
  minecraft: { name: 'Minecraft', icon: '⛏️', color: '#34D399', building: 'Portal Minecraft' },
};
export const SOURCE_LABEL: Record<string, string> = {
  competencia: 'Competència', accio_rapida: 'Acció ràpida', assistencia: 'Assistència', missio: 'Missió',
  activitat: 'Activitat', insignia: 'Insígnia', antiguitat: 'Antiguitat', regla: 'Reconeixement', correccio: 'Correcció',
  compra: 'Compra', importacio: 'Historial',
};
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administració', teacher: 'Professorat', student: 'Alumne', family: 'Família' };
