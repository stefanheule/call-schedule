import { IsoDate, IsoDatetime, mapEnum } from 'check-type';

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

export const HOSPITALS = ['UW', 'VA', 'HMC', 'SCH', 'NWH'] as const;
export type HospitalKind = (typeof HOSPITALS)[number];
export const EXTRA_ROTATIONS = ['Alaska', 'Research', 'NF', 'OFF'] as const;
export const ROTATIONS = [...HOSPITALS, ...EXTRA_ROTATIONS] as const;
export type RotationKind = (typeof ROTATIONS)[number];

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
  dueDate?: string;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export const ALL_PEOPLE = [
  'MAD',
  'DK',
  'LZ',
  'TW',
  'CP',
  'AA',
  'DC',
  'AJ',
  'LX',
  'CC',
  'MB',
  'RB',
  'MJ',
  'TM',
  'GN',
  'KO',
  'CPu',
  'NR',
] as const;
export type Person = (typeof ALL_PEOPLE)[number];
export type UnassignedPerson = '';
export type MaybePerson = Person | UnassignedPerson;

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
    [Symbol in ShiftKind]?: MaybePerson;
  };
};

export type Week = {
  sundayDate: IsoDate;

  // first day is Sunday
  days: Day[];
};

// Marks the start Monday
export type Vacation = string;

export type RotationSchedule = {
  [Property in Person]: RotationConfig[];
};

export type CallSchedule = {
  firstDay: string;
  lastDay: string;
  weeks: Week[];

  shiftConfigs: {
    [Property in ShiftKind]: ShiftConfig;
  };

  people: {
    [Property in Person]: PersonConfig;
  };

  holidays: {
    [date: string]: string;
  };

  specialDays: {
    [date: string]: string;
  };

  vacations: {
    [Property in Person]: Vacation[];
  };

  rotations: RotationSchedule;
};

export type RotationConfig = RotationDetails & {
  rotation: RotationKind;
  start: string;
};

export type Action = {
  previous: MaybePerson | undefined;
  next: MaybePerson | undefined;
  shift: ShiftId;
};

export type LocalData = {
  highlightedPeople: {
    [name: string]: boolean;
  };
  history: Action[];
  undoHistory: Action[];
};

export type RotationDetails = {
  chief: boolean;
};

export type DayPersonInfo = {
  rotation: RotationKind;
  rotationDetails: RotationDetails;
  shift?: ShiftKind;
  onVacation: boolean;
  // true if it's a weekday and the person is not on vacation, or if they are on call (either today, or via a multi-day shift that includes today)
  isWorking: boolean;
  shifts: {
    shift: ShiftKind;
    day: string;
  }[];
};

export type HospitalDayInfo = RotationDetails & {
  person: Person;
};

export type Hospital2People = {
  [Property in RotationKind]?: HospitalDayInfo[];
};

export type IssueCount = {
  hard: number;
  soft: number;
};

export type CallScheduleProcessed = {
  day2person2info: {
    [day: string]: {
      [Property in Person]?: DayPersonInfo;
    };
  };

  day2hospital2people: {
    [day: string]: Hospital2People;
  };

  issues: {
    [key: string]: Issue;
  };

  issueCounts: IssueCount;

  assignedShifts: number;

  callCounts: {
    [Property in Person]?: CallCount;
  };
};

export type CallCount = {
  weekday: number;
  nf: number;
  weekend: number;
  holiday: number;
};

export const ISSUE_KINDS_HARD = [
  'rotation-without-call',
  'consecutive-call',
  'consecutive-weekend-call',
  'r2-early-call',
  'mad-early-call',
  'less-than-4-off-in-28',
] as const;
export const ISSUE_KINDS_SOFT = [
  'almost-consecutive-call',
  'every-other-weekend-call',
  'mad-during-aua',
  'cross-coverage',
  'third-trimester',
] as const;
export const ISSUE_KINDS = [...ISSUE_KINDS_SOFT, ...ISSUE_KINDS_HARD];
export type IssueKind = (typeof ISSUE_KINDS)[number];

export type Issue = {
  kind: IssueKind;
  startDay: IsoDate;
  elements: string[];
  message: string;
  isHard: boolean;
};

// API / storage

export type StoredCallScheduleMetaData = {
  name?: string;
  assignedShifts: number;
  issueCounts: IssueCount;
  ts: IsoDatetime;
};

export type StoredCallSchedule = StoredCallScheduleMetaData & {
  callSchedule: CallSchedule;
};

export type StoredCallSchedules = {
  versions: StoredCallSchedule[];
};

export type LoadCallScheduleRequest = {
  ts?: IsoDatetime;
};

export type LoadCallScheduleResponse = CallSchedule;

export type SaveCallScheduleRequest = {
  callSchedule: CallSchedule;
  name?: string;
};

export type SaveCallScheduleResponse = {
  ts: IsoDatetime;
};

export type ListCallSchedulesRequest = {
  kind: 'list';
};

export type ListCallSchedulesResponse = {
  schedules: StoredCallScheduleMetaData[];
};
