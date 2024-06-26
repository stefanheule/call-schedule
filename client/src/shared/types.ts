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
export const YEAR_ORDER = ['1', '2', '3', 'S', 'R', 'M', 'C'] as const;

export const CHIEF_SHIFTS = [
  'backup_weekday',
  'backup_weekend',
  'backup_holiday',
] as const;
export type ChiefShiftKind = (typeof CHIEF_SHIFTS)[number];

export const WEEKDAY_SHIFTS = ['weekday_south'] as const;
export const WEEKDAY_SHIFT_LOOKUP: Record<WeekdayShiftKind, boolean> = {
  weekday_south: true,
};
export type WeekdayShiftKind = (typeof WEEKDAY_SHIFTS)[number];
export const WEEKEND_SHIFTS = [
  'weekend_south',
  'weekend_uw',
  'weekend_nwhsch',
] as const;
export const WEEKEND_SHIFT_LOOKUP: Record<WeekendShiftKind, boolean> = {
  weekend_south: true,
  weekend_uw: true,
  weekend_nwhsch: true,
};
export type WeekendShiftKind = (typeof WEEKEND_SHIFTS)[number];
export const SPECIAL_SHIFTS = [
  'day_uw',
  'day_nwhsch',
  'day_va',
  'day_2x_uw',
  'day_2x_nwhsch',
  'south_24',
  'south_34',
  'south_power',

  // 'power_uw',
  // 'power_nwhsch',
] as const;
export const SPECIAL_SHIFT_LOOKUP: Record<SpecialShiftKind, boolean> = {
  day_uw: true,
  day_nwhsch: true,
  day_va: true,
  day_2x_uw: true,
  day_2x_nwhsch: true,
  south_24: true,
  south_34: true,
  south_power: true,
  // power_uw: true,
  // power_nwhsch: true,
  // power_south: true,
};

export type SpecialShiftKind = (typeof SPECIAL_SHIFTS)[number];
export type ShiftKind = WeekdayShiftKind | WeekendShiftKind | SpecialShiftKind;
export const SHIFT_ORDER: ShiftKind[] = [
  // NWH/SCH
  'weekend_nwhsch',
  'day_nwhsch',
  'day_2x_nwhsch',
  // 'power_nwhsch',
  // UW
  'weekend_uw',
  'day_uw',
  'day_2x_uw',
  // 'power_uw',
  'south_24',
  'south_34',
  'south_power',
  // South
  // 'power_south',
  'weekday_south',
  'weekend_south',
  // 'thanksgiving_south',
  'day_va',
];

export const HOSPITALS = ['UW', 'VA', 'HMC', 'SCH', 'NWH'] as const;
export type HospitalKind = (typeof HOSPITALS)[number];
export const EXTRA_ROTATIONS = [
  'Alaska',
  'Research',
  'NF',
  'Andro',
  'OFF',
] as const;
export const ROTATIONS = [...HOSPITALS, ...EXTRA_ROTATIONS] as const;
export type RotationKind = (typeof ROTATIONS)[number];
export const NO_CALL_ROTATION = ['OFF', 'Alaska', 'NF'] as const;
export type NoCallRotationKind = (typeof NO_CALL_ROTATION)[number];

export function isNoCallRotation(
  rotation: RotationKind,
): rotation is NoCallRotationKind {
  return NO_CALL_ROTATION.includes(rotation as NoCallRotationKind);
}

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
  priorityWeekendSaturday?: string;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export const CALL_POOL = [
  'MAD',
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
export type CallPoolPerson = (typeof CALL_POOL)[number];
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
export type MaybeCallPoolPerson = CallPoolPerson | UnassignedPerson;
export const ALL_CHIEFS = ['DK', 'LZ', 'TW', 'CP'] as const;
export type Chief = (typeof ALL_CHIEFS)[number];
export type MaybeChief = Chief | UnassignedPerson;

export type ShiftId = DayId & {
  shiftName: ShiftKind;
};
export type ChiefShiftId = DayId & {
  shiftName: ChiefShiftKind;
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
    [Symbol in ShiftKind]?: MaybeCallPoolPerson;
  };

  backupShifts: {
    [Symbol in ChiefShiftKind]?: MaybeChief;
  };
};

export type Week = {
  sundayDate: IsoDate;

  // first day is Sunday
  days: Day[];
};

// Marks the start Monday
export type Vacation =
  | string
  | {
      start: string;
      length: number;
    };

