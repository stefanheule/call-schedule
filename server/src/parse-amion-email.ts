import { dateToIsoDate, IsoDate } from 'check-type';
import { Action, CallSchedule, ShiftKind } from './shared/types';
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

function parseShift(input: { line: string; shift: string }): ShiftKind {
  switch (input.shift.toLowerCase()) {
    case '':
      return '';
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
    if (config.name?.first === parts[0] && config.name.last === parts[1]) {
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
  console.log(`Parsing email with subject: ${request.email.subject}`);
  console.log(request.email.body.text);
  const regex =
    /([A-Za-z ]+) will take ([A-Za-z ]+) on ([A-Za-z]+). ([A-Za-z]+) ([0-9]+)./g;
  const matches = Array.from(request.email.body.text.matchAll(regex));
  console.log(`Found ${matches.length} changes.`);
  for (const match of matches) {
    console.log(`Match: ${match[0]}`);
    const date = parseDate({
      line: match[0],
      dow: match[3],
      month: match[4],
      day: match[5],
    });
    console.log(`Parsed date: ${date}`);
    const person = parsePerson({ line: match[0], person: match[1] }, data);
    console.log(`Parsed person: ${person}`);
    const shift = parseShift({ line: match[0], shift: match[2] });
    console.log(`Parsed shift: ${shift}`);
  }
  return [];
}
