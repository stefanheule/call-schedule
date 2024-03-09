import { IsoDate } from "check-type";

export type Shift = {
  name: string;
};

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type Config = {
  firstDay: IsoDate;

  namedDays: {
    [day: IsoDate]: {
      name: string;
    };
  };

  defaultShifts: (Shift & {
    days: DayOfWeek[];
  })[];
};