export type RotationSchedule = {
  [Property in Person]: RotationConfig[];
};

export type VacationSchedule = {
  [Property in Person]: Vacation[];
};

export type CallSchedule = {
  lastEditedBy?: string;
  firstDay: string;
  lastDay: string;
  weeks: Week[];

  shiftConfigs: {
    [Property in ShiftKind]?: ShiftConfig;
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

  vacations: VacationSchedule;

  rotations: RotationSchedule;

  isPublic?: boolean;
};

export type RotationConfig = RotationDetails & {
  rotation: RotationKind;
  start: string;
};

export type Action =
  | {
      kind: 'regular';
      previous: MaybeCallPoolPerson;
      next: MaybeCallPoolPerson;
      shift: ShiftId;
    }
  | {
      kind: 'backup';
      previous: MaybeChief;
      next: MaybeChief;
      shift: ChiefShiftId;
    };

export type LocalData = {
  highlightedPeople: {
    [name: string]: boolean;
  };
  history: Action[];
  undoHistory: Action[];
  unsavedChanges: number;
  firstUnsavedChange?: IsoDatetime;
};

export type RotationDetails = {
  chief: boolean;
};

export type DayPersonInfo = {
  rotation: RotationKind;
  rotationDetails: RotationDetails;
  shift?: ShiftKind;
  onVacation: boolean;
  onPriorityWeekend: boolean;
  // true if it's a weekday and the person is not on vacation, or if they are on call (either today, or via a multi-day shift that includes today)
  isWorking: boolean;
  shifts: {
    shift: ShiftKind;
    day: string;
  }[];
  // shifts2 is used for consecutive and almost-consecutive call. it's weird what does and does not count.
  shifts2: {
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
  softCrossCoverage?: number;
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

  element2issueKind: {
    [elementIdForShift: string]: 'soft' | 'hard' | undefined;
  };

  issueCounts: IssueCount;

  shiftCounts: ShiftCount;
  backupShiftCounts: BackupShiftCount;

  callCounts: Record<CallPoolPerson, CallCount>;
  backupCallCounts: Record<
    Chief,
    {
      regular: BackupCallCount;
      r2: BackupCallCount;
    }
  >;
  unassignedCalls: {
    weekend: number;
    weekday: number;
    weekendOutsideMaternity: number;
    weekdayOutsideMaternity: number;
  };
  totalCalls: {
    weekend: number;
    weekday: number;
    weekendOutsideMaternity: number;
    weekdayOutsideMaternity: number;
  };

  day2weekAndDay: {
    [key: string]: {
      dayIndex: number;
      weekIndex: number;
    };
  };

  day2shift2unavailablePeople: {
    [day: string]: {
      [Property in ShiftKind]?: UnavailablePeople;
    };
  };

  day2shift2isHoliday: {
    [day: string]: {
      [Property in ShiftKind]?: string;
    };
  };

  day2isR2EarlyCall: {
    [day: string]: boolean;
  };
};

export function isHolidayShift(
  processed: CallScheduleProcessed,
  day: string,
  shift: ShiftKind,
): string | undefined {
  return processed.day2shift2isHoliday[day]?.[shift];
}

export type UnavailablePeople = {
  [Property in Person]?: UnavailableReason;
};

export type UnavailableReason = {
  reason: string;
  soft: boolean;
};

export type CallCount = {
  weekday: number;
  sunday: number;
  nf: number;
  weekend: number;
};

export type BackupCallCount = {
  weekday: number;
  weekend: number;
  holiday_hours: number;
  holiday: number;
};

export const ISSUE_KINDS_HARD = [
  'rotation-without-call',
  'consecutive-call',
  'consecutive-weekend-call',
  'r2-early-call',
  'mad-early-call',
  'less-than-4-off-in-28',
  'maternity',
  'priority-weekend',
  'call-before-nf',
] as const;
export const ISSUE_KINDS_SOFT = [
  'almost-consecutive-call',
  'every-other-weekend-call',
  'mad-during-aua',
  'cross-coverage',
  'over-call-target',
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

export type ShiftCount = {
  total: number;
  assigned: number;
};
export type BackupShiftCount = {
  total: number;
  assigned: number;
};

export type StoredCallScheduleMetaData = {
  name: string;
  lastEditedBy?: string;
  backupShiftCounts?: BackupShiftCount;
  shiftCounts: ShiftCount;
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
  initialCallSchedule?: CallSchedule;
  name: string;
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
