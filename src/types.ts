export type Category = 'MAYOR' | 'DIRECTOR';
export type TargetRole = '시장' | '부시장' | '제1부시장' | '제2부시장' | '교통국장' | '공동';
export type RoleFilter = '시장' | '부시장' | '교통국장';
export type TimeFilter = 'ALL' | 'AM' | 'PM' | 'OTHER';

export interface CalendarEvent {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  endDate: string;
  title: string;
  location: string;
  attendees: string;
  department: string;
  notes: string;
  category: Category;
  targetRole: TargetRole;
  roles: RoleFilter[];
  allDay: boolean;
  timeLabel: string;
  endEstimated: boolean;
}

export interface SheetSummary {
  name: string;
  category: Category;
  count: number;
}

export interface WeekDataset {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  sourceName: string;
  importedAt: string;
  isSample: boolean;
  events: CalendarEvent[];
  summaries: SheetSummary[];
  warnings: string[];
}

export interface ViewState {
  selectedWeek: string;
  category: Category | 'ALL';
  query: string;
  roles: RoleFilter[];
  time: TimeFilter;
  view: 'GRID' | 'LIST';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  MAYOR: '시장·부시장',
  DIRECTOR: '교통국장',
};
