import { IsoDate, dateToIsoDate, isoDateToDate, uuid } from 'check-type';
import {
  CallSchedule,
  CallScheduleProcessed,
  Person,
  ShiftKind,
  WEEKDAY_SHIFTS,
} from './types';
import { assertIsoDate } from './check-type.generated';
import * as datefns from 'date-fns';

function nextDay(day: string | Date, n: number = 1): IsoDate {
  if (typeof day === 'string') {
    day = isoDateToDate(assertIsoDate(day));
  }
  const next = new Date(day);
  next.setDate(next.getDate() + n);
  return dateToIsoDate(next);
}

function isWeekday(day: string): boolean {
  const date = isoDateToDate(assertIsoDate(day));
  return date.getDay() != 0 && date.getDay() != 6;
}

function isOnVacation(
  data: CallSchedule,
  person: Person,
  day: string,
): boolean {
  const vacations = data.vacations[person];
  for (const vacationMonday of vacations) {
    const vacationStart = nextDay(vacationMonday, -2);
    const vacationEnd = nextDay(vacationMonday, 6);
    if (day >= vacationStart && day <= vacationEnd) {
      return true;
    }
  }
  return false;
}

function dateToDayOfWeek(
  date: Date | string,
): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  if (typeof date === 'string') date = isoDateToDate(assertIsoDate(date));
  const d = date.getDay();
  if (d == 0) return 'sun';
  if (d == 1) return 'mon';
  if (d == 2) return 'tue';
  if (d == 3) return 'wed';
  if (d == 4) return 'thu';
  if (d == 5) return 'fri';
  return 'sat';
}

export function processCallSchedule(data: CallSchedule): CallScheduleProcessed {
  const result: CallScheduleProcessed = {
    issues: {
      test: {
        startDay: '2024-07-10' as IsoDate,
        message: 'This is a test issue',
      },
    },
    day2person2info: {},
  };

  // Figure out where everyone is working
  for (const [p, rotations] of Object.entries(data.rotations)) {
    if (rotations.length == 0) continue;
    const person = p as Person;
    let day = data.firstDay;
    let idx = 0;
    while (true) {
      if (idx + 1 < rotations.length && rotations[idx + 1].start == day) {
        idx += 1;
      }
      const rotation = rotations[idx];
      const onVacation = isOnVacation(data, person, day);
      result.day2person2info[day] = result.day2person2info[day] || {};
      const dayInfo = result.day2person2info[day];
      dayInfo[person] = {
        rotation: rotation.rotation,
        onVacation,
        isWorking: isWeekday(day) && !onVacation,
      };

      if (day == data.lastDay) break;
      day = nextDay(day);
    }
  }

  // Set isWorking to true for on-call
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const [s, person] of Object.entries(day.shifts)) {
        const shift = s as ShiftKind;
        if (person === '' || person === undefined) continue;

        const shiftConfig = data.shiftConfigs[shift];
        for (let i = 0; i <= shiftConfig.days; i++) {
          const info = result.day2person2info[nextDay(day.date, i)][person];
          if (!info) continue;
          if (i == 0) info.shift = shift;
          info.isWorking = true;
        }
      }
    }
  }

  // 1. no consecutive weekday night calls
  forEveryDay(data, (day, date) => {
    for (const person of Object.keys(data.people) as Person[]) {
      const today = result.day2person2info[day][person];
      const dayPlusOne = nextDay(day);
      const tomorrow = result.day2person2info[dayPlusOne][person];
      if (!today || !tomorrow) return;
      if (!today.shift || !tomorrow.shift) return;
      if (!WEEKDAY_SHIFTS.includes(today.shift)) return;
      if (!WEEKDAY_SHIFTS.includes(tomorrow.shift)) return;
      const key = generateIssueKey();
      result.issues[key] = {
        startDay: day,
        message: `Consecutive weekday call for ${person} on ${day} and ${dayPlusOne}`,
      };
    }
  });

  return result;
}

function generateIssueKey(): string {
  return uuid();
}

function forEveryDay(
  data: CallSchedule,
  callback: (day: IsoDate, date: Date) => void,
) {
  let day = assertIsoDate(data.firstDay);
  const lastDate = isoDateToDate(assertIsoDate(data.lastDay));
  while (true) {
    const date = isoDateToDate(assertIsoDate(day));
    if (datefns.isAfter(date, lastDate)) break;
    callback(day, date);
    day = nextDay(day);
  }
}
