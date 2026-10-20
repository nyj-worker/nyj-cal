import type { CalendarEvent, RoleFilter } from '../types';

export const ROLE_CLASS: Record<RoleFilter, string> = {
  시장: 'role-mayor',
  부시장: 'role-deputy',
  교통국장: 'role-director',
};

export function eventColorClass(event: CalendarEvent) {
  if (event.roles.length > 1) return 'role-joint';
  if (event.roles[0]) return ROLE_CLASS[event.roles[0]];
  return event.category === 'DIRECTOR' ? 'role-director' : 'role-mayor';
}
