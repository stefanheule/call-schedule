import { IsoDate, IsoDatetime, mapEnum } from './common/check-type';

// @check-type:entire-file

export type ShiftConfig = {
  kind: ShiftKind;
  /** Should we map this to a different kind for export in excel? */
  exportKind?: ShiftKind;
  type: 'weekday' | 'weekend' | 'special';
  name: string;
  nameLong: string;
  amionName?: string;
  hospitals: Hospital[];
  /** How many days (1 for just today, 2 for today and tomorrow, etc) */
  days: number;
  /** How many days, for considering consecutive calls. Day shifts get 0 here, for instance. */
  daysForConsecutiveCall: number;
  /** How many days, for export in excel (defaults to days) */
  daysForExport?: number;
  hours: number;
};
export type BackupShiftConfig = {
  kind: BackupShiftKind;
  name: string;
  nameLong: string;
  amionName?: string;
};

export type Year = '1' | '2' | '3' | 'S' | 'C' | 'R' | 'M';
export type YearOnSchedule = '2' | '3' | 'S' | 'R' | 'M';
export const YEAR_ORDER = ['1', '2', '3', 'S', 'R', 'M', 'C'] as const;

export type BackupShiftKind = string;
export type ShiftKind = string;

export const HOSPITAL_ORDER = ['NWH', 'SCH', 'UW', 'HMC', 'VA'] as const;
export const HOSPITALS = ['UW', 'VA', 'HMC', 'SCH', 'NWH'] as const;
export type Hospital = (typeof HOSPITALS)[number];
export const EXTRA_ROTATIONS = [
  'Alaska',
  'Research',
  'NF',
  'Andro',
  'OFF',
] as const;
export const ROTATIONS = [...HOSPITALS, ...EXTRA_ROTATIONS] as const;
export type Rotation = (typeof ROTATIONS)[number];
export const NO_CALL_ROTATION = ['OFF', 'Alaska', 'NF'] as const;
export type NoCallRotation = (typeof NO_CALL_ROTATION)[number];

