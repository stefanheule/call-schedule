import { dateToIsoDate, IsoDate } from 'check-type';
import { Action, CallSchedule, DayId, ShiftKind } from './shared/types';
import { dateToDayOfWeek } from './shared/compute';

// ---- IMPORTANT: these are shared definitions/types between metro and call-schedule.

export const TERRA_AUTH_ENV_VARIABLE = `TERRA_SECRET`;

// @check-type
export type ApplyAmionChangeRequest = {
  auth: string;
  initialTry: boolean;
  email: {
    subject: string;
    body: {
      text: string;
      html?: string;
    };
  };
};

// @check-type
export type ApplyAmionChangeResponse =
  | {
      kind: 'ok';
    }
  | {
      kind: 'error';
      message: string;
    };

// ---- end shared definitions.

function parseDate(input: {
  line: string;
  dow: string;
  month: string;
  day: string;
}): IsoDate {
  let year = new Date().getFullYear();
  let date = new Date(`${input.month} ${input.day}, ${year}`);
  if (date.getTime() < Date.now()) {
    year++;
    date = new Date(`${input.month} ${input.day}, ${year}`);
  }
  if (dateToDayOfWeek(date) !== input.dow.toLowerCase()) {
    throw new Error(
      `Day of week mismatch: ${input.dow} vs ${dateToDayOfWeek(
        date,
      )} for ${date}, while parsing ${input.line}.`,
    );
  }
  return dateToIsoDate(date);
}

function parseShift(
  input: { line: string; shift: string },
  data: CallSchedule,
): ShiftKind {
  for (const shift of Object.values(data.shiftConfigs)) {
    if (shift.amionName === undefined) continue;
    if (shift.amionName === input.shift) {
      return shift.kind;
    }
  }
  throw new Error(`Unknown shift: ${input.shift} while parsing ${input.line}.`);
}

function parsePerson(
  input: { line: string; person: string },
  data: CallSchedule,
): string {
  const parts = input.person.split(' ');
  if (parts.length !== 2) {
    throw new Error(
      `Expected two parts in person: ${input.person}, while parsing ${input.line}`,
    );
  }
  for (const [person, config] of Object.entries(data.people)) {
    const firstArray = Array.isArray(config.name.first);
    const lastArray = Array.isArray(config.name.last);
    if (firstArray && lastArray) {
      for (let i = 0; i < config.name.first.length; i++) {
        if (
          config.name.first[i] === parts[0] &&
          config.name.last[i] === parts[1]
        ) {
          return person;
        }
      }
    } else if (!firstArray && lastArray) {
      if (
        config.name.first === parts[0] &&
        config.name.last.includes(parts[1])
      ) {
        return person;
      }
    } else if (firstArray) {
      if (
        config.name.first.includes(parts[0]) &&
        config.name.last === parts[1]
      ) {
        return person;
      }
    } else {
      if (config.name.first === parts[0] && config.name.last === parts[1]) {
        return person;
      }
    }
    if (config.name.first === parts[0] && config.name.last === parts[1]) {
      return person;
    }
  }
  throw new Error(
    `Cannot find person: ${input.person}, while parsing ${input.line}.`,
  );
}

export function parseAmionEmail(
  request: ApplyAmionChangeRequest,
  data: CallSchedule,
): Action[] {
  const result = [];
  console.log(`Parsing email with subject: ${request.email.subject}`);
  console.log(request.email.body.text);
  const regex =
    /([A-Za-z ]+) takes ([A-Za-z ]+)'s ([A-Za-z ]+) on ([A-Za-z]+). ([A-Za-z]+) ([0-9]+)./g;
  const matches = Array.from(request.email.body.text.matchAll(regex));
  console.log(`Found ${matches.length} changes.`);
  for (const match of matches) {
    console.log(`Match: ${match[0]}`);
    const date = parseDate({
      line: match[0],
      dow: match[4],
      month: match[5],
      day: match[6],
    });
    console.log(`Parsed date: ${date}`);
    const newPerson = parsePerson({ line: match[0], person: match[1] }, data);
    const oldPerson = parsePerson({ line: match[0], person: match[2] }, data);
    console.log(`Parsed new person: ${newPerson}`);
    console.log(`Parsed old person: ${oldPerson}`);
    const shift = parseShift({ line: match[0], shift: match[3] }, data);
    console.log(`Parsed shift: ${shift}`);

    let dayId: DayId | undefined = undefined;
    for (let weekIndex = 0; weekIndex < data.weeks.length; weekIndex++) {
      const week = data.weeks[weekIndex];
      for (let dayIndex = 0; dayIndex < week.days.length; dayIndex++) {
        const day = week.days[dayIndex];
        if (date === day.date) {
          dayId = { weekIndex, dayIndex };
          if (day.shifts[shift] === undefined) {
            throw new Error(`Shift ${shift} does not exist for ${date}`);
          }
          if (day.shifts[shift] !== oldPerson) {
            throw new Error(
              `Shift ${shift} is not taken by ${oldPerson} for ${date}`,
            );
          }
          break;
        }
      }
    }
    if (dayId === undefined) {
      throw new Error(`Cannot find day for date ${date}`);
    }

    const action: Action = {
      kind: 'regular',
      shift: {
        ...dayId,
        shiftName: shift,
      },
      previous: oldPerson,
      next: newPerson,
    };
    result.push(action);
  }
  return result;
}
