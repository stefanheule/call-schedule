import { IsoDate, assertNonNull, dateToIsoDatetime, uuid } from 'check-type';
import {
  CALL_POOL,
  CallPoolPerson,
  CallSchedule,
  CallScheduleProcessed,
  DayPersonInfo,
  HospitalKind,
  ISSUE_KINDS_HARD,
  ISSUE_KINDS_SOFT,
  Person,
  ShiftKind,
  StoredCallSchedule,
  UnavailablePeople,
  WEEKDAY_SHIFT_LOOKUP,
  WEEKEND_SHIFT_LOOKUP,
  isNoCallRotation,
} from './types';
import { assertIsoDate } from './check-type.generated';
import { dateToIsoDate, isoDateToDate } from './optimized';

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

export function availablePeopleForShift(
  processed: CallScheduleProcessed,
  date: IsoDate,
  shift: ShiftKind,
): readonly CallPoolPerson[] {
  const unavailablePeople =
    processed.day2shift2unavailablePeople?.[date]?.[shift];
  if (!unavailablePeople) return CALL_POOL;
  return CALL_POOL.filter(p => unavailablePeople[p] == undefined);
}

export type InferenceResult = {
  best?: {
    person: CallPoolPerson;
    processed: CallScheduleProcessed;
    ratings: {
      [Property in Person]?: {
        rating: number;
        processed: CallScheduleProcessed;
      };
    };
  };
  unavailablePeople: UnavailablePeople;
};

export function inferShift(
  data: CallSchedule,
  processed: CallScheduleProcessed,
  date: IsoDate,
  shift: ShiftKind,
  config?: { enableLog?: boolean; skipUnavailablePeople?: boolean },
): InferenceResult {
  const dayAndWeek = processed.day2weekAndDay[date];
  const unavailablePeople =
    processed.day2shift2unavailablePeople?.[date]?.[shift] || {};
  const empty = {
    unavailablePeople,
  };
  if (dayAndWeek === undefined) {
    return empty;
  }
  const day = data.weeks[dayAndWeek.weekIndex].days[dayAndWeek.dayIndex];
  const people = availablePeopleForShift(processed, date, shift);

  if (people.length == 0) {
    if (config?.enableLog) {
      console.log(`No candidates left for ${date}.`);
    }
    return empty;
  }

  const person2rating: {
    [Property in Person]?: {
      rating: number;
      processed: CallScheduleProcessed;
    };
  } = {};
  const oldPerson = day.shifts[shift];
  for (const p of people) {
    day.shifts[shift] = p;
    const processed2 = processCallSchedule(data);
    person2rating[p] = {
      rating: rate(data, processed2),
      processed: processed2,
    };

    // Compute unavailablePeople
    if (config?.skipUnavailablePeople !== true) {
      if (
        processed2.issueCounts.hard > processed.issueCounts.hard &&
        unavailablePeople[p] === undefined
      ) {
        unavailablePeople[p] = {
          soft: false,
          reason: 'Hard rule violation',
        };
      } else if (
        processed2.issueCounts.hard == processed.issueCounts.hard &&
        processed2.issueCounts.soft > processed.issueCounts.soft
      ) {
        unavailablePeople[p] = {
          soft: true,
          reason: 'Soft rule violation',
        };
      }
    }
  }
  day.shifts[shift] = oldPerson;
  const min = Math.min(
    ...Array.from(Object.values(person2rating)).map(x => x.rating),
  );
  const best = Object.entries(person2rating).filter(
    ([, v]) => v.rating === min,
  );
  const randomWinner = best[Math.floor(Math.random() * best.length)];
  if (config?.enableLog) {
    console.log(
      `For ${date} picking a rating=${randomWinner[1].rating}: ${randomWinner[0]}`,
    );
  }
  return {
    best: {
      person: randomWinner[0] as CallPoolPerson,
      processed: randomWinner[1].processed,
      ratings: person2rating,
    },
    unavailablePeople,
  };
}

export function inferSchedule(data: CallSchedule): CallSchedule {
  let processed = processCallSchedule(data);
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date < data.firstDay || day.date > data.lastDay) continue;
      for (const s of Object.keys(day.shifts)) {
        const shift = s as ShiftKind;
        const inference = inferShift(data, processed, day.date, shift, {
          enableLog: true,
        });
        if (inference.best) {
          day.shifts[shift] = inference.best.person;
          processed = inference.best.processed;
        }
      }
    }
  }

  return data;
}

