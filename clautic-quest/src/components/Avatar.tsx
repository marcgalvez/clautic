import { memo } from 'react';
import type { AvatarCfg } from '@/lib/types';
import { shade } from './iso';

export const AVATAR_OPTIONS = {
  skin: ['#F5D0B0', '#E8B894', '#C98E62', '#9C6644', '#6B4226'],
  suit: ['#E5213B', '#22D3EE', '#8B5CF6', '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#FB923C'],
  visor: ['#22D3EE', '#8B5CF6', '#E5213B', '#34D399', '#FBBF24', '#F472B6'],
  helmet: ['casc', 'cabell', 'cabell_llarg', 'pentinat', 'gorra', 'auriculars'],
  antenna: ['cap', 'una', 'dues', 'orelles'],
  face: ['somriure', 'content', 'decidit', 'sorpres'],
} as const;

export const AVATAR_LABELS: Record<string, string> = {
  casc: 'Casc', cabell: 'Cabell curt', cabell_llarg: 'Cabell llarg', pentinat: 'Cresta', gorra: 'Gorra', auriculars: 'Auriculars',
  cap: 'Cap', una: 'Una antena', dues: 'Dues antenes', orelles: 'Orelles robot',
  somriure: 'Somriure', content: 'Content', decidit: 'Decidit', sorpres: 'Sorprès',
};

function hashPick<T>(seed: string, arr: readonly T[]) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

