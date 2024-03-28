import { IsoDate, mapEnum } from 'check-type';

// @check-type:entire-file

export type ShiftConfig = {
  kind: ShiftKind;
  name: string;
  hospitals: HospitalKind[];
  /** How many days (1 for just today, 2 for today and tomorrow, etc) */
  days: number;
};

export type Year = '1' | '2' | '3' | 'S' | 'C' | 'R' | 'M';
export type YearOnSchedule = '2' | '3' | 'S' | 'R' | 'M';

export const WEEKDAY_SHIFTS = ['weekday_south'] as const;
export type WeekdayShiftKind = (typeof WEEKDAY_SHIFTS)[number];
export const WEEKEND_SHIFTS = [
  'weekend_south',
  'weekend_uw',
  'weekend_nwhsch',
] as const;
export type WeekendShiftKind = (typeof WEEKEND_SHIFTS)[number];
export const SPECIAL_SHIFTS = [
  'day_uw',
  'day_nwhsch',
  'south_24',
  'power_uw',
  'power_nwhsch',
  'power_south',
  'thanksgiving_south',
] as const;
export type SpecialShiftKind = (typeof SPECIAL_SHIFTS)[number];
export type ShiftKind = WeekdayShiftKind | WeekendShiftKind | SpecialShiftKind;
export type HospitalKind = 'UW' | 'VA' | 'HMC' | 'SCH' | 'NWH';
export type RotationKind = HospitalKind | 'Alaska' | 'Research' | 'NF';

export function yearToString(year: Year): string {
  return mapEnum(year, {
    '1': 'PGY1',
    '2': 'PGY2',
    '3': 'PGY3',
    S: 'Senior',
    C: 'Chief',
    R: 'Research',
    M: 'Madigan',
  });
}

export type PersonConfig = {
  name: string;
  year: Year;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export type Person = string;

export type ShiftId = DayId & {
  shiftName: ShiftKind;
};

export function shiftIdToString(shiftId: ShiftId) {
  return `${dayIdToString(shiftId)}-${shiftId.shiftName}`;
}

export function dayIdToString(dayId: DayId) {
  return `week${dayId.weekIndex}day${dayId.dayIndex}`;
}

export type DayId = WeekId & {
  dayIndex: number;
};

export type WeekId = {
  weekIndex: number;
};

export type Day = {
  date: IsoDate;

  shifts: {
    [Symbol in ShiftKind]?: Person;
  };
};

export type Week = {
  sundayDate: IsoDate;

  // first day is Sunday
  days: Day[];
};

// Marks the start Monday
export type Vacation = IsoDate;

export type CallSchedule = {
  firstDay: string;
  lastDay: string;
  weeks: Week[];

  shiftConfigs: {
    [Property in ShiftKind]: ShiftConfig;
  };

  people: {
    [name: string]: PersonConfig;
  };

  holidays: {
    [date: string]: string;
  };

  vacations: {
    [person: string]: Vacation[];
  };
};

export type LocalData = {
  highlightedPeople: {
    [name: string]: boolean;
  };
  highlightedIssues: {
    [name: string]: boolean;
  };
};

export type CallScheduleProcessed = {
  day2hospital2people: {
    [day: string]: {
      [hospital: string]: Person[];
    };
  };

  day2vacation: {
    [day: string]: string[];
  };

  issues: {
    [key: string]: Issue;
  };
  shift2issue: {
    [shift: string]: string[];
  };
};

export type Issue = {
  startDay: IsoDate;
  message: string;
};