export function rate(_data: CallSchedule, processed: CallScheduleProcessed) {
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

// function isoDateToDate(date: IsoDate): Date {
//   const parts = date.split('-').map(x => parseInt(x));
//   return new Date(parts[0], parts[1] - 1, parts[2]);
// }

// function dateToIsoDate(date: Date): IsoDate {
//   return `${date.getFullYear()}-${date.getMonth() + 1 > 9 ? '' : '0'}${
//     date.getMonth() + 1
//   }-${date.getDate() > 9 ? '' : '0'}${date.getDate()}` as IsoDate;
// }

const _nextDayCache: Record<string, Record<number, IsoDate>> = {};
export function nextDay(day: string, n: number = 1): IsoDate {
  if (day in _nextDayCache && n in _nextDayCache[day]) {
    return _nextDayCache[day][n];
  }
  const date = isoDateToDate(day as IsoDate);
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  const result = dateToIsoDate(next);
  if (!(day in _nextDayCache)) _nextDayCache[day] = {};
  _nextDayCache[day][n] = result;
  return result;
}

function isWeekday(day: string): boolean {
  const date = isoDateToDate(day as IsoDate);
  return date.getDay() != 0 && date.getDay() != 6;
}

function isLxNotTakingCallDueToMaternity(day: string): boolean {
  return day >= '2024-09-01' && day <= '2025-01-22'
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
    callCounts: {
      MAD: { weekday: 0, weekend: 0, nf: 0 },
      // Seniors
      AA: { weekday: 0, weekend: 0, nf: 0 },
      DC: { weekday: 0, weekend: 0, nf: 0 },
      AJ: { weekday: 0, weekend: 0, nf: 0 },
      // Research
      LX: { weekday: 0, weekend: 0, nf: 0 },
      CC: { weekday: 0, weekend: 0, nf: 0 },
      // Year 3
      MB: { weekday: 0, weekend: 0, nf: 0 },
      RB: { weekday: 0, weekend: 0, nf: 0 },
      MJ: { weekday: 0, weekend: 0, nf: 0 },
      TM: { weekday: 0, weekend: 0, nf: 0 },
      // Year 2
      GN: { weekday: 0, weekend: 0, nf: 0 },
      KO: { weekday: 0, weekend: 0, nf: 0 },
      CPu: { weekday: 0, weekend: 0, nf: 0 },
      NR: { weekday: 0, weekend: 0, nf: 0 },
    },
    shiftCounts: {
      total: 0,
      assigned: 0,
    },
    element2issueKind: {},
    day2weekAndDay: {},
    day2shift2unavailablePeople: {},
    unassignedCalls: {
      weekend: 0,
      weekday: 0,
      weekendOutsideMaternity: 0,
      weekdayOutsideMaternity: 0,
    },
    totalCalls: {
      weekend: 0,
      weekday: 0,
      weekendOutsideMaternity: 0,
      weekdayOutsideMaternity: 0,
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
      result.day2person2info[day] = result.day2person2info[day] || {};
      const dayInfo = result.day2person2info[day];
      dayInfo[person] = {
        rotation: rotation.rotation,
        rotationDetails: {
          chief: rotation.chief,
        },
        onVacation: false,
        isWorking: isWeekday(day),
        shifts: [],
      };

      if (day == data.lastDay) break;
      day = nextDay(day);
    }
  }

  // Compute vacations
  for (const [person, vacations] of Object.entries(data.vacations)) {
    for (const vacation of vacations) {
      let vacationStart, vacationEnd;
      if (typeof vacation == 'string') {
        const vacationMonday = vacation;
        vacationStart = nextDay(vacationMonday, -2);
        vacationEnd = nextDay(vacationMonday, 6);
      } else {
        vacationStart = vacation.start;
        vacationEnd = nextDay(vacationStart, vacation.length);
        if (dateToDayOfWeek(vacationStart) == 'mon') {
          vacationStart = nextDay(vacationStart, -2);
        }
        if (dateToDayOfWeek(vacationEnd) == 'fri') {
          vacationEnd = nextDay(vacationEnd, 2);
        }
      }
      for (let day = vacationStart; day <= vacationEnd; day = nextDay(day)) {
        const dayInfo = assertNonNull(result.day2person2info[day]);
        const personInfo = assertNonNull(dayInfo[person as Person]);
        personInfo.onVacation = true;
        personInfo.isWorking = false;
      }
    }
  }

  // Set isWorking to true for on-call
  data.weeks.forEach((week, weekIndex) => {
    week.days.forEach((day, dayIndex) => {
      result.day2weekAndDay[day.date] = {
        weekIndex,
        dayIndex,
      };
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

        // Almost all shifts are at least 2 days, but there are some holiday day shifts.
        // To make sure we don't let people be on day shift and then on call again the next day,
        // we just pretend day shifts are 2 days also.
        for (let i = 0; i < Math.max(2, shiftConfig.days); i++) {
          const nextD = nextDay(day.date, i);
          if (nextD > data.lastDay || nextD < data.firstDay) continue;
          const nextDayInfo = assertNonNull(
            result.day2person2info[nextD][person],
          );
          nextDayInfo.shifts.push({
            shift: shift,
            day: day.date,
            isFakeEntry: i >= shiftConfig.days,
          });
        }
      }
    });
  });

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

  // Compute who can take a shift potentially
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
      result.day2shift2unavailablePeople[day.date] = {};
      for (const s of Object.keys(day.shifts)) {
        const shift = s as ShiftKind;
        const shiftConfig = data.shiftConfigs[shift];
        const unavailablePeople: {
          [Property in Person]?: {
            reason: string;
            soft: boolean;
          };
        } = {};
        result.day2shift2unavailablePeople[day.date][shift] = unavailablePeople;
        for (const person of PEOPLE) {
          let hardReason = undefined;
          for (let i = 0; i < shiftConfig.days; i++) {
            const nextD = nextDay(day.date, i);
            if (nextD > data.lastDay || nextD < data.firstDay) continue;
            const info = assertNonNull(result.day2person2info[nextD][person]);
            const otherShifts = info.shifts.filter(s => !s.isFakeEntry);
            if (info.onVacation) {
              hardReason = `on vacation`;
              break;
            } else if (isNoCallRotation(info.rotation)) {
              hardReason = `is on ${info.rotation}`;
              break;
            } else if (otherShifts.length > 0) {
              hardReason = `already on call for ${otherShifts
                .map(s => shiftName(s.shift) + ' on ' + s.day)
                .join(', ')}`;
              break;
            }
          }

          if (hardReason) {
            unavailablePeople[person] = {
              reason: hardReason,
              soft: false,
            };
          }
          // } else {
          //   const info = assertNonNull(
          //     result.day2person2info[day.date][person],
          //   );
          //   if (
          //     !isNoCallRotation(info.rotation) &&
          //     info.rotation !== 'Research'
          //   ) {
          //     const rotationHospitals: HospitalKind[] =
          //       info.rotation == 'Andro' ? ['UW', 'NWH'] : [info.rotation];
          //     if (
          //       shiftConfig.hospitals.every(c => !rotationHospitals.includes(c))
          //     ) {
          //       unavailablePeople[person] = {
          //         reason: `cross-coverage: working at ${info.rotation}`,
          //         soft: true,
          //       };
          //     }
          //   }
          // }
        }
      }
    }
  }

  function shiftName(info: DayPersonInfo | ShiftKind): string {
    if (typeof info == 'string') return data.shiftConfigs[info].name;
    if (!info.shift) throw new Error('No shift');
    return data.shiftConfigs[info.shift].name;
  }

  // hard 0. no illegal calls
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shifts) continue;
      if (isNoCallRotation(today.rotation) || today.onVacation) {
        for (const shift of today.shifts) {
          result.issues[generateIssueKey()] = {
            kind: 'rotation-without-call',
            startDay: day,
            message: `No call during ${
              today.onVacation ? 'vacation' : today.rotation
            }: ${person} is on call for ${shiftName(shift.shift)}.`,
            isHard: true,
            elements: [elementIdForShift(shift.day, shift.shift)],
          };
        }
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
      const rotationHospitals: HospitalKind[] =
        today.rotation == 'Andro' ? ['UW', 'NWH'] : [today.rotation];
      if (call.every(c => !rotationHospitals.includes(c))) {
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
      const person = p as CallPoolPerson;
      if (!(person in result.callCounts)) continue;
      const callCount = result.callCounts[person];
      if (info.shift) {
        if (info.shift in WEEKDAY_SHIFT_LOOKUP) {
          callCount.weekday += 1;
        } else if (info.shift in WEEKEND_SHIFT_LOOKUP) {
          callCount.weekend += 1;
        }
      }
      const dayOfWeek = dateToDayOfWeek(day);
      if (info.rotation == 'NF' && dayOfWeek != 'fri' && dayOfWeek != 'sun') {
        callCount.nf += 1;
      }
    }
  }
  // Override MAD NF because there is weirdness with the last week not being a full week.
  if (result.callCounts.MAD?.nf == 11) {
    result.callCounts.MAD.nf = 10;
  }

  // Calculate call targets
  // let totalWeekday = 0;
  // let totalWeekend = 0;
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const [s, person] of Object.entries(day.shifts)) {
        const shift = s as ShiftKind;
        const isMaternity = isLxNotTakingCallDueToMaternity(day.date);
        if (shift in WEEKDAY_SHIFT_LOOKUP) {
          if (!person) {
            result.unassignedCalls.weekday += 1;
            if (!isMaternity) {
              result.unassignedCalls.weekdayOutsideMaternity += 1;
            }
          }
          result.totalCalls.weekday += 1;
          if (!isMaternity) {
            result.totalCalls.weekdayOutsideMaternity += 1;
          }
        } else if (shift in WEEKEND_SHIFT_LOOKUP) {
          if (!person) {
            result.unassignedCalls.weekend += 1;
            if (!isMaternity) {
              result.unassignedCalls.weekendOutsideMaternity += 1;
            }
          }
          result.totalCalls.weekend += 1;
          if (!isMaternity) {
            result.totalCalls.weekendOutsideMaternity += 1;
          }
        }
      }
    }
  }
  console.log({
    unassignedCall: result.unassignedCalls,
    totalCalls: result.totalCalls,
  })
  // {totalWeekday: 254, totalWeekend: 159}
  const weekdayTarget: Record<CallPoolPerson, number> = {
    MAD: 2,
    // Seniors
    AA: 24,
    DC: 25,
    AJ: 25,
    // Research
    LX: 19,
    CC: 19,
    // Year 3
    MB: 24,
    RB: 24,
    MJ: 24,
    TM: 24,
    // Year 2
    GN: 11,
    KO: 11,
    CPu: 11,
    NR: 11,
  };
  const weekendTarget: Record<CallPoolPerson, number> = {
    MAD: 1,
    // Seniors
    AA: 9,
    DC: 9,
    AJ: 9,
    // Research
    LX: 8, // 10, but 2 redistributed due to maternity leave
    CC: 11,
    // Year 3
    MB: 13,
    RB: 13,
    MJ: 13,
    TM: 13,
    // Year 2
    GN: 15,
    KO: 15,
    CPu: 15,
    NR: 15,
  };
  // if (
  //   totalWeekday !=
  //   weekdayTarget.MAD +
  //     weekdayTarget.AA +
  //     weekdayTarget.DC +
  //     weekdayTarget.AJ +
  //     weekdayTarget.LX +
  //     weekdayTarget.CC +
  //     weekdayTarget.MB +
  //     weekdayTarget.RB +
  //     weekdayTarget.MJ +
  //     weekdayTarget.TM +
  //     weekdayTarget.GN +
  //     weekdayTarget.KO +
  //     weekdayTarget.CPu +
  //     weekdayTarget.NR
  // ) {
  //   console.error(
  //     'Total weekday call count is off:',
  //     totalWeekday,
  //     weekdayTarget.MAD +
  //       weekdayTarget.AA +
  //       weekdayTarget.DC +
  //       weekdayTarget.AJ +
  //       weekdayTarget.LX +
  //       weekdayTarget.CC +
  //       weekdayTarget.MB +
  //       weekdayTarget.RB +
  //       weekdayTarget.MJ +
  //       weekdayTarget.TM +
  //       weekdayTarget.GN +
  //       weekdayTarget.KO +
  //       weekdayTarget.CPu +
  //       weekdayTarget.NR,
  //   );
  // }
  // if (
  //   totalWeekend !=
  //   weekendTarget.MAD +
  //     weekendTarget.AA +
  //     weekendTarget.DC +
  //     weekendTarget.AJ +
  //     weekendTarget.LX +
  //     weekendTarget.CC +
  //     weekendTarget.MB +
  //     weekendTarget.RB +
  //     weekendTarget.MJ +
  //     weekendTarget.TM +
  //     weekendTarget.GN +
  //     weekendTarget.KO +
  //     weekendTarget.CPu +
  //     weekendTarget.NR
  // ) {
  //   console.error(
  //     'Total weekend call count is off:',
  //     totalWeekend,
  //     weekendTarget.MAD +
  //       weekendTarget.AA +
  //       weekendTarget.DC +
  //       weekendTarget.AJ +
  //       weekendTarget.LX +
  //       weekendTarget.CC +
  //       weekendTarget.MB +
  //       weekendTarget.RB +
  //       weekendTarget.MJ +
  //       weekendTarget.TM +
  //       weekendTarget.GN +
  //       weekendTarget.KO +
  //       weekendTarget.CPu +
  //       weekendTarget.NR,
  //   );
  // }

  // count shifts
  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const shift of Object.values(day.shifts)) {
        result.shiftCounts.total += 1;
        if (shift !== '' && shift !== undefined)
          result.shiftCounts.assigned += 1;
      }
    }
  }

  // process issues into map
  for (const issue of Object.values(result.issues)) {
    for (const id of issue.elements) {
      const prev = result.element2issueKind[id];
      const next = issue.isHard ? 'hard' : 'soft';

      if (prev == 'hard' || next == 'hard') {
        result.element2issueKind[id] = 'hard';
      } else {
        result.element2issueKind[id] = 'soft';
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
  if (stopNDaysBeforeEnd === undefined) stopNDaysBeforeEnd = 0;
  let day = data.firstDay as IsoDate;
  while (true) {
    const date = isoDateToDate(day);
    if (nextDay(day, stopNDaysBeforeEnd) > data.lastDay) break;
    callback(day, date);
    day = nextDay(day);
  }
}
