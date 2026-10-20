import type { Category, RoleFilter, TargetRole } from '../types';

export function identifyRoles(attendees: string, category: Category): { roles: RoleFilter[]; targetRole: TargetRole } {
  const text = attendees.replace(/[\s\-·ㆍ_()（）\[\]:：]/g, '');
  const exact: TargetRole[] = [];
  if (/제?1부시장/.test(text)) exact.push('제1부시장');
  if (/제?2부시장/.test(text)) exact.push('제2부시장');
  if (/부시장/.test(text) && !exact.length) exact.push('부시장');
  if (text.replace(/(?:제?[12])?부시장/g, '').includes('시장')) exact.push('시장');
  if (text.includes('교통국장') || category === 'DIRECTOR' && (!text || /^[oO○◯✓참석]+$/.test(text))) exact.push('교통국장');
  const roles = [...new Set(exact.map(r => r.includes('부시장') ? '부시장' : r as RoleFilter))];
  return { roles, targetRole: exact.length === 1 ? exact[0] : '공동' };
}
