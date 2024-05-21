import { IsoDate, assertNonNull, dateToIsoDatetime, uuid } from 'check-type';
import {
  ALL_PEOPLE,
  CallSchedule,
  CallScheduleProcessed,
  DayPersonInfo,
  ISSUE_KINDS_HARD,
  ISSUE_KINDS_SOFT,
  Person,
  SPECIAL_SHIFTS,
  ShiftKind,
  StoredCallSchedule,
  WEEKDAY_SHIFTS,
  WEEKEND_SHIFTS,
} from './types';
import { assertIsoDate } from './check-type.generated';
import * as datefns from 'date-fns';

export function clearSchedule(data: CallSchedule): CallSchedule {
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const s of Object.keys(day.shifts)) {
        day.shifts[s as ShiftKind] = '';
      }
    }
  }
  return data;
}

export function inferSchedule(data: CallSchedule): CallSchedule {
  const processed = processCallSchedule(data);
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date < data.firstDay || day.date > data.lastDay) continue;
      const dayInfo = processed.day2person2info[day.date];
      const peopleOnCallToday: string[] = [];
      for (const s of Object.keys(day.shifts)) {
        const shift = s as ShiftKind;
        const people: Person[] = ALL_PEOPLE.filter(p => {
          const info = assertNonNull(dayInfo[p]);
          const year = data.people[p].year;
          return (
            !info.onVacation &&
            year !== 'C' &&
            year != '1' &&
            !peopleOnCallToday.includes(p)
          );
        });

        const person2rating = new Map<Person, number>();
        for (const p of people) {
          day.shifts[shift] = p;
          person2rating.set(p, rate(data));
        }
        const min = Math.min(...Array.from(person2rating.values()));
        const best = Array.from(person2rating.entries()).filter(
          ([, rating]) => rating === min,
        );
        const randomWinner = best[Math.floor(Math.random() * best.length)];
        console.log(
          `For ${day.date} picking a rating=${randomWinner[1]}: ${randomWinner[0]}`,
        );
        day.shifts[shift] = randomWinner[0];
        peopleOnCallToday.push(randomWinner[0]);
      }
    }
  }

  return data;
}

function rate(data: CallSchedule) {
  const processed = processCallSchedule(data);
  return processed.issueCounts.hard * 100 + processed.issueCounts.soft * 10;
}

export function scheduleToStoredSchedule(
  data: CallSchedule,
  name: string,
): StoredCallSchedule {
  const processed = processCallSchedule(data);
  return {
    name,
    ts: dateToIsoDatetime(new Date()),
    callSchedule: data,
    issueCounts: processed.issueCounts,
    shiftCounts: processed.shiftCounts,
  };
}

export function elementIdForDay(date: string): string {
  return `day-${date}`;
}
export function elementIdForShift(date: string, shift: ShiftKind): string {
  return `shift-${shift}-on-day-${date}`;
}

