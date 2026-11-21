import type { Role } from './types';
export function homeFor(roles: Role[]) {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('teacher')) return '/profe';
  if (roles.includes('student')) return '/ciutat';
  if (roles.includes('family')) return '/familia';
  return '/entrar';
}
