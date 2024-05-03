import {
  IsoDate,
  assertNonNull,
  dateToIsoDate,
  isoDateToDate,
  uuid,
} from 'check-type';
import {
  CallSchedule,
  CallScheduleProcessed,
  Person,
  ShiftKind,
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

export function dateToDayOfWeek(
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
  const PEOPLE = Object.keys(data.people) as Person[];

  const result: CallScheduleProcessed = {
    issues: {
      test: {
        kind: 'consecutive-weekday-call',
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
          const info = result.day2person2info[nextDay(day.date, i)]?.[person];
          if (!info) continue;
          if (i == 0) info.shift = shift;
          info.isWorking = true;
        }
      }
    }
  }

  // 1. no consecutive weekday night calls
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = result.day2person2info[day][person];
      const dayPlusOne = nextDay(day);
      const tomorrow = result.day2person2info[dayPlusOne]?.[person];
      assertNonNull(today);
      if (!today || !tomorrow) continue;
      if (!today.shift || !tomorrow.shift) continue;
      if (data.shiftConfigs[today.shift].days != 2) continue;
      if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
      result.issues[generateIssueKey()] = {
        kind: 'consecutive-weekday-call',
        startDay: day,
        message: `Consecutive weekday call for ${person} on ${day} and ${dayPlusOne}`,
      };
    }
  });

  // 2. no consecutive weekend calls
  forEveryDay(data, (day, _) => {
    if (dateToDayOfWeek(day) != 'fri') return;
    for (const person of Object.keys(data.people) as Person[]) {
      const today = result.day2person2info[day][person];
      const nextWeekendDay = nextDay(day, 7);
      const nextWeekend = result.day2person2info[nextWeekendDay]?.[person];
      assertNonNull(today);
      if (!today || !nextWeekend) continue;
      if (!today.shift || !nextWeekend.shift) continue;
      if (data.shiftConfigs[today.shift].days != 3) continue;
      if (data.shiftConfigs[today.shift].days != 3) continue;
      result.issues[generateIssueKey()] = {
        kind: 'consecutive-weekend-call',
        startDay: day,
        message: `Consecutive weekend call for ${person} on ${day} and ${nextWeekendDay}`,
      };
    }
  });

  // 3. r2's should not be on call for first 2 weeks of july
  forEveryDay(data, (day, _) => {
    if (day > '2024-07-14') return;
    for (const person of PEOPLE) {
      const p = data.people[person];
      if (p.year != '2') continue;
      const today = result.day2person2info[day][person];
      assertNonNull(today);
      if (!today?.shift) continue;
      result.issues[generateIssueKey()] = {
        kind: 'r2-early-call',
        startDay: day,
        message: `R2 ${person} is on call ${day} for ${today.shift} (first two weeks in July)`,
      };
    }
  });

  // 4. MAD shouldn't be on call for the first two weeks of their SCH/HMC rotations.
  for (const rotation of data.rotations.MAD) {
    if (rotation.rotation != 'HMC' && rotation.rotation != 'SCH') continue;
    for (const i = 0; i < 14; i++) {
      const day = nextDay(rotation.start, i);
      const info = result.day2person2info[day]?.['MAD'];
      assertNonNull(info);
      if (info?.shift) {
        result.issues[generateIssueKey()] = {
          kind: 'mad-early-call',
          startDay: day,
          message: `MAD is on call ${day} for ${info.shift} (day ${
            i + 1
          } of their ${rotation.rotation} rotation)`,
        };
      }
    }
  }

  // 5. 4 days off in a 28 day period
  for (const person of PEOPLE) {
    let offCounter = 0;
    for (let i = 0; i < 28; i++) {
      const info = assertNonNull(
        result.day2person2info[nextDay(data.firstDay, i)][person],
      );
      if (!info.isWorking) offCounter += 1;
    }
    let skip = 0;
    for (let i = 28; ; i += 1) {
      const dayOne = nextDay(data.firstDay, i - 28);
      const dayTwo = nextDay(data.firstDay, i);
      if (dayTwo > data.lastDay) break;
      if (offCounter < 4 && skip <= 0) {
        result.issues[generateIssueKey()] = {
          kind: 'less-than-4-off-in-28',
          startDay: dayOne,
          message: `Less than 4 days off between ${dayOne} and ${dayTwo} (28 day period) for ${person}`,
        };
        skip = 27;
      }
      const infoOne = assertNonNull(result.day2person2info[dayOne][person]);
      const infoTwo = assertNonNull(result.day2person2info[dayTwo][person]);
      if (!infoOne.isWorking) offCounter -= 1;
      if (!infoTwo.isWorking) offCounter += 1;
      skip -= 1;
    }
  }

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