function isoDateToDate(date: IsoDate): Date {
  const parts = date.split('-').map(x => parseInt(x));
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateToIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${date.getMonth() + 1 > 9 ? '' : '0'}${
    date.getMonth() + 1
  }-${date.getDate() > 9 ? '' : '0'}${date.getDate()}` as IsoDate;
}

export function nextDay(day: string | Date, n: number = 1): IsoDate {
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
  const start = Date.now();

  const PEOPLE = Object.keys(data.people) as Person[];

  const result: CallScheduleProcessed = {
    issues: {},
    day2person2info: {},
    day2hospital2people: {},
    issueCounts: {
      hard: 0,
      soft: 0,
    },
    callCounts: {},
    shiftCounts: {
      total: 0,
      assigned: 0,
    },
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
      const rotation =
        rotations[idx].start <= day
          ? rotations[idx]
          : {
              rotation: 'OFF' as const,
              chief: false,
            };
      const onVacation = isOnVacation(data, person, day);
      result.day2person2info[day] = result.day2person2info[day] || {};
      const dayInfo = result.day2person2info[day];
      dayInfo[person] = {
        rotation: rotation.rotation,
        rotationDetails: {
          chief: rotation.chief,
        },
        onVacation,
        isWorking: isWeekday(day) && !onVacation,
        shifts: [],
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

  // Compute day2hospital2people
  for (const [day, person2info] of Object.entries(result.day2person2info)) {
    for (const [person, info] of Object.entries(person2info)) {
      if (info.rotation == 'OFF') continue;
      result.day2hospital2people[day] = result.day2hospital2people[day] || {};
      result.day2hospital2people[day][info.rotation] =
        result.day2hospital2people[day][info.rotation] || [];
      assertNonNull(result.day2hospital2people[day][info.rotation]).push({
        person: person as Person,
        ...info.rotationDetails,
      });
    }
  }

  // Collect multi-day shifts
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      const shiftConfig = data.shiftConfigs[today.shift];
      // Almost all shifts are at least 2 days, but there are some holiday day shifts.
      // To make sure we don't let people be on day shift and then on call again the next day,
      // we just pretend day shifts are 2 days also.
      for (let i = 0; i < Math.max(2, shiftConfig.days); i++) {
        const nextD = nextDay(day, i);
        if (nextD > data.lastDay) break;
        const nextDayInfo = assertNonNull(
          result.day2person2info[nextD][person],
        );
        nextDayInfo.shifts.push({
          shift: today.shift,
          day,
        });
      }
    }
  });

  function shiftName(info: DayPersonInfo | ShiftKind): string {
    if (typeof info == 'string') return data.shiftConfigs[info].name;
    if (!info.shift) throw new Error('No shift');
    return data.shiftConfigs[info.shift].name;
  }

  // hard 0. no illegal calls
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      if (
        today.rotation == 'Alaska' ||
        today.rotation == 'NF' ||
        today.rotation == 'OFF'
      ) {
        result.issues[generateIssueKey()] = {
          kind: 'rotation-without-call',
          startDay: day,
          message: `No call during ${
            today.rotation
          }: ${person} is on call for ${shiftName(today)}.`,
          isHard: true,
          elements: [elementIdForShift(day, today.shift)],
        };
      }
    }
  });

  // hard 1. no consecutive call calls
  // forEveryDay(
  //   data,
  //   (day, _) => {
  //     const dayPlusOne = nextDay(day);
  //     for (const person of PEOPLE) {
  //       const today = assertNonNull(result.day2person2info[day][person]);
  //       const tomorrow = assertNonNull(
  //         result.day2person2info[dayPlusOne][person],
  //       );
  //       if (!today.shift || !tomorrow.shift) continue;
  //       // if (data.shiftConfigs[today.shift].days != 2) continue;
  //       // if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
  //       result.issues[generateIssueKey()] = {
  //         kind: 'consecutive-weekday-call',
  //         startDay: day,
  //         message: `Consecutive call for ${person} on ${day} and ${dayPlusOne}`,
  //         isHard: true,
  //         elements: [
  //           elementIdForShift(day, today.shift),
  //           elementIdForShift(dayPlusOne, tomorrow.shift),
  //         ],
  //       };
  //     }
  //   },
  //   1,
  // );
  forEveryDay(
    data,
    (day, _) => {
      for (const person of PEOPLE) {
        const today = assertNonNull(result.day2person2info[day][person]);
        if (today.shifts.length <= 1) continue;
        // if (data.shiftConfigs[today.shift].days != 2) continue;
        // if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
        const texts = today.shifts.map(
          s => `${shiftName(s.shift)} on ${s.day}`,
        );
        const startDay = today.shifts.map(s => s.day).sort()[0] as IsoDate;
        result.issues[generateIssueKey()] = {
          kind: 'consecutive-call',
          startDay,
          message: `Consecutive call for ${person}: ${texts.join(', ')}`,
          isHard: true,
          elements: today.shifts.map(s => elementIdForShift(s.day, s.shift)),
        };
      }
    },
    1,
  );

  // hard 2. no consecutive weekend calls
  forEveryDay(
    data,
    (day, _) => {
      if (dateToDayOfWeek(day) != 'fri') return;
      const nextWeekendDay = nextDay(day, 7);
      for (const person of PEOPLE) {
        const today = assertNonNull(result.day2person2info[day][person]);
        const nextWeekend = assertNonNull(
          result.day2person2info[nextWeekendDay][person],
        );
        if (!today.shift || !nextWeekend.shift) continue;
        // if (data.shiftConfigs[today.shift].days != 3) continue;
        // if (data.shiftConfigs[nextWeekend.shift].days != 3) continue;
        result.issues[generateIssueKey()] = {
          kind: 'consecutive-weekend-call',
          startDay: day,
          message: `Consecutive weekend call for ${person} on ${day} and ${nextWeekendDay}`,
          isHard: true,
          elements: [
            elementIdForShift(day, today.shift),
            elementIdForShift(nextWeekendDay, nextWeekend.shift),
          ],
        };
      }
    },
    7,
  );

  // hard 3. r2's should not be on call for first 2 weeks of july
  forEveryDay(data, (day, _) => {
    if (day > '2024-07-14') return;
    for (const person of PEOPLE) {
      const p = data.people[person];
      if (p.year != '2') continue;
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      result.issues[generateIssueKey()] = {
        kind: 'r2-early-call',
        startDay: day,
        message: `R2 on-call first week of July: ${person} is on call ${day} for ${shiftName(
          today,
        )}.`,
        isHard: true,
        elements: [elementIdForShift(day, today.shift)],
      };
    }
  });

  // hard 4. MAD shouldn't be on call for the first two weeks of their SCH/HMC rotations.
  for (const rotation of data.rotations.MAD) {
    if (rotation.rotation != 'HMC' && rotation.rotation != 'SCH') continue;
    for (let i = 0; i < 14; i++) {
      const day = nextDay(rotation.start, i);
      const today = result.day2person2info[day]?.['MAD'];
      assertNonNull(today);
      if (today?.shift) {
        result.issues[generateIssueKey()] = {
          kind: 'mad-early-call',
          startDay: day,
          message: `MAD is on call first two weeks of SCH/HMC rotation: ${day} for ${shiftName(
            today,
          )} (day ${i + 1} of their ${rotation.rotation} rotation)`,
          isHard: true,
          elements: [elementIdForShift(day, today.shift)],
        };
      }
    }
  }

  // hard 5. 4 days off in a 28 day period
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
          message: `Less than 4 days off in 28 days: between ${dayOne} and ${dayTwo} for ${person}`,
          isHard: true,
          elements: [elementIdForDay(dayOne), elementIdForDay(dayTwo)],
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

  // soft 1. every other weeknight call // TODO: should weekends count for this?
  forEveryDay(
    data,
    (day, _) => {
      const dayPlusOne = nextDay(day, 2);
      for (const person of PEOPLE) {
        const today = assertNonNull(result.day2person2info[day][person]);
        const tomorrow = assertNonNull(
          result.day2person2info[dayPlusOne][person],
        );
        if (!today.shift || !tomorrow.shift) continue;
        // if (data.shiftConfigs[today.shift].days != 2) continue;
        // if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
        result.issues[generateIssueKey()] = {
          kind: 'almost-consecutive-call',
          startDay: day,
          message: `Two calls only 1 day apart: ${person} on call ${day} and ${dayPlusOne}`,
          isHard: false,
          elements: [
            elementIdForShift(day, today.shift),
            elementIdForShift(dayPlusOne, tomorrow.shift),
          ],
        };
      }
    },
    2,
  );

  // soft 2. every other weekend call
  forEveryDay(
    data,
    (day, _) => {
      if (dateToDayOfWeek(day) != 'fri') return;
      const nextWeekendDay = nextDay(day, 14);
      const nextNextWeekendDay = nextDay(day, 28);
      for (const person of PEOPLE) {
        const today = assertNonNull(result.day2person2info[day][person]);
        const nextWeekend = assertNonNull(
          result.day2person2info[nextWeekendDay][person],
        );
        const nextNextWeekend = assertNonNull(
          result.day2person2info[nextNextWeekendDay][person],
        );
        if (!today.shift || !nextWeekend.shift || !nextNextWeekend.shift)
          continue;
        if (data.shiftConfigs[today.shift].days != 3) continue;
        if (data.shiftConfigs[nextWeekend.shift].days != 3) continue;
        if (data.shiftConfigs[nextNextWeekend.shift].days != 3) continue;
        result.issues[generateIssueKey()] = {
          kind: 'every-other-weekend-call',
          startDay: day,
          message: `Every other weekend on call for 3 calls in a row: ${person} on ${day}, ${nextWeekendDay} and ${nextNextWeekendDay}`,
          isHard: false,
          elements: [
            elementIdForShift(day, today.shift),
            elementIdForShift(nextWeekendDay, nextWeekend.shift),
            elementIdForShift(nextNextWeekendDay, nextNextWeekend.shift),
          ],
        };
      }
    },
    7 * 5,
  );

  // soft 3. no MAD call during AUA
  forEveryDay(data, (day, _) => {
    if (data.specialDays[day] != 'AUA') return;
    const person = 'MAD' as const;
    const today = assertNonNull(result.day2person2info[day][person]);
    if (!today.shift) return;
    result.issues[generateIssueKey()] = {
      kind: 'mad-during-aua',
      startDay: day,
      message: `MAD is on call during AUA: ${shiftName(today)} on ${day}.`,
      isHard: false,
      elements: [elementIdForShift(day, today.shift)],
    };
  });

  // soft 4. no cross coverage
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      const call = data.shiftConfigs[today.shift].hospitals;
      if (today.rotation == 'Research') continue;
      if (today.rotation == 'Alaska') continue;
      if (today.rotation == 'NF') continue;
      if (today.rotation == 'OFF') continue;
      if (!call.includes(today.rotation)) {
        result.issues[generateIssueKey()] = {
          kind: 'cross-coverage',
          startDay: day,
          message: `Cross-coverage by ${person} on ${day}: Working at ${
            today.rotation
          }, but on call for ${shiftName(today)}.`,
          isHard: false,
          elements: [elementIdForShift(day, today.shift)],
        };
      }
    }
  });

  // soft 5. no call in 3rd trimester
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const config = data.people[person];
      if (!config.dueDate) continue;
      if (day >= nextDay(config.dueDate, -84) && day <= config.dueDate) {
        const today = assertNonNull(result.day2person2info[day][person]);
        if (!today.shift) continue;
        result.issues[generateIssueKey()] = {
          kind: 'third-trimester',
          startDay: day,
          message: `On-call during 3rd trimester: ${person} on call ${day} for ${shiftName(
            today,
          )}.`,
          isHard: false,
          elements: [elementIdForShift(day, today.shift)],
        };
      }
    }
  });

  // Count issues
  for (const issue of Object.values(result.issues)) {
    if ((ISSUE_KINDS_HARD as readonly string[]).includes(issue.kind)) {
      result.issueCounts.hard += 1;
    } else if ((ISSUE_KINDS_SOFT as readonly string[]).includes(issue.kind)) {
      result.issueCounts.soft += 1;
    }
  }

  // Count calls
  for (const [day, person2info] of Object.entries(result.day2person2info)) {
    for (const [p, info] of Object.entries(person2info)) {
      const person = p as Person;
      let callCount = result.callCounts[person];
      if (!callCount) {
        callCount = {
          weekday: 0,
          nf: 0,
          weekend: 0,
          holiday: 0,
        };
        result.callCounts[person] = callCount;
      }
      if (info.shift) {
        if ((WEEKDAY_SHIFTS as readonly string[]).includes(info.shift)) {
          callCount.weekday += 1;
        }
        if ((WEEKEND_SHIFTS as readonly string[]).includes(info.shift)) {
          callCount.weekend += 1;
        }
        if ((SPECIAL_SHIFTS as readonly string[]).includes(info.shift)) {
          callCount.holiday += 1;
        }
      }
      const dayOfWeek = dateToDayOfWeek(day);
      if (info.rotation == 'NF' && dayOfWeek != 'fri' && dayOfWeek != 'sun') {
        callCount.nf += 1;
        // if (p === 'MAD') console.log(day);
      }
    }
  }
  // Override MAD NF because there is weirdness with the last week not being a full week.
  if (result.callCounts.MAD?.nf == 11) {
    result.callCounts.MAD.nf = 10;
  }

  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const shift of Object.values(day.shifts)) {
        result.shiftCounts.total += 1;
        if (shift !== '' && shift !== undefined)
          result.shiftCounts.assigned += 1;
      }
    }
  }

  if (1 == 2 + 1) {
    console.log('Processing took', Date.now() - start, 'ms');
  }
  return result;
}

function generateIssueKey(): string {
  return uuid();
}

function forEveryDay(
  data: CallSchedule,
  callback: (day: IsoDate, date: Date) => void,
  stopNDaysBeforeEnd?: number,
) {
  let day = assertIsoDate(data.firstDay);
  const lastDate = isoDateToDate(assertIsoDate(data.lastDay));
  while (true) {
    const date = isoDateToDate(assertIsoDate(day));
    if (datefns.isAfter(date, lastDate)) break;
    if (stopNDaysBeforeEnd) {
      if (nextDay(day, stopNDaysBeforeEnd) > data.lastDay) break;
    }
    callback(day, date);
    day = nextDay(day);
  }
}
