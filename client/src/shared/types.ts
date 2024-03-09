import { IsoDate } from "check-type";

export type Shift = {
  name: string;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type CallPool = 'north' | 'uw' | 'south';

export type Config = {
  firstDay: IsoDate;

  days: {
    [day: IsoDate]: {
      holiday?: string;
    };
  };

  // defaultShifts: (Shift & {
  //   days: DayOfWeek[];
  // })[];
};