/** Avatar de pilot-inventor, generat per codi. */
export const Avatar = memo(function Avatar({ cfg, size = 48, seed = 'x', ring, className = '' }: { cfg?: AvatarCfg; size?: number; seed?: string; ring?: string; className?: string }) {
  const c = cfg ?? {};
  const skin = c.skin ?? hashPick(seed + 's', AVATAR_OPTIONS.skin);
  const suit = c.suit ?? hashPick(seed + 'u', AVATAR_OPTIONS.suit);
  const visor = c.visor ?? hashPick(seed + 'v', AVATAR_OPTIONS.visor);
  const helmet = c.helmet ?? hashPick(seed + 'h', AVATAR_OPTIONS.helmet);
  const antenna = c.antenna ?? 'cap';
  const face = c.face ?? 'somriure';
  const hair = shade(skin, -0.65);
  const uid = `${seed}-${size}`.replace(/[^a-z0-9-]/gi, '');

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor={shade(suit, -0.35)} />
          <stop offset="1" stopColor="#0E1430" />
        </radialGradient>
        <clipPath id={`clip-${uid}`}><circle cx="32" cy="32" r="31" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#bg-${uid})`} stroke={ring ?? 'rgba(255,255,255,.15)'} strokeWidth={ring ? 2.5 : 1} />
      <g clipPath={`url(#clip-${uid})`}>
        {/* vestit */}
        <path d="M10 64 Q12 46 32 44 Q52 46 54 64 Z" fill={suit} />
        <path d="M24 45 L32 53 L40 45" fill="none" stroke={shade(suit, 0.45)} strokeWidth="2" />
        <circle cx="32" cy="57" r="2.6" fill={visor} />
        <rect x="16" y="52" width="6" height="2" rx="1" fill={shade(suit, -0.3)} />
        {/* coll */}
        <rect x="27" y="38" width="10" height="8" rx="3" fill={shade(skin, -0.1)} />
        {/* cap */}
        {antenna === 'orelles' && (<><rect x="13" y="22" width="6" height="11" rx="2" fill="#94A3B8" /><rect x="45" y="22" width="6" height="11" rx="2" fill="#94A3B8" /><circle cx="16" cy="27" r="1.6" fill={visor} /><circle cx="48" cy="27" r="1.6" fill={visor} /></>)}
        <ellipse cx="32" cy="27" rx="14" ry="15" fill={skin} />
        {helmet === 'cabell' && <path d="M18 24 Q18 10 32 10 Q46 10 46 24 Q42 16 32 17 Q22 16 18 24 Z" fill={hair} />}
        {helmet === 'cabell_llarg' && <path d="M17 34 Q14 10 32 10 Q50 10 47 34 L44 26 Q42 16 32 17 Q22 16 20 26 Z" fill={hair} />}
        {helmet === 'pentinat' && <path d="M20 22 Q22 12 32 8 Q36 4 38 9 Q46 12 44 22 Q38 14 32 15 Q24 15 20 22 Z" fill={visor} />}
        {helmet === 'gorra' && (<><path d="M17 22 Q18 9 32 9 Q46 9 47 22 Z" fill={suit} /><path d="M30 21 L53 21 Q52 25 46 24 L30 24 Z" fill={shade(suit, -0.25)} /><circle cx="32" cy="12" r="1.8" fill={visor} /></>)}
        {helmet === 'casc' && (<><path d="M16 27 Q15 9 32 9 Q49 9 48 27 L46 27 Q45 14 32 14 Q19 14 18 27 Z" fill="#E8F1FF" /><path d="M16 24 h4 v8 h-4 z M44 24 h4 v8 h-4 z" fill={suit} /></>)}
        {helmet === 'auriculars' && (<><path d="M17 26 Q16 9 32 9 Q48 9 47 26" fill="none" stroke="#1E293B" strokeWidth="3" /><rect x="13" y="23" width="7" height="10" rx="3" fill={suit} /><rect x="44" y="23" width="7" height="10" rx="3" fill={suit} /><path d="M18 22 Q18 13 32 13 Q46 13 46 22 Q40 17 32 18 Q24 17 18 22 Z" fill={hair} /></>)}
        {/* visor */}
        <rect x="19" y="22" width="26" height="9" rx="4.5" fill="#0E1430" stroke={visor} strokeWidth="1.2" />
        {face === 'decidit' ? (
          <><rect x="24" y="25" width="5" height="2.4" rx="1" fill={visor} /><rect x="35" y="25" width="5" height="2.4" rx="1" fill={visor} /></>
        ) : face === 'sorpres' ? (
          <><circle cx="26.5" cy="26.5" r="2.4" fill={visor} /><circle cx="37.5" cy="26.5" r="2.4" fill={visor} /></>
        ) : face === 'content' ? (
          <><path d="M24 27.5 q2.5 -3 5 0" stroke={visor} strokeWidth="1.8" fill="none" strokeLinecap="round" /><path d="M35 27.5 q2.5 -3 5 0" stroke={visor} strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
        ) : (
          <><circle cx="26.5" cy="26.5" r="1.9" fill={visor} /><circle cx="37.5" cy="26.5" r="1.9" fill={visor} /></>
        )}
        <rect x="21" y="23" width="6" height="1.4" rx=".7" fill="#fff" opacity=".35" />
        {/* boca */}
        {face === 'sorpres' ? <ellipse cx="32" cy="36" rx="2" ry="2.4" fill={shade(skin, -0.5)} />
          : <path d={face === 'decidit' ? 'M28 36 h8' : 'M27 35 q5 4 10 0'} stroke={shade(skin, -0.5)} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
        {/* antenes */}
        {(antenna === 'una' || antenna === 'dues') && (
          <g stroke="#94A3B8" strokeWidth="1.5">
            {antenna === 'una' ? <line x1="32" y1="12" x2="32" y2="3" /> : (<><line x1="25" y1="13" x2="21" y2="4" /><line x1="39" y1="13" x2="43" y2="4" /></>)}
          </g>
        )}
        {antenna === 'una' && <circle cx="32" cy="3.5" r="2.4" fill={visor} />}
        {antenna === 'dues' && (<><circle cx="21" cy="4" r="2.2" fill={visor} /><circle cx="43" cy="4" r="2.2" fill={visor} /></>)}
      </g>
    </svg>
  );
});
