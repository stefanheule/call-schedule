import {
  IsoDate,
  assertNonNull,
  dateToIsoDatetime,
  deepCopy,
  lexicalCompare,
  mapEnumWithDefault,
} from './common/check-type';
import {
  Action,
  CallPoolPerson,
  CallSchedule,
  CallScheduleProcessed,
  BackupShiftKind,
  DayPersonInfo,
  Hospital,
  ISSUE_KINDS_HARD,
  ISSUE_KINDS_SOFT,
  Issue,
  Person,
  ShiftKind,
  StoredCallSchedule,
  UnavailablePeople,
  allChiefs,
  allPeople,
  callPoolPeople,
  isHolidayShift,
  isNoCallRotation,
  Day,
} from './types';
import {
  assertIsoDate,
  assertMaybeCallPoolPerson,
  assertMaybeChief,
} from './check-type.generated';
import { dateToIsoDate, isoDateToDate } from './optimized';
import * as datefns from 'date-fns';
import { validateData } from './validate';

export function clearSchedule(data: CallSchedule): CallSchedule {
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
      for (const shift of Object.keys(day.shifts)) {
        day.shifts[shift] = '';
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
  if (!unavailablePeople) return callPoolPeople(processed.data);
  return callPoolPeople(processed.data).filter(
    p => unavailablePeople[p] == undefined,
  );
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

function addIssue(processed: CallScheduleProcessed, issue: Issue) {
  const elements = issue.elements.join('_');
  const key = `${issue.kind}_[${elements}]_${issue.message}`;
  if (key in processed.issues) {
    return;
  }
  processed.issues[key] = issue;
}

export async function inferShiftAsync(
  data: CallSchedule,
  processed: CallScheduleProcessed,
  date: IsoDate,
  shift: ShiftKind,
  config?: { enableLog?: boolean; skipUnavailablePeople?: boolean, log?: (s: string) => void },
): Promise<InferenceResult> {
  return new Promise(resolve => {
    resolve(inferShift(data, processed, date, shift, config));
  });
}

export function inferShift(
  data: CallSchedule,
  processed: CallScheduleProcessed,
  date: IsoDate,
  shift: ShiftKind,
  config?: { enableLog?: boolean; skipUnavailablePeople?: boolean, log?: (s: string) => void },
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
    if (config?.log) {
      config.log(`No candidates left for ${date}.`);
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

    function collectNewIssues(
      before: CallScheduleProcessed,
      after: CallScheduleProcessed,
      hard: boolean,
    ) {
      const result = [];
      for (const [issueKeyAfter, issueAfter] of Object.entries(after.issues)) {
        if (issueAfter.isHard !== hard) continue;
        if (!(issueKeyAfter in before.issues)) {
          result.push(issueAfter.message);
        }
      }
      return result;
    }

    // Compute unavailablePeople
    if (config?.skipUnavailablePeople !== true) {
      if (
        processed2.issueCounts.hard > processed.issueCounts.hard &&
        unavailablePeople[p] === undefined
      ) {
        unavailablePeople[p] = {
          soft: false,
          reason: `Hard: ${collectNewIssues(processed, processed2, true).join(
            ', ',
          )}`,
        };
      } else if (
        processed2.issueCounts.hard == processed.issueCounts.hard &&
        processed2.issueCounts.soft > processed.issueCounts.soft
      ) {
        unavailablePeople[p] = {
          soft: true,
          reason: `Soft: ${collectNewIssues(processed, processed2, false).join(
            ', ',
          )}`,
        };
      }
    }
  }
  day.shifts[shift] = oldPerson;
  const min = Array.from(Object.values(person2rating))
    .map(x => assertNonNull(x).rating)
    .sort((a, b) => lexicalCompare(a, b))[0];
  const best = Object.entries(person2rating).filter(([, v]) =>
    ratingCompare(assertNonNull(v).rating, min),
  );
  const randomWinner = best[Math.floor(Math.random() * best.length)];
  const logMessage = `For ${date} picking a rating=${ratingToString(
    assertNonNull(randomWinner[1]).rating,
  )}: ${randomWinner[0]}`;
  if (config?.enableLog) {
    console.log(logMessage);
  }
  if (config?.log) {
    config.log(logMessage);
  }
  return {
    best: {
      person: randomWinner[0],
      processed: assertNonNull(randomWinner[1]).processed,
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
      for (const shift of Object.keys(day.shifts)) {
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
  data: CallSchedule,
  processed: CallScheduleProcessed,
): Rating {
  let target = 0;
  for (const person of callPoolPeople(data)) {
    const personConfig = data.people[person];
    {
      const field: 'weekend' | 'weekendOutsideMaternity' = 'weekend';
      // if (person == 'LL') {
      //   field = 'weekendOutsideMaternity';
      // }
      const currentWeekend = processed.callCounts[person].weekend;
      const correction =
        1 - processed.unassignedCalls[field] / processed.totalCalls[field];
      const targetWeekend =
        data.callTargets.weekend[personConfig.year][person] * correction;
      target += Math.abs(currentWeekend - targetWeekend);
    }
    {
      const field: 'weekday' | 'weekdayOutsideMaternity' = 'weekday';
      // if (person == 'LL') {
      //   field = 'weekdayOutsideMaternity';
      // }
      const currentWeekday = processed.callCounts[person].weekday;
      const correction =
        1 - processed.unassignedCalls[field] / processed.totalCalls[field];
      const targetWeekday =
        data.callTargets.weekday[personConfig.year][person] * correction;
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

export function diffIssues(
  before: CallScheduleProcessed,
  after: CallScheduleProcessed,
): Record<string, Issue> {
  const result: Record<string, Issue> = {};
  for (const [key, issue] of Object.entries(after.issues)) {
    if (!(key in before.issues)) {
      result[key] = issue;
    }
  }
  return result;
}

export function scheduleToStoredSchedule(
  data: CallSchedule,
  name: string,
  lastEditedBy: string,
): StoredCallSchedule {
  validateData(data);
  const processed = processCallSchedule(data);
  data.lastEditedBy = lastEditedBy;
  data.lastEditedAt = dateToIsoDatetime(new Date());
  return {
    name,
    lastEditedBy: data.lastEditedBy,
    ts: data.lastEditedAt,
    callSchedule: data,
    issueCounts: processed.issueCounts,
    shiftCounts: processed.shiftCounts,
    backupShiftCounts: processed.backupShiftCounts,
  };
}

export function elementIdForDay(date: string): string {
  return `day-${date}`;
}
export function elementIdForShift(
  date: string,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
  shift: ShiftKind | BackupShiftKind,
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

export function findDay(data: CallSchedule, date: IsoDate): Day | undefined {
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date == date) return day;
    }
  }
  return undefined;
}

function isWeekday(day: string): boolean {
  const date = isoDateToDate(day as IsoDate);
  return date.getDay() != 0 && date.getDay() != 6;
}

export function applyActions(
  data: CallSchedule,
  actions: Action[],
): CallSchedule {
  // First apply all actions that clear something.
  for (const action of actions) {
    const day = data.weeks[action.shift.weekIndex].days[action.shift.dayIndex];
    if (action.next == '?') {
      if (action.kind == 'regular') {
        day.shifts[action.shift.shiftName] = '';
      } else {
        day.backupShifts[action.shift.shiftName] = '';
      }
    }
  }
  // Then apply all actions that set something.
  for (const action of actions) {
    const day = data.weeks[action.shift.weekIndex].days[action.shift.dayIndex];
    if (action.next == '?') continue;
    if (action.kind == 'regular') {
      day.shifts[action.shift.shiftName] = action.next;
    } else {
      day.backupShifts[action.shift.shiftName] = action.next;
    }
  }
  return data;
}

export function undoActions(data: CallSchedule, actions: Action[]) {
  for (const action of actions) {
    const day = data.weeks[action.shift.weekIndex].days[action.shift.dayIndex];
    if (action.kind == 'regular') {
      day.shifts[action.shift.shiftName] = action.previous;
    } else {
      day.backupShifts[action.shift.shiftName] = action.previous;
    }
  }
  return data;
}

export function serializePerson(s: string) {
  return s == '' ? 'nobody' : s;
}
export function deserializePerson(s: string): string {
  return s == 'nobody' ? '' : s;
}
export function serializeShift(
  data: CallSchedule,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
  s: ShiftKind | BackupShiftKind,
) {
  if (s in data.shiftConfigs) {
    return data.shiftConfigs[s].nameLong;
  }
  return assertNonNull(data.chiefShiftConfigs[s]).nameLong;
}
export function deserializeShift(
  data: CallSchedule,
  s: string,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
): ShiftKind | BackupShiftKind {
  for (const [k, v] of Object.entries(data.shiftConfigs)) {
    if (v.nameLong == s) return k;
  }
  for (const [k, v] of Object.entries(data.chiefShiftConfigs)) {
    if (v.nameLong == s) return k;
  }
  throw new Error(`Invalid shift: ${s}`);
}
export function serializeDate(d: IsoDate) {
  return datefns.format(isoDateToDate(d), 'eee M/d/yyyy');
}
export function serializeActions(
  data: CallSchedule,
  actions: Action[],
): string {
  return actions
    .map(
      (change, i) =>
        `${i + 1}. Replace ${serializePerson(
          change.previous,
        )} with ${serializePerson(change.next)} for ${serializeShift(
          data,
          change.shift.shiftName,
        )} on ${serializeDate(
          data.weeks[change.shift.weekIndex].days[change.shift.dayIndex].date,
        )}`,
    )
    .join('\n');
}
export function deserializeActions(
  importText: string,
  processed: CallScheduleProcessed,
): {
  errors: string[];
  actions: Action[];
} {
  const errors = [];
  const actions: Action[] = [];
  for (let line of importText.split('\n')) {
    line = line.trim();
    if (line == '') continue;
    const match = line.match(
      /^(\d+)\. Replace (.+) with (.+) for (.+) on (.+)$/,
    );
    if (!match) {
      errors.push(`Invalid call switch: ${line}`);
      continue;
    }
    const [_, _1, previous_, next_, shift_, date_] = match;
    const dateMatch = date_.match(/^(\w+), (\d+)\/(\d+)\/(\d+)$/);
    let dateObj;
    if (dateMatch) {
      const [_2, _3, day, month, year] = dateMatch;
      dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      const dateMatch = date_.match(/^(\w+) (\d+)\/(\d+)\/(\d+)$/);
      if (dateMatch) {
        const [_2, _3, month, day, year] = dateMatch;
        dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        errors.push(`Invalid date: ${date_}`);
        continue;
      }
    }

    if (dateObj.toString() == 'Invalid Date') {
      errors.push(`Invalid date: ${date_}`);
      continue;
    }
    const date = dateToIsoDate(dateObj);
    const index = processed.day2weekAndDay[date];
    if (index === undefined) {
      errors.push(`Invalid date: ${date}`);
      continue;
    }
    try {
      const shift = deserializeShift(processed.data, shift_);
      if (shift in processed.data.chiefShiftConfigs) {
        try {
          const next = assertMaybeChief(deserializePerson(next_));
          const previous = assertMaybeChief(deserializePerson(previous_));
          actions.push({
            kind: 'backup',
            previous,
            next,
            shift: {
              ...index,
              shiftName: shift,
            },
          });
        } catch {
          errors.push(`Invalid chief: ${next_} or ${previous_}`);
          continue;
        }
      } else {
        try {
          const next = assertMaybeCallPoolPerson(deserializePerson(next_));
          const previous = assertMaybeCallPoolPerson(
            deserializePerson(previous_),
          );
          actions.push({
            kind: 'regular',
            previous,
            next,
            shift: {
              ...index,
              shiftName: shift,
            },
          });
        } catch {
          errors.push(`Invalid person: ${next_} or ${previous_}`);
          continue;
        }
      }
    } catch {
      errors.push(`Invalid shift: ${shift_}`);
      continue;
    }
  }
  return {
    errors,
    actions,
  };
}

export function compareData(
  before: CallSchedule,
  after: CallSchedule,
):
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'ok';
      changes: Action[];
    } {
  const changes: Action[] = [];
  for (let weekIndex = 0; weekIndex < before.weeks.length; weekIndex++) {
    const beforeWeek = before.weeks[weekIndex];
    const afterWeek = after.weeks[weekIndex];
    for (let dayIndex = 0; dayIndex < beforeWeek.days.length; dayIndex++) {
      const beforeDay = beforeWeek.days[dayIndex];
      const afterDay = afterWeek.days[dayIndex];

      // Regular shifts
      for (const shiftName of Object.keys(beforeDay.shifts)) {
        const beforePerson = beforeDay.shifts[shiftName];
        const afterPerson = afterDay.shifts[shiftName];
        if (beforePerson === undefined || afterPerson === undefined) {
          return {
            kind: 'error',
            message: `Shift ${shiftName} is missing in one of the schedules for ${beforeDay.date}`,
          };
        }
        if (beforePerson !== afterPerson) {
          changes.push({
            kind: 'regular',
            shift: {
              weekIndex,
              dayIndex,
              shiftName: shiftName,
            },
            previous: beforePerson,
            next: afterPerson,
          });
        }
      }

      // Backup shifts
      for (const shiftName of Object.keys(beforeDay.backupShifts)) {
        const beforePerson = beforeDay.backupShifts[shiftName];
        const afterPerson = afterDay.backupShifts[shiftName];
        if (beforePerson === undefined || afterPerson === undefined) {
          return {
            kind: 'error',
            message: `Backup shift ${shiftName} is missing in one of the schedules for ${beforeDay.date}`,
          };
        }
        if (beforePerson !== afterPerson) {
          changes.push({
            kind: 'backup',
            shift: {
              weekIndex,
              dayIndex,
              shiftName: shiftName,
            },
            previous: beforePerson,
            next: afterPerson,
          });
        }
      }
    }
  }
  return {
    kind: 'ok',
    changes,
  };
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

  const PEOPLE = Object.keys(data.people);

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
    data,
    issues: {},
    day2person2info: {},
    day2hospital2people: {},
    issueCounts: {
      hard: 0,
      soft: 0,
      softCrossCoverage: 0,
    },
    day2isR2EarlyCall: {},
    callCounts: Object.fromEntries(PEOPLE.filter(p => data.people[p].year !== '1' && data.people[p].year !== 'C').map(p => [p, { weekday: 0, weekend: 0, sunday: 0, nf: 0 }])),
    backupCallCounts: 
      Object.fromEntries(PEOPLE.filter(p => data.people[p].year === 'C').map(p => [p, deepCopy(emptyBackupCallCount)])),
    shiftCounts: {
      total: 0,
      assigned: 0,
    },
    backupShiftCounts: {
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
      weekdayOnlySunday: 0,
      weekendOutsideMaternity: 0,
      weekdayOutsideMaternity: 0,
    },
    day2shift2isHoliday: {},
    isBeforeStartOfAcademicYear: data.firstDay > dateToIsoDate(new Date()),
    rules: [],
  };

  // Initialize day2person2info with default info
  for (const person in data.people) {
    for (const week of data.weeks) {
      for (const day of week.days) {
        if (day.date > data.lastDay || day.date < data.firstDay) continue;
        result.day2person2info[day.date] =
          result.day2person2info[day.date] || {};
        result.day2person2info[day.date][person] = {
          rotation: 'OFF',
          rotationDetails: {
            chief: false,
          },
          onVacation: false,
          onPriorityWeekend: false,
          isWorking: false,
          shifts: [],
          shifts2: [],
        };
      }
    }
  }

  // Figure out where everyone is working
  for (const [person, rotations] of Object.entries(data.rotations)) {
    if (rotations.length == 0) continue;
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

  for (const person of callPoolPeople(data)) {
    const priority = data.people[person].priorityWeekendSaturday;
    if (priority) {
      const priority2 = nextDay(priority, 1);
      assertNonNull(
        result.day2person2info[priority]?.[person],
        `Missing person info for ${person} and date ${priority}.`,
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
      let vacationStart: IsoDate, vacationEnd: IsoDate;
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
        const personInfo = assertNonNull(dayInfo[person]);
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
      for (const [shift, person] of Object.entries(day.shifts)) {
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

        for (let i = 0; i < shiftConfig.daysForConsecutiveCall; i++) {
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
  for (const [d, person2info] of Object.entries(result.day2person2info)) {
    const day = d as IsoDate;
    for (const [person, i] of Object.entries(person2info)) {
      const info = assertNonNull(i);
      if (info.rotation == 'OFF') continue;
      result.day2hospital2people[day] = result.day2hospital2people[day] || {};
      result.day2hospital2people[day][info.rotation] =
        result.day2hospital2people[day][info.rotation] || [];
      assertNonNull(result.day2hospital2people[day][info.rotation]).push({
        person,
        ...info.rotationDetails,
      });
    }
  }

  // Compute who can take a shift potentially
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.date > data.lastDay || day.date < data.firstDay) continue;
      result.day2shift2unavailablePeople[day.date] = {};
      for (const shift of Object.keys(day.shifts)) {
        const shiftConfig = assertNonNull(data.shiftConfigs[shift]);
        const unavailablePeople: Record<
          Person,
          {
            reason: string;
            soft: boolean;
          }
        > = {};
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
  function shiftsOfDay(day: IsoDate): { day: IsoDate; shift: ShiftKind }[] {
    return Object.keys(result.day2shift2unavailablePeople[day] || {}).map(
      shift => ({ day, shift }),
    );
  }
  for (const [d, holiday] of Object.entries(data.holidays)) {
    const date = d as IsoDate;
    const dow = dateToDayOfWeek(date);
    const shifts: { day: IsoDate; shift: ShiftKind }[] = [];
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
        case 'tue':
        case 'wed':
        case 'thu':
          if (holiday == 'Christmas' || holiday == 'New Year') {
            shifts.push(...shiftsOfDay(nextDay(date, -1)));
          }
          shifts.push(...shiftsOfDay(nextDay(date, 0)));
          break;
        case 'fri':
          shifts.push(...shiftsOfDay(nextDay(date, 0)));
          break;
        default:
          throw new Error(`Didn't expect a holiday on ${dow} (${holiday}; ${date})`);
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
  const r2s = allPeople(data).filter(
    p => data.people[p] && data.people[p].year == '2',
  );
  for (const r2 of r2s) {
    let foundFirstNf = false;
    let exit = false;
    for (const week of data.weeks) {
      for (const day of week.days) {
        if (exit) break;
        const isNf = result.day2person2info[day.date]?.[r2]?.rotation === 'NF';
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
        if (r2s.includes(person)) {
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
      for (const [shift, person] of Object.entries(day.backupShifts)) {
        if (person == '') continue;
        const field = result.day2isR2EarlyCall[day.date] ? 'r2' : 'regular';
        switch (shift) {
          case 'backup_holiday': {
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
          }
          case 'backup_weekend': {
            result.backupCallCounts[person][field].weekend += 1;
            break;
          }
          case 'backup_weekday': {
            result.backupCallCounts[person][field].weekday += 1;
            break;
          }
        }
      }
    }
  }

  const rules: {
    kind: 'hard' | 'soft';
    description: string;
  }[] = [];

  // hard 0a. no call on vacation or non-call rotations
  rules.push({
    kind: 'hard',
    description: 'No call on vacation or Alaska/NF/OFF rotations',
  });
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (day == '2024-06-30') continue;
      if (!today.shifts) continue;
      if (isNoCallRotation(today.rotation) || today.onVacation) {
        for (const shift of today.shifts) {
          addIssue(result, {
            kind: 'rotation-without-call',
            startDay: day,
            message: `No call during ${
              today.onVacation ? 'vacation' : today.rotation
            }: ${person} is on call for ${shiftName(shift.shift)}.`,
            isHard: true,
            elements: [elementIdForShift(shift.day, shift.shift)],
          });
        }
      }
    }
  });

  // hard 0a for backup
  forEveryDay(data, (day, _) => {
    for (const person of allChiefs(data)) {
      const today = result.day2person2info[day][person];
      const index = result.day2weekAndDay[day];
      const dayInfo = data.weeks[index.weekIndex].days[index.dayIndex];
      if (today && !today.onVacation) continue;
      if (!Object.values(dayInfo.backupShifts).includes(person)) continue;
      addIssue(result, {
        kind: 'rotation-without-call',
        startDay: day,
        message: `No backup call during vacation of ${person} on ${day}.`,
        isHard: true,
        elements: [elementIdForDay(day)],
      });
    }
  });

  // hard 0b: not multiple calls on same day
  rules.push({
    kind: 'hard',
    description: 'Not on call for multiple shifts on same day',
  });
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      const shifts = today.shifts.filter(x => x.day == day);
      if (shifts.length > 1) {
        addIssue(result, {
          kind: 'consecutive-call',
          startDay: day,
          message: `Multiple call on ${day} for ${person}: ${shifts
            .map(x => shiftName(x.shift))
            .join(', ')}`,
          isHard: true,
          elements: shifts.map(s => elementIdForShift(s.day, s.shift)),
        });
      }
    }
  });

  // hard 1. no consecutive call calls
  rules.push({
    kind: 'hard',
    description: 'Not on call for consecutive days',
  });
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
  //       addIssue(result, {
  //         kind: 'consecutive-weekday-call',
  //         startDay: day,
  //         message: `Consecutive call for ${person} on ${day} and ${dayPlusOne}`,
  //         isHard: true,
  //         elements: [
  //           elementIdForShift(day, today.shift),
  //           elementIdForShift(dayPlusOne, tomorrow.shift),
  //         ],
  //       });
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
  //       addIssue(result, {
  //         kind: 'consecutive-call',
  //         startDay,
  //         message: `Consecutive call for ${person}: ${texts.join(', ')}`,
  //         isHard: true,
  //         elements: today.shifts.map(s => elementIdForShift(s.day, s.shift)),
  //       });
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
        const startDay = today.map(s => s.day).sort()[0];
        addIssue(result, {
          kind: 'consecutive-call',
          startDay,
          message: `Consecutive call for ${person}: ${texts.join(', ')}`,
          isHard: true,
          elements: allShifts.map(s => elementIdForShift(s.day, s.shift)),
        });
      }
    },
    1,
  );

  // hard 2. no consecutive weekend calls
  rules.push({
    kind: 'hard',
    description: 'Not on call for consecutive weekends',
  });
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
        addIssue(result, {
          kind: 'consecutive-weekend-call',
          startDay: day,
          message: `Consecutive weekend call for ${person} on ${day} and ${nextWeekendDay}`,
          isHard: true,
          elements: [
            elementIdForShift(day, today.shift),
            elementIdForShift(nextWeekendDay, nextWeekend.shift),
          ],
        });
      }
    },
    7,
  );

  // hard 3. r2's should not be on call for first 2 weeks of july
  rules.push({
    kind: 'hard',
    description: 'R2s should not be on call for first 2 weeks of July',
  });
  forEveryDay(data, (day, _) => {
    if (day > '2024-07-13') return;
    for (const person of PEOPLE) {
      const p = data.people[person];
      if (p.year != '2') continue;
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      addIssue(result, {
        kind: 'r2-early-call',
        startDay: day,
        message: `R2 on-call first week of July: ${person} is on call ${day} for ${shiftName(
          today,
        )}.`,
        isHard: true,
        elements: [elementIdForShift(day, today.shift)],
      });
    }
  });

  // hard 4. MAD shouldn't be on call for the first two weeks of their SCH/HMC rotations.
  rules.push({
    kind: 'hard',
    description: 'MAD should not be on call for the first two weeks of their SCH/HMC rotations',
  });
  for (const rotation of data.rotations.MAD) {
    if (rotation.rotation != 'HMC' && rotation.rotation != 'SCH') continue;
    for (let i = 0; i < 14; i++) {
      const day = nextDay(rotation.start, i);
      const today = result.day2person2info[day]?.['MAD'];
      assertNonNull(today);
      if (today?.shift) {
        addIssue(result, {
          kind: 'mad-early-call',
          startDay: day,
          message: `MAD is on call first two weeks of SCH/HMC rotation: ${day} for ${shiftName(
            today,
          )} (day ${i + 1} of their ${rotation.rotation} rotation)`,
          isHard: true,
          elements: [elementIdForShift(day, today.shift)],
        });
      }
    }
  }

  // hard 5. 4 days off in a 28 day period
  rules.push({
    kind: 'hard',
    description: 'At least 4 days off in every 28 day period',
  });
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
        addIssue(result, {
          kind: 'less-than-4-off-in-28',
          startDay: dayOne,
          message: `Less than 4 days off in 28 days: between ${dayOne} and ${dayTwo} for ${person}`,
          isHard: true,
          elements: [elementIdForDay(dayOne), elementIdForDay(dayTwo)],
        });
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
  rules.push({
    kind: 'hard',
    description: 'No call during priority weekend',
  });
  forEveryDay(data, (day, _) => {
    for (const person of callPoolPeople(data)) {
      const info = result.day2person2info?.[day]?.[person];
      if (info && info.onPriorityWeekend) {
        if (info.shifts.length > 0) {
          addIssue(result, {
            kind: 'priority-weekend',
            startDay: nextDay(day, -1),
            message: `Priority weekend: ${person} on ${shiftName(
              info.shifts[0].shift,
            )} for ${day}`,
            isHard: true,
            elements: [elementIdForShift(day, info.shifts[0].shift)],
          });
        }
      }
    }
  });

  // hard 7. no weekend call before NF
  rules.push({
    kind: 'hard',
    description: 'No weekend call before NF',
  });
  forEveryDay(data, (day, _) => {
    const dow = dateToDayOfWeek(day);
    if (dow != 'fri') return;
    for (const person of callPoolPeople(data)) {
      const friday = result.day2person2info?.[day]?.[person];
      const monday = result.day2person2info?.[nextDay(day, 3)]?.[person];
      if (friday && monday) {
        if (
          friday.rotation != 'NF' &&
          monday.rotation == 'NF' &&
          friday.shift
        ) {
          addIssue(result, {
            kind: 'call-before-nf',
            startDay: day,
            message: `Call before NF for ${person} on ${day}`,
            isHard: true,
            elements: [elementIdForShift(day, friday.shift)],
          });
        }
      }
    }
  });

  // soft 1. every other weeknight call
  rules.push({
    kind: 'soft',
    description: 'Not on call for 2 weeknights separated by 1 day only',
  });
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
  //       addIssue(result, {
  //         kind: 'almost-consecutive-call',
  //         startDay: day,
  //         message: `Two calls only 1 day apart: ${person} on call ${day} and ${dayPlusOne}`,
  //         isHard: false,
  //         elements: [
  //           elementIdForShift(day, today.shift),
  //           elementIdForShift(dayPlusOne, tomorrow.shift),
  //         ],
  //       });
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
        const startDay = today.map(s => s.day).sort()[0];
        addIssue(result, {
          kind: 'almost-consecutive-call',
          startDay,
          message: `Two calls only 1 day apart: ${person}: ${texts.join(', ')}`,
          isHard: false,
          elements: allShifts.map(s => elementIdForShift(s.day, s.shift)),
        });
      }
    },
    2,
  );

  // soft 2. every other weekend call
  rules.push({
    kind: 'soft',
    description: 'Not on call for 2 weekends with only 1 weekend off in between',
  });
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
        addIssue(result, {
          kind: 'every-other-weekend-call',
          startDay: day,
          message: `Every other weekend on call for 3 calls in a row: ${person} on ${day}, ${nextWeekendDay} and ${nextNextWeekendDay}`,
          isHard: false,
          elements: [
            elementIdForShift(day, today.shift),
            elementIdForShift(nextWeekendDay, nextWeekend.shift),
            elementIdForShift(nextNextWeekendDay, nextNextWeekend.shift),
          ],
        });
      }
    },
    7 * 5,
  );

  // soft 3. no MAD call during AUA
  rules.push({
    kind: 'soft',
    description: 'MAD should not be on call during AUA',
  });
  forEveryDay(data, (day, _) => {
    if (data.specialDays[day] != 'AUA') return;
    const person = 'MAD';
    const today = assertNonNull(result.day2person2info[day][person]);
    if (!today.shift) return;
    addIssue(result, {
      kind: 'mad-during-aua',
      startDay: day,
      message: `MAD is on call during AUA: ${shiftName(today)} on ${day}.`,
      isHard: false,
      elements: [elementIdForShift(day, today.shift)],
    });
  });
  // soft 3b. no AUA for seniors
  rules.push({
    kind: 'soft',
    description: 'Seniors should not be on call during AUA',
  });
  forEveryDay(data, (day, _) => {
    if (data.specialDays[day] != 'AUA') return;
    for (const person of PEOPLE) {
      const pc = data.people[person];
      if (pc.year !== 'S') continue;
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      addIssue(result, {
        kind: 'senior-during-aua',
        startDay: day,
        message: `Senior is on call during AUA: ${shiftName(today)} on ${day}.`,
        isHard: false,
        elements: [elementIdForShift(day, today.shift)],
      });
    }
  });
  // hard 3c. no AUA for research
  rules.push({
    kind: 'hard',
    description: 'Research residents should not be on call during AUA',
  });
  forEveryDay(data, (day, _) => {
    if (data.specialDays[day] != 'AUA') return;
    for (const person of PEOPLE) {
      const pc = data.people[person];
      if (pc.year !== 'R') continue;
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      addIssue(result, {
        kind: 'research-during-aua',
        startDay: day,
        message: `Senior is on call during AUA: ${shiftName(today)} on ${day}.`,
        isHard: true,
        elements: [elementIdForShift(day, today.shift)],
      });
    }
  });

  // soft 4. no cross coverage
  rules.push({
    kind: 'soft',
    description: 'No cross coverage (working at north hospital but on call for south, or vice versa)',
  });
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const today = assertNonNull(result.day2person2info[day][person]);
      if (!today.shift) continue;
      const call = assertNonNull(data.shiftConfigs[today.shift]).hospitals;
      if (today.rotation == 'Research') continue;
      if (today.rotation == 'Alaska') continue;
      if (today.rotation == 'NF') continue;
      if (today.rotation == 'OFF') continue;
      const rotationHospitals: Hospital[] =
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
        addIssue(result, {
          kind: 'cross-coverage',
          startDay: day,
          message: `Cross-coverage by ${person} on ${day}: Working at ${
            today.rotation
          }, but on call for ${shiftName(today)}.`,
          isHard: false,
          elements: [elementIdForShift(day, today.shift)],
        });
      }
    }
  });

  // soft 5. no call in 3rd trimester
  rules.push({
    kind: 'hard',
    description: 'No call during maternity/paternity leave',
  });
  forEveryDay(data, (day, _) => {
    for (const person of PEOPLE) {
      const config = data.people[person];
      if (!config.maternity) continue;
      if (config.maternity.from <= day && day <= config.maternity.to) {
        const today = assertNonNull(result.day2person2info[day][person]);
        if (!today.shift) continue;
        addIssue(result, {
          kind: 'maternity',
          startDay: day,
          message: `On-call during maternity: ${person} on call ${day} for ${shiftName(
            today,
          )}.`,
          isHard: true,
          elements: [elementIdForShift(day, today.shift)],
        });
      }
    }
  });

  result.rules = rules;

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
  for (const [d, person2info] of Object.entries(result.day2person2info)) {
    const day = d as IsoDate;
    const dayOfWeek = dateToDayOfWeek(day);
    for (const [person, i] of Object.entries(person2info)) {
      const info = assertNonNull(i);
      if (!(person in result.callCounts)) continue;
      const callCount = result.callCounts[person];
      if (info.shift) {
        if (isHolidayShift(result, day, info.shift)) continue;
        const shiftConfig = data.shiftConfigs[info.shift];
        if (shiftConfig.type === 'weekday') {
          if (dayOfWeek == 'sun') {
            callCount.sunday += 1;
          } else {
            callCount.weekday += 1;
          }
        } else if (shiftConfig.type === 'weekend') {
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
        const shift = s;
        const personConfig = data.people[person];
        const isMaternity =
          personConfig &&
          personConfig.maternity &&
          personConfig.maternity.from <= day.date &&
          day.date <= personConfig.maternity.to;
        if (isHolidayShift(result, day.date, shift)) continue;
        const shiftConfig = data.shiftConfigs[shift];
        if (shiftConfig.type === 'weekday') {
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
          if (dateToDayOfWeek(day.date) == 'sun') {
            result.totalCalls.weekdayOnlySunday += 1;
          }
        } else if (shiftConfig.type === 'weekend') {
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
      for (const shift of Object.values(day.backupShifts)) {
        result.backupShiftCounts.total += 1;
        if (shift !== '' && shift !== undefined)
          result.backupShiftCounts.assigned += 1;
      }
    }
  }

  // 6. soft: don't go over call targets
  for (const person of callPoolPeople(data)) {
    const personConfig = data.people[person];
    const callCount = result.callCounts[person];
    if (
      callCount.weekday > data.callTargets.weekday[personConfig.year][person]
    ) {
      addIssue(result, {
        kind: 'over-call-target',
        startDay: data.firstDay,
        message: `Over weekday call target: ${person} has ${
          callCount.weekday
        } calls, target is ${
          data.callTargets.weekday[personConfig.year][person]
        }.`,
        isHard: false,
        elements: [],
      });
    }
    if (
      callCount.weekend > data.callTargets.weekend[personConfig.year][person]
    ) {
      addIssue(result, {
        kind: 'over-call-target',
        startDay: data.firstDay,
        message: `Over weekend call target: ${person} has ${
          callCount.weekend
        } calls, target is ${
          data.callTargets.weekend[personConfig.year][person]
        }.`,
        isHard: false,
        elements: [],
      });
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

  // check if call targets are correct
  let weekdayCallTarget = 0;
  let weekendCallTarget = 0;
  for (const [_, person2callTarget] of Object.entries(data.callTargets.weekday)) {
    for (const [_, callTarget] of Object.entries(person2callTarget)) {
      weekdayCallTarget += callTarget;
    }
  }
  for (const [_, person2callTarget] of Object.entries(data.callTargets.weekend)) {
    for (const [_, callTarget] of Object.entries(person2callTarget)) {
      weekendCallTarget += callTarget;
    }
  }
  if (weekdayCallTarget != result.totalCalls.weekday) {
    addIssue(result, {
      kind: 'wrong-call-target',
      startDay: data.firstDay,
      elements: [],
      message: `Weekday call target is incorrect. There are ${result.totalCalls.weekday} weekday shifts, but sum of all targets is ${weekdayCallTarget}`,
      isHard: true,
    });
  }
  if (weekendCallTarget != result.totalCalls.weekend) {
    addIssue(result, {
      kind: 'wrong-call-target',
      startDay: data.firstDay,
      elements: [],
      message: `Weekend call target is incorrect. There are ${result.totalCalls.weekend} weekend shifts, but sum of all targets is ${weekendCallTarget}`,
      isHard: true,
    });
  }
  
  

  // eslint-disable-next-line no-constant-condition
  if (1 == 2 + 1) {
    console.log('Processing took', Date.now() - start, 'ms');
  }
  return result;
}

function forEveryDay(
  data: CallSchedule,
  callback: (day: IsoDate, date: Date) => void,
  stopNDaysBeforeEnd?: number,
) {
  if (stopNDaysBeforeEnd === undefined) stopNDaysBeforeEnd = 0;
  let day = data.firstDay;
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
      '1': '#ffbae1', // pink
    },
    '#cccccc',
  );
  if (dark)
    return mapEnumWithDefault(
      year as string,
      {
        R: '#2f4f2f', // dark green
        '2': '#8b8b00', // dark yellow
        '3': '#cd5c00', // dark orange
        S: '#b22222', // dark red
        M: '#1e90ff', // dark blue
        '1': '#8b008b', // dark pink
      },
      '#333333', // dark grey as default
    );
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

export function countHolidayShifts(
  data: CallSchedule,
  holidayShifts: HolidayShift[],
): {
  calls: number;
  hours: number;
} {
  let hours = 0;
  let calls = 0;
  for (const holidayShift of holidayShifts) {
    calls += 1;
    hours += data.shiftConfigs[holidayShift.shift].hours;
  }
  return { calls, hours };
}

export function collectHolidayCall(
  person: Person,
  data: CallSchedule,
  processed: CallScheduleProcessed,
): HolidayShift[] {
  const holidayCalls: HolidayShift[] = [];
  for (const d in processed.day2shift2isHoliday) {
    const day = d as IsoDate;
    const index = processed.day2weekAndDay[day];
    for (const s in processed.day2shift2isHoliday[day]) {
      const shift = s;
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