export function isNoCallRotation(
  rotation: Rotation,
): rotation is NoCallRotation {
  return NO_CALL_ROTATION.includes(rotation as NoCallRotation);
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
  name: { first: string | string[]; last: string | string[] };
  year: Year;
  maternity?: {
    from: IsoDate;
    to: IsoDate;
  };
  priorityWeekendSaturday?: IsoDate;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export type CallPoolPerson = string;
export type Person = string;
export type UnassignedPerson = '';
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type MaybePerson = Person | UnassignedPerson;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type MaybeCallPoolPerson = CallPoolPerson | UnassignedPerson;
export type Chief = string;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type MaybeChief = Chief | UnassignedPerson;

export type ShiftId = DayId & {
  shiftName: ShiftKind;
};
export type ChiefShiftId = DayId & {
  shiftName: BackupShiftKind;
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

export type ShiftAssignment = Record<ShiftKind, MaybeCallPoolPerson>;
export type ChiefShiftAssignment = Record<BackupShiftKind, MaybeChief>;

export type Day = {
  date: IsoDate;
  shifts: ShiftAssignment;
  backupShifts: ChiefShiftAssignment;
};

export type Week = {
  sundayDate: IsoDate;

  // first day is Sunday
  days: Day[];
};

// Marks the start Monday
export type Vacation =
  | IsoDate
  | {
      start: IsoDate;
      length: number;
    };

export type RotationSchedule = Record<Person, RotationConfig[]>;

export type VacationSchedule = Record<Person, Vacation[]>;

export type SingleCallTarget = Record<Year, Record<Person, number>>;

export type CallTarget = {
  weekday: SingleCallTarget;
  weekend: SingleCallTarget;
};

export type ShiftConfigs = Record<ShiftKind, ShiftConfig>;
export type ChiefShiftConfigs = Record<BackupShiftKind, BackupShiftConfig>;
export type PeopleConfig = Record<Person, PersonConfig>;
export type Holidays = Record<IsoDate, string>;
export type SpecialDays = Record<IsoDate, string>;

export const EDITOR_TYPES = {
  // Base types
  IsoDate: `string; // YYYY-MM-DD`,
  Person: `string;`,
  BackupShiftKind: `string;`,
  ShiftKind: `string;`,
  Hospital: `'UW' | 'VA' | 'HMC' | 'SCH' | 'NWH';`,
  Year: `'1' | '2' | '3' | 'S' | 'C' | 'R' | 'M';`,
  PersonConfig: `{
  name: { first: string | string[]; last: string | string[] };
  year: Year;
  maternity?: {
    from: IsoDate;
    to: IsoDate;
  };
  priorityWeekendSaturday?: IsoDate;
};`,
  ShiftConfig: `{
  kind: ShiftKind;
  /** Should we map this to a different kind for export in excel? */
  exportKind?: ShiftKind;
  type: 'weekday' | 'weekend' | 'special';
  name: string;
  nameLong: string;
  amionName?: string;
  hospitals: Hospital[];
  /** How many days (1 for just today, 2 for today and tomorrow, etc) */
  days: number;
  /** How many days, for considering consecutive calls. Day shifts get 0 here, for instance. */
  daysForConsecutiveCall: number;
  /** How many days, for export in excel (defaults to days) */
  daysForExport?: number;
  hours: number;
};`,
  Rotation: `'UW' | 'VA' | 'HMC' | 'SCH' | 'NWH' | 'Alaska' | 'Research' | 'NF' | 'Andro' | 'OFF';`,
  BackupShiftConfig: `{ kind: BackupShiftKind; name: string; nameLong: string; amionName?: string; };`,
  RotationConfig: `{ rotation: Rotation; start: IsoDate; chief: boolean; };`,
  Vacation: `IsoDate | { start: IsoDate; length: number; };`,
  SingleCallTarget: `Record<Year, Partial<Record<Person, number>>>;`,
  CallPoolPerson: `string;`,
  Chief: `string;`,
  // types for the actual data
  holidays: `Record<IsoDate, string>;`,
  'special-days': `Record<IsoDate, string>;`,
  vacations: `Record<Person, Vacation[]>;`,
  rotations: `Record<Person, RotationConfig[]>;`,
  'call-targets': `{ weekday: SingleCallTarget; weekend: SingleCallTarget; };`,
  people: `Record<Person, PersonConfig>;`,
  'shift-configs': `Record<ShiftKind, ShiftConfig>;`,
  'backup-shift-configs': `Record<BackupShiftKind, BackupShiftConfig>;`,
  shifts: `Partial<Record<ShiftKind, '' | CallPoolPerson>>;`,
  'backup-shifts': `Partial<Record<ShiftKind, '' | Chief>>;`,
} as const;

export type CallSchedule = {
  lastEditedBy?: string;
  lastEditedAt?: IsoDatetime;

  firstDay: IsoDate;
  lastDay: IsoDate;
  weeks: Week[];

  shiftConfigs: ShiftConfigs;
  chiefShiftConfigs: ChiefShiftConfigs;

  callTargets: CallTarget;
  people: PeopleConfig;
  holidays: Holidays;
  specialDays: SpecialDays;
  vacations: VacationSchedule;
  rotations: RotationSchedule;

  isPublic?: boolean;
  currentUser?: string;
};

export type RotationConfig = RotationDetails & {
  rotation: Rotation;
  start: IsoDate;
};

export type Action =
  | {
      kind: 'regular';
      previous: MaybeCallPoolPerson;
      next: MaybeCallPoolPerson;
      shift: ShiftId;
      date?: IsoDate;
    }
  | {
      kind: 'backup';
      previous: MaybeChief;
      next: MaybeChief;
      shift: ChiefShiftId;
      date?: IsoDate;
    };

export type LocalData = {
  highlightedPeople: {
    [name: string]: boolean;
  };
  history: Action[];
  undoHistory: Action[];
  unsavedChanges: number;
  firstUnsavedChange?: IsoDatetime;
  processedFromLastSave?: CallScheduleProcessed;
};

export type RotationDetails = {
  chief: boolean;
};

export type DayPersonInfo = {
  rotation: Rotation;
  rotationDetails: RotationDetails;
  shift?: ShiftKind;
  onVacation: boolean;
  onPriorityWeekend: boolean;
  // true if it's a weekday and the person is not on vacation, or if they are on call (either today, or via a multi-day shift that includes today)
  isWorking: boolean;
  shifts: {
    shift: ShiftKind;
    day: IsoDate;
  }[];
  // shifts2 is used for consecutive and almost-consecutive call. it's weird what does and does not count.
  shifts2: {
    shift: ShiftKind;
    day: IsoDate;
  }[];
};

export type HospitalDayInfo = RotationDetails & {
  person: Person;
};

export type Hospital2People = {
  [Property in Rotation]?: HospitalDayInfo[];
};

export type IssueCount = {
  hard: number;
  soft: number;
  softCrossCoverage?: number;
};

export function allPeople(data: CallSchedule): Person[] {
  return Object.keys(data.people);
}

export function allChiefs(data: CallSchedule): Chief[] {
  return allPeople(data).filter(person => data.people[person].year === 'C');
}

export function callPoolPeople(data: CallSchedule): CallPoolPerson[] {
  return allPeople(data).filter(person => {
    const year = data.people[person].year;
    return year !== 'C' && year !== '1';
  });
}

export type CallScheduleProcessed = {
  data: CallSchedule;

  day2person2info: Record<IsoDate, Record<Person, DayPersonInfo>>;

  day2hospital2people: Record<IsoDate, Hospital2People>;

  issues: Record<string, Issue>;

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

  day2weekAndDay: Record<
    IsoDate,
    {
      dayIndex: number;
      weekIndex: number;
    }
  >;

  day2shift2unavailablePeople: Record<
    IsoDate,
    Record<ShiftKind, UnavailablePeople>
  >;
  day2shift2isHoliday: Record<IsoDate, Record<ShiftKind, string>>;
  day2isR2EarlyCall: Record<IsoDate, boolean>;
};

export function isHolidayShift(
  processed: CallScheduleProcessed,
  day: IsoDate,
  shift: ShiftKind,
): string | undefined {
  return processed.day2shift2isHoliday[day]?.[shift];
}

export type UnavailablePeople = Record<Person, UnavailableReason>;

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

export type SaveFullCallScheduleResponse =
  | {
      kind: 'was-edited';
    }
  | {
      kind: 'ok';
      newData: CallSchedule;
    };

export type ListCallSchedulesRequest = {
  kind: 'list';
};

export type ListCallSchedulesResponse = {
  schedules: StoredCallScheduleMetaData[];
};
