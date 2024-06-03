import {
  IsoDate,
  assertNonNull,
  dateToIsoDatetime,
  deepCopy,
  lexicalCompare,
  mapEnum,
  mapEnumWithDefault,
  uuid,
} from 'check-type';
import {
  ALL_CHIEFS,
  ALL_PEOPLE,
  CALL_POOL,
  CallPoolPerson,
  CallSchedule,
  CallScheduleProcessed,
  ChiefShiftKind,
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
  isHolidayShift,
  isNoCallRotation,
} from './types';
import { assertIsoDate } from './check-type.generated';
import { dateToIsoDate, isoDateToDate } from './optimized';

export function clearSchedule(data: CallSchedule): CallSchedule {
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
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
        rating: Rating;
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
  const people = availablePeopleForShift(processed, date, shift).filter(
    p => data.people[p].year !== '2',
  );

  if (people.length == 0) {
    if (config?.enableLog) {
      console.log(`No candidates left for ${date}.`);
    }
    return empty;
  }

  const person2rating: {
    [Property in Person]?: {
      rating: Rating;
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
  const min = Array.from(Object.values(person2rating))
    .map(x => x.rating)
    .sort((a, b) => lexicalCompare(a, b))[0];
  const best = Object.entries(person2rating).filter(([, v]) =>
    ratingCompare(v.rating, min),
  );
  const randomWinner = best[Math.floor(Math.random() * best.length)];
  if (config?.enableLog) {
    console.log(
      `For ${date} picking a rating=${ratingToString(
        randomWinner[1].rating,
      )}: ${randomWinner[0]}`,
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

export type Rating = [number, number, number];
export function ratingMinus(a: Rating, b: Rating): Rating {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function ratingCompare(a: Rating, b: Rating): boolean {
  return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
}
export function ratingToString(r: Rating): string {
  return `(${r[0]},${r[1]},${r[2].toFixed(1)})`;
}
const RATE_CROSS_COVERAGE_AS_SOFT_RULE = true;
export function rate(
  _data: CallSchedule,
  processed: CallScheduleProcessed,
): Rating {
  let target = 0;
  for (const person of CALL_POOL) {
    {
      let field: 'weekend' | 'weekendOutsideMaternity' = 'weekend';
      if (person == 'LX') {
        field = 'weekendOutsideMaternity';
      }
      const currentWeekend = processed.callCounts[person].weekend;
      const correction =
        1 - processed.unassignedCalls[field] / processed.totalCalls[field];
      const targetWeekend = WEEKEND_CALL_TARGET[person] * correction;
      target += Math.abs(currentWeekend - targetWeekend);
    }
    {
      let field: 'weekday' | 'weekdayOutsideMaternity' = 'weekday';
      if (person == 'LX') {
        field = 'weekdayOutsideMaternity';
      }
      const currentWeekday = processed.callCounts[person].weekday;
      const correction =
        1 - processed.unassignedCalls[field] / processed.totalCalls[field];
      const targetWeekday = WEEKDAY_CALL_TARGET[person] * correction;
      target += Math.abs(currentWeekday - targetWeekday);
    }
  }
  if (!RATE_CROSS_COVERAGE_AS_SOFT_RULE) {
    return [
      processed.issueCounts.hard,
      processed.issueCounts.soft -
        (processed.issueCounts.softCrossCoverage ?? 0),
      100 * target + (processed.issueCounts.softCrossCoverage ?? 0),
    ];
  }
  return [processed.issueCounts.hard, processed.issueCounts.soft, target];
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
export function elementIdForShift(
  date: string,
  shift: ShiftKind | ChiefShiftKind,
): string {
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
  return day >= '2024-09-01' && day <= '2025-01-14';
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

export const WEEKDAY_CALL_TARGET: Record<CallPoolPerson, number> = {
  MAD: 2,
  // Seniors
  AA: 24,
  DC: 24,
  AJ: 24,
  // Research
  LX: 19,
  CC: 19,
  // Year 3
  MB: 23,
  RB: 22,
  MJ: 22,
  TM: 22,
  // Year 2
  GN: 11,
  KO: 11,
  CPu: 11,
  NR: 11,
};
export const WEEKEND_CALL_TARGET: Record<CallPoolPerson, number> = {
  MAD: 4, // +1 holiday
  // Seniors
  AA: 9,
  DC: 9,
  AJ: 8,
  // Research
  LX: 7, // 9, but 2 redistributed due to maternity leave
  CC: 9,
  // Year 3
  MB: 11,
  RB: 11,
  MJ: 11,
  TM: 11,
  // Year 2
  GN: 12,
  KO: 12,
  CPu: 12,
  NR: 12,
};

export function processCallSchedule(data: CallSchedule): CallScheduleProcessed {
  const start = Date.now();

  const PEOPLE = Object.keys(data.people) as Person[];

  const emptyBackupCallCount = {
    regular: {
      weekday: 0,
      weekend: 0,
      holiday: 0,
      holiday_hours: 0,
    },
    r2: {
      weekday: 0,
      weekend: 0,
      holiday: 0,
      holiday_hours: 0,
    },
  };

  const result: CallScheduleProcessed = {
    issues: {},
    day2person2info: {},
    day2hospital2people: {},
    issueCounts: {
      hard: 0,
      soft: 0,
      softCrossCoverage: 0,
    },
    day2isR2EarlyCall: {},
    callCounts: {
      MAD: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      // Seniors
      AA: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      DC: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      AJ: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      // Research
      LX: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      CC: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      // Year 3
      MB: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      RB: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      MJ: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      TM: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      // Year 2
      GN: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      KO: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      CPu: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
      NR: { weekday: 0, weekend: 0, sunday: 0, nf: 0 },
    },
    backupCallCounts: {
      LZ: deepCopy(emptyBackupCallCount),
      CP: deepCopy(emptyBackupCallCount),
      TW: deepCopy(emptyBackupCallCount),
      DK: deepCopy(emptyBackupCallCount),
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
    day2shift2isHoliday: {},
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
        onPriorityWeekend: false,
        isWorking: isWeekday(day),
        shifts: [],
        shifts2: [],
      };

      if (day == data.lastDay) break;
      day = nextDay(day);
    }
  }

  for (const person of CALL_POOL) {
    const priority = data.people[person].priorityWeekendSaturday;
    if (priority) {
      const priority2 = nextDay(priority, 1);
      assertNonNull(
        result.day2person2info[priority]?.[person],
      ).onPriorityWeekend = true;
      assertNonNull(
        result.day2person2info[priority2]?.[person],
      ).onPriorityWeekend = true;
      const priority3 = nextDay(priority, 2);
      if (data.holidays[priority3] !== undefined) {
        assertNonNull(
          result.day2person2info[priority3]?.[person],
        ).onPriorityWeekend = true;
      }
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
        vacationEnd = nextDay(vacationStart, vacation.length - 1);
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

        const shiftConfig = assertNonNull(data.shiftConfigs[shift]);
        for (let i = 0; i <= shiftConfig.days - 1; i++) {
          const info = result.day2person2info[nextDay(day.date, i)]?.[person];
          if (!info) continue;
          if (i == 0) info.shift = shift;
          info.isWorking = true;
        }

        for (let i = 0; i < shiftConfig.days; i++) {
          const nextD = nextDay(day.date, i);
          if (nextD > data.lastDay || nextD < data.firstDay) continue;
          const nextDayInfo = assertNonNull(
            result.day2person2info[nextD][person],
          );
          nextDayInfo.shifts.push({
            shift: shift,
            day: day.date,
          });
        }

        const lenDays = mapEnum(shift, {
          day_2x_nwhsch: 0,
          day_2x_uw: 0,
          day_uw: 0,
          day_va: 0,
          day_nwhsch: 0,
          weekday_south: 1,
          weekend_south: 3,
          weekend_uw: 3,
          weekend_nwhsch: 3,
          south_24: 1,
          south_34: 2,
          south_power: 3,
        });
        for (let i = 0; i < lenDays; i++) {
          const nextD = nextDay(day.date, i);
          if (nextD > data.lastDay || nextD < data.firstDay) continue;
          const nextDayInfo = assertNonNull(
            result.day2person2info[nextD][person],
          );
          nextDayInfo.shifts2.push({
            shift: shift,
            day: day.date,
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
        const shiftConfig = assertNonNull(data.shiftConfigs[shift]);
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
            const otherShifts = info.shifts;
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
        }
      }
    }
  }

  // Compute holiday shifts
  function shiftsOfDay(day: string): { day: string; shift: ShiftKind }[] {
    return (
      Object.keys(result.day2shift2unavailablePeople[day] || {}) as ShiftKind[]
    ).map(shift => ({ day, shift }));
  }
  for (const [date, holiday] of Object.entries(data.holidays)) {
    const dow = dateToDayOfWeek(date);
    const shifts: { day: string; shift: ShiftKind }[] = [];
    if (holiday == 'Indigenous Ppl') {
      shifts.push({
        day: date,
        shift: 'day_va',
      });
    } else if (holiday.includes('Thanksgiving')) {
      if (dow == 'thu') {
        shifts.push(...shiftsOfDay(nextDay(date, 0)));
        shifts.push(...shiftsOfDay(nextDay(date, 1)));
      }
    } else {
      switch (dow) {
        case 'mon':
          shifts.push(...shiftsOfDay(nextDay(date, -3)));
          shifts.push(...shiftsOfDay(nextDay(date, -1)));
          shifts.push(
            ...shiftsOfDay(nextDay(date, 0)).filter(
              x => x.shift !== 'weekday_south',
            ),
          );
          break;
        case 'wed':
        case 'thu':
          if (holiday == 'Christmas' || holiday == 'New Year') {
            shifts.push(...shiftsOfDay(nextDay(date, -1)));
          }
          shifts.push(...shiftsOfDay(nextDay(date, 0)));
          break;
        default:
          throw new Error(`Didn't expect a holiday on ${dow}`);
      }
    }

    for (const shift of shifts) {
      result.day2shift2isHoliday[shift.day] =
        result.day2shift2isHoliday[shift.day] ?? {};
      result.day2shift2isHoliday[shift.day][shift.shift] = holiday;
    }
  }

  function shiftName(info: DayPersonInfo | ShiftKind): string {
    if (typeof info == 'string')
      return assertNonNull(data.shiftConfigs[info]).name;
    if (!info.shift) throw new Error('No shift');
    return assertNonNull(data.shiftConfigs[info.shift]).name;
  }

  // Compute if the first NF is an R2
  const r2s = ALL_PEOPLE.filter(p => data.people[p].year == '2');
  for (const r2 of r2s) {
    let foundFirstNf = false;
    let exit = false;
    for (const week of data.weeks) {
      for (const day of week.days) {
        if (exit) break;
        const isNf = result.day2person2info[day.date][r2]?.rotation == 'NF';
        if (isNf) {
          foundFirstNf = true;
          result.day2isR2EarlyCall[day.date] = true;
        } else if (foundFirstNf) {
          exit = true;
        }
      }
    }
  }

  // Compute call of R2s in first 8 weeks
  const lastDayOfFirst8Weeks = nextDay(data.firstDay, 8 * 7 - 1);
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > lastDayOfFirst8Weeks) break;
      for (const person of Object.values(day.shifts)) {
        if ((r2s as string[]).includes(person)) {
          result.day2isR2EarlyCall[day.date] = true;
        }
      }
      // Also check for R2 shifts on any following days until a new backup shift starts
      for (let i = 1; i < 7; i++) {
        const index = result.day2weekAndDay[nextDay(day.date, i)];
        const nDay = data.weeks[index.weekIndex].days[index.dayIndex];
        if (Object.keys(nDay.backupShifts).length > 0) break;
        result.day2isR2EarlyCall[nDay.date] = true;
      }
    }
  }

  // Backup call counts
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
      for (const [s, person] of Object.entries(day.backupShifts)) {
        const shift = s as ChiefShiftKind;
        if (person == '') continue;
        const field = result.day2isR2EarlyCall[day.date] ? 'r2' : 'regular';
        switch (shift) {
          case 'backup_holiday':
            result.backupCallCounts[person][field].holiday += 1;
            let days = 1;
            for (let i = 1; i < 7; i++) {
              const index = result.day2weekAndDay[nextDay(day.date, i)];
              const nDay = data.weeks[index.weekIndex].days[index.dayIndex];
              if (Object.keys(nDay.backupShifts).length > 0) break;
              days += 1;
            }
            result.backupCallCounts[person][field].holiday_hours +=
              (days - 1) * 24 + 14;
            break;
          case 'backup_weekend':
            result.backupCallCounts[person][field].weekend += 1;
            break;
          case 'backup_weekday':
            result.backupCallCounts[person][field].weekday += 1;
            break;
        }
      }
    }
  }

  // hard 0a. no call on vacation or non-call rotations
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (day == '2024-06-30') continue;
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

  // hard 0a for backup
  forEveryDay(data, (day, _) => {
    for (const person of ALL_CHIEFS) {
      const index = result.day2weekAndDay[day];
      const dayInfo = data.weeks[index.weekIndex].days[index.dayIndex];
      if (!Object.values(dayInfo.backupShifts).includes(person)) continue;
      result.issues[generateIssueKey()] = {
        kind: 'rotation-without-call',
        startDay: day,
        message: `No backup call during vacation of ${person} on ${day}.`,
        isHard: true,
        elements: [elementIdForDay(day)],
      };
    }
  });

  // hard 0b: not multiple calls on same day
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      const shifts = today.shifts.filter(x => x.day == day);
      if (shifts.length > 1) {
        result.issues[generateIssueKey()] = {
          kind: 'consecutive-call',
          startDay: day,
          message: `Multiple call on ${day} for ${person}: ${shifts
            .map(x => shiftName(x.shift))
            .join(', ')}`,
          isHard: true,
          elements: shifts.map(s => elementIdForShift(s.day, s.shift)),
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
  // forEveryDay(
  //   data,
  //   (day, _) => {
  //     for (const person of PEOPLE) {
  //       const today = assertNonNull(result.day2person2info[day][person]);
  //       if (today.shifts.length <= 1) continue;
  //       // if (data.shiftConfigs[today.shift].days != 2) continue;
  //       // if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
  //       const texts = today.shifts.map(
  //         s => `${shiftName(s.shift)} on ${s.day}`,
  //       );
  //       const startDay = today.shifts.map(s => s.day).sort()[0] as IsoDate;
  //       result.issues[generateIssueKey()] = {
  //         kind: 'consecutive-call',
  //         startDay,
  //         message: `Consecutive call for ${person}: ${texts.join(', ')}`,
  //         isHard: true,
  //         elements: today.shifts.map(s => elementIdForShift(s.day, s.shift)),
  //       };
  //     }
  //   },
  //   1,
  // );
  forEveryDay(
    data,
    (day, _) => {
      for (const person of PEOPLE) {
        const today = assertNonNull(
          result.day2person2info[day][person],
        ).shifts2;
        const tomorrow = assertNonNull(
          result.day2person2info[nextDay(day)][person],
        ).shifts2.filter(
          t => !today.find(x => x.shift == t.shift && x.day == t.day),
        );

        if (today.length == 0 || tomorrow.length == 0) continue;

        const allShifts = [...today, ...tomorrow];
        const texts = allShifts.map(s => `${shiftName(s.shift)} on ${s.day}`);
        const startDay = today.map(s => s.day).sort()[0] as IsoDate;
        result.issues[generateIssueKey()] = {
          kind: 'consecutive-call',
          startDay,
          message: `Consecutive call for ${person}: ${texts.join(', ')}`,
          isHard: true,
          elements: allShifts.map(s => elementIdForShift(s.day, s.shift)),
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
    if (day > '2024-07-13') return;
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
    // Research residents can't violate this rule
    if (data.people[person].year == 'R') continue;
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

  // hard 6. priority weekend
  forEveryDay(data, (day, _) => {
    for (const person of CALL_POOL) {
      const info = result.day2person2info?.[day]?.[person];
      if (info && info.onPriorityWeekend) {
        if (info.shifts.length > 0) {
          result.issues[generateIssueKey()] = {
            kind: 'priority-weekend',
            startDay: nextDay(day, -1),
            message: `Priority weekend: ${person} on ${shiftName(
              info.shifts[0].shift,
            )} for ${day}`,
            isHard: true,
            elements: [elementIdForShift(day, info.shifts[0].shift)],
          };
        }
      }
    }
  });

  // hard 7. no weekend call before NF
  forEveryDay(data, (day, _) => {
    const dow = dateToDayOfWeek(day);
    if (dow != 'fri') return;
    for (const person of CALL_POOL) {
      const friday = result.day2person2info?.[day]?.[person];
      const monday = result.day2person2info?.[nextDay(day, 3)]?.[person];
      if (friday && monday) {
        if (
          friday.rotation != 'NF' &&
          monday.rotation == 'NF' &&
          friday.shift
        ) {
          result.issues[generateIssueKey()] = {
            kind: 'call-before-nf',
            startDay: day,
            message: `Call before NF for ${person} on ${day}`,
            isHard: true,
            elements: [elementIdForShift(day, friday.shift)],
          };
        }
      }
    }
  });

  // soft 1. every other weeknight call
  // forEveryDay(
  //   data,
  //   (day, _) => {
  //     const dayPlusOne = nextDay(day, 2);
  //     for (const person of PEOPLE) {
  //       const today = assertNonNull(result.day2person2info[day][person]);
  //       const tomorrow = assertNonNull(
  //         result.day2person2info[dayPlusOne][person],
  //       );
  //       if (!today.shift || !tomorrow.shift) continue;
  //       // if (data.shiftConfigs[today.shift].days != 2) continue;
  //       // if (data.shiftConfigs[tomorrow.shift].days != 2) continue;
  //       result.issues[generateIssueKey()] = {
  //         kind: 'almost-consecutive-call',
  //         startDay: day,
  //         message: `Two calls only 1 day apart: ${person} on call ${day} and ${dayPlusOne}`,
  //         isHard: false,
  //         elements: [
  //           elementIdForShift(day, today.shift),
  //           elementIdForShift(dayPlusOne, tomorrow.shift),
  //         ],
  //       };
  //     }
  //   },
  //   2,
  // );
  forEveryDay(
    data,
    (day, _) => {
      for (const person of PEOPLE) {
        const today = assertNonNull(
          result.day2person2info[day][person],
        ).shifts2;
        const tomorrow = assertNonNull(
          result.day2person2info[nextDay(day)][person],
        ).shifts2;
        const dayAfterTomorrow = assertNonNull(
          result.day2person2info[nextDay(day, 2)][person],
        ).shifts2.filter(
          t => !today.find(x => x.shift == t.shift && x.day == t.day),
        );

        if (
          !(
            today.length !== 0 &&
            tomorrow.length == 0 &&
            dayAfterTomorrow.length !== 0
          )
        )
          continue;

        const allShifts = [...today, ...dayAfterTomorrow];
        const texts = allShifts.map(s => `${shiftName(s.shift)} on ${s.day}`);
        const startDay = today.map(s => s.day).sort()[0] as IsoDate;
        result.issues[generateIssueKey()] = {
          kind: 'almost-consecutive-call',
          startDay,
          message: `Two calls only 1 day apart: ${person}: ${texts.join(', ')}`,
          isHard: false,
          elements: allShifts.map(s => elementIdForShift(s.day, s.shift)),
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
        if (assertNonNull(data.shiftConfigs[today.shift]).days < 3) continue;
        if (assertNonNull(data.shiftConfigs[nextWeekend.shift]).days < 3)
          continue;
        if (assertNonNull(data.shiftConfigs[nextNextWeekend.shift]).days < 3)
          continue;
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
      const call = assertNonNull(data.shiftConfigs[today.shift]).hospitals;
      if (today.rotation == 'Research') continue;
      if (today.rotation == 'Alaska') continue;
      if (today.rotation == 'NF') continue;
      if (today.rotation == 'OFF') continue;
      const rotationHospitals: HospitalKind[] =
        today.rotation == 'Andro' ? ['UW', 'NWH'] : [today.rotation];

      // for seniors we don't consider cross-call during weekdays, because they have way to much
      // call and way too little time in south.
      if (data.people[person].year == 'S' && today.shift == 'weekday_south') {
        continue;
      }
      // don't consider north to south coverage
      if (
        call.every(c => c == 'HMC' || c == 'VA') &&
        rotationHospitals.every(h => h == 'NWH' || h == 'UW' || h == 'SCH')
      )
        continue;
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
      if (isLxNotTakingCallDueToMaternity(day)) {
        const today = assertNonNull(result.day2person2info[day][person]);
        if (!today.shift) continue;
        result.issues[generateIssueKey()] = {
          kind: 'maternity',
          startDay: day,
          message: `On-call during maternity: ${person} on call ${day} for ${shiftName(
            today,
          )}.`,
          isHard: true,
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
      if (
        issue.kind == 'cross-coverage' &&
        result.issueCounts.softCrossCoverage !== undefined
      ) {
        result.issueCounts.softCrossCoverage += 1;
      }
    }
  }

  // Count calls
  for (const [day, person2info] of Object.entries(result.day2person2info)) {
    const dayOfWeek = dateToDayOfWeek(day);
    for (const [p, info] of Object.entries(person2info)) {
      const person = p as CallPoolPerson;
      if (!(person in result.callCounts)) continue;
      const callCount = result.callCounts[person];
      if (info.shift) {
        if (isHolidayShift(result, day, info.shift)) continue;
        if (info.shift in WEEKDAY_SHIFT_LOOKUP) {
          if (dayOfWeek == 'sun') {
            callCount.sunday += 1;
          } else {
            callCount.weekday += 1;
          }
        } else if (info.shift in WEEKEND_SHIFT_LOOKUP) {
          callCount.weekend += 1;
        }
      }
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
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
      for (const [s, person] of Object.entries(day.shifts)) {
        const shift = s as ShiftKind;
        const isMaternity = isLxNotTakingCallDueToMaternity(day.date);
        if (isHolidayShift(result, day.date, shift)) continue;
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

  // count shifts
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
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

  // 6. soft: don't go over call targets
  for (const person of CALL_POOL) {
    const callCount = result.callCounts[person];
    if (callCount.weekday > WEEKDAY_CALL_TARGET[person]) {
      result.issues[generateIssueKey()] = {
        kind: 'over-call-target',
        startDay: data.firstDay as IsoDate,
        message: `Over weekday call target: ${person} has ${callCount.weekday} calls, target is ${WEEKDAY_CALL_TARGET[person]}.`,
        isHard: false,
        elements: [],
      };
    }
    if (callCount.weekend > WEEKEND_CALL_TARGET[person]) {
      result.issues[generateIssueKey()] = {
        kind: 'over-call-target',
        startDay: data.firstDay as IsoDate,
        message: `Over weekend call target: ${person} has ${callCount.weekend} calls, target is ${WEEKEND_CALL_TARGET[person]}.`,
        isHard: false,
        elements: [],
      };
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

export function yearToColor(
  year: string | undefined,
  dark: boolean = false,
): string {
  const color = mapEnumWithDefault(
    year as string,
    {
      R: '#baffc9', // green
      '2': '#ffffba', // yellow
      '3': '#ffdfba', // orange
      S: '#ffb3ba', // red
      M: '#bae1ff', // blue
    },
    '#ccc',
  );
  if (dark) return shadeColor(color, -20);
  return color;
}

export function shadeColor(color: string, percent: number) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = (R * (100 + percent)) / 100;
  G = (G * (100 + percent)) / 100;
  B = (B * (100 + percent)) / 100;

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  R = Math.round(R);
  G = Math.round(G);
  B = Math.round(B);

  const RR = R.toString(16).length == 1 ? '0' + R.toString(16) : R.toString(16);
  const GG = G.toString(16).length == 1 ? '0' + G.toString(16) : G.toString(16);
  const BB = B.toString(16).length == 1 ? '0' + B.toString(16) : B.toString(16);

  return '#' + RR + GG + BB;
}

export type HolidayShift = {
  shift: ShiftKind;
  day: string;
  holiday: string;
};

export function countHolidayShifts(holidayShifts: HolidayShift[]): {
  calls: number;
  hours: number;
} {
  let hours = 0;
  let calls = 0;
  for (const holidayShift of holidayShifts) {
    switch (holidayShift.shift) {
      case 'day_uw':
      case 'day_nwhsch':
      case 'weekday_south':
        calls += 1;
        hours += 10;
        break;
      case 'weekend_south':
      case 'weekend_uw':
      case 'weekend_nwhsch':
        calls += 1;
        hours += 48;
        break;
      case 'day_2x_uw':
      case 'day_2x_nwhsch':
        calls += 1;
        hours += 20;
        break;
      case 'south_24':
        calls += 1;
        hours += 24;
        break;
      case 'south_34':
        calls += 1;
        hours += 34;
        break;
      case 'south_power':
        calls += 1;
        hours += 60;
        break;
      case 'day_va':
        calls += 1;
        hours += 10;
      // case 'power_uw':
      // case 'power_nwhsch':
      // case 'power_south':
      //   calls += 1;
      //   hours += 60;
      //   break;
    }
  }
  return { calls, hours };
}

export function collectHolidayCall(
  person: Person,
  data: CallSchedule,
  processed: CallScheduleProcessed,
): HolidayShift[] {
  const holidayCalls: HolidayShift[] = [];
  for (const day in processed.day2shift2isHoliday) {
    const index = processed.day2weekAndDay[day];
    for (const s in processed.day2shift2isHoliday[day]) {
      const shift = s as ShiftKind;
      const personOnCall =
        data.weeks[index.weekIndex].days[index.dayIndex].shifts[shift];
      if (personOnCall == person) {
        const holiday = assertNonNull(
          processed.day2shift2isHoliday[day][shift],
        );
        holidayCalls.push({
          shift,
          day,
          holiday,
        });
      }
    }
  }
  return holidayCalls;
}
