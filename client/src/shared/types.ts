import { IsoDate } from "check-type";

// @check-type:entire-file

export type ShiftConfig = {
  name: string;
  // default: 1am
  start?: string;
  // default: 11pm
  end?: string;
};

export type PersonConfig = {
  name: string;
  year: '1' | '2' | '3' | '4' | '5' | 'R';
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export type Person = string;

export type Day = {
  date: IsoDate;

  shifts: {
    [name: string]: Person;
  };
};

export type Week = {
  sundayDate: IsoDate;

  // first day is Sunday
  days: Day[];
};

export type CallSchedule = {
  weeks: Week[];

  shiftConfigs: {
    [name: string]: ShiftConfig;
  }

  people: {
    [name: string]: PersonConfig;
  }
};
