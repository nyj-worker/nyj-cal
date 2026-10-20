import type { CalendarEvent, Category, WeekDataset } from '../types';
import { addDate, clock, minutes, mondayOf, todayInSeoul, weekLabel } from './dates';
import { identifyRoles } from './roles';

export function createSampleWeek(): WeekDataset {
  const startDate = mondayOf(todayInSeoul());
  const rows: [number, string | null, number, string, string, string, string, Category][] = [
    [0, '09:00', 60, '주간 간부회의', '시청 대회의실', '시장·제1부시장·제2부시장', '기획조정과', 'MAYOR'],
    [0, '10:30', 60, '교통정책 현안 보고', '교통국장실', '교통국장', '교통정책과', 'DIRECTOR'],
    [0, '14:00', 90, '시민과 함께하는 정책 간담회', '시민회관', '시장', '자치행정과', 'MAYOR'],
    [0, '16:00', 60, '스마트 교차로 사업 점검', '교통정보센터', '교통국장', '첨단교통과', 'DIRECTOR'],
    [1, null, 0, '대중교통 이용 활성화 캠페인', '주요 환승센터', '교통국장', '대중교통과', 'DIRECTOR'],
    [1, '09:00', 60, '민생 현장 방문', '다산동 일원', '시장', '자치행정과', 'MAYOR'],
    [1, '10:30', 60, '광역교통 개선 실무회의', '시청 소회의실', '교통국장', '광역교통과', 'DIRECTOR'],
    [1, '14:00', 90, '도시 미래전략 포럼', '문화예술회관', '시장', '정책기획과', 'MAYOR'],
    [1, '14:30', 60, '지역경제 활성화 협의회', '제1부시장실', '제1부시장', '지역경제과', 'MAYOR'],
    [2, '09:00', 60, '현안공유회의', '부시장 집무실', '제1부시장', '정책기획과', 'MAYOR'],
    [2, '09:00', 60, '교통안전 유관기관 협의', '교통국장실', '교통국장', '교통정책과', 'DIRECTOR'],
    [2, '11:00', 60, '청년 정책 업무협약', '시청 여유당', '시장', '청년정책과', 'MAYOR'],
    [2, '14:00', 120, '주요 사업 현장점검', '도시개발 사업 현장', '제2부시장', '도시정책과', 'MAYOR'],
    [3, '09:30', 60, '주민과의 열린 대화', '별내동 행정복지센터', '시장', '자치행정과', 'MAYOR'],
    [3, '11:00', 60, '버스 노선 개편 검토회의', '교통국장실', '교통국장', '대중교통과', 'DIRECTOR'],
    [3, '14:00', 60, '지속가능도시 추진위원회', '시청 대회의실', '시장·제2부시장', '환경정책과', 'MAYOR'],
    [3, '19:00', 60, '시민 문화공연', '시민회관 공연장', '시장', '문화예술과', 'MAYOR'],
    [4, '09:30', 90, '주요 사업 추진상황 보고', '시장 집무실', '시장', '기획조정과', 'MAYOR'],
    [4, '14:00', 60, '철도사업 관계기관 회의', '교통정보센터', '교통국장', '철도교통과', 'DIRECTOR'],
    [4, '16:00', 60, '시정 발전 유공 표창', '시청 대회의실', '제1부시장', '총무과', 'MAYOR'],
    [5, '10:00', 90, '시민 한마음 체육대회', '종합운동장', '시장', '체육과', 'MAYOR'],
    [6, '10:00', 60, '지역 문화축제 개막식', '중앙공원', '시장', '문화예술과', 'MAYOR'],
  ];
  const events: CalendarEvent[] = rows.map(([day, time, duration, title, location, attendees, department, category], i) => ({
    id: `${startDate}_sample_${i}`, date: addDate(startDate, day), endDate: addDate(startDate, day),
    startTime: time, endTime: time ? clock(minutes(time) + duration) : null,
    title, location, attendees, department, category, ...identifyRoles(attendees, category),
    notes: '기능 체험을 위한 가상 일정입니다. 실제 주간행사 엑셀을 업로드해 사용하세요.',
    allDay: !time, timeLabel: time ? `${time}–${clock(minutes(time) + duration)}` : '종일', endEstimated: false,
  }));
  return {
    id: startDate, startDate, endDate: addDate(startDate, 6), label: weekLabel(startDate),
    sourceName: '샘플 주간행사', importedAt: new Date().toISOString(), isSample: true,
    events, summaries: [
      { name: '시장-부시장 주간행사', category: 'MAYOR', count: events.filter(e => e.category === 'MAYOR').length },
      { name: '교통국장주간행사', category: 'DIRECTOR', count: events.filter(e => e.category === 'DIRECTOR').length },
    ], warnings: [],
  };
}
