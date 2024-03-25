import { IsoDate } from 'check-type';

// @check-type:entire-file

export type ShiftConfig = {
  name: string;
  // default: 1am
  start?: string;
  // default: 11pm
  end?: string;
};

export type Year = '1' | '2' | '3' | '4' | '5' | 'R';

export type PersonConfig = {
  name: string;
  year: Year;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export type Person = string;

export type ShiftId = DayId & {
  shiftName: string;
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
    [name: string]: Person | undefined;
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
    [name: string]: ShiftConfig;
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

  highlighted: string[];
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
    [shift: string]: Issue[];
  };
};

export type Issue = {
  message: string;
};
