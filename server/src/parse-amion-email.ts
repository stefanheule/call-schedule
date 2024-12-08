import {
  assertNonNull,
  dateToIsoDate,
  exceptionToString,
  IsoDate,
  objectToJson,
} from 'check-type';
import { Action, CallSchedule, Day, DayId } from './shared/types';
import { dateToDayOfWeek, findDay, nextDay } from './shared/compute';

// ---- IMPORTANT: these are shared definitions/types between metro and call-schedule.

export const TERRA_AUTH_ENV_VARIABLE = `TERRA_SECRET`;

// @check-type
export type TinyEmail = {
  subject: string;
  body: string;
};

// @check-type
export type ApplyAmionChangeRequest = {
  auth: string;
  initialTry: boolean;
  emails: TinyEmail[];
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

/*
Parsing emails works as follows:
- We process them in batches, because e.g. a call switch for south requires several emails (one for each hospital).
  If we apply the changes from one before we even parse the second, then the second parse will fail, because it looks like
  the email data on who used to be on call is no longer right.
- For each email, we first do simple data extraction, then map that data to an ExtractedAction. So the flow is:
  Email[] -> EmailParseResult<ExtractedData>[] -> EmailParseResult<ExtractedAction>[]
*/

type ExtractedData = {
  line: string;
  date: IsoDate;
  oldPerson: string;
  newPerson: string;
  amionShift: string;
};
type ExtractedAction =
  | {
      kind: 'action';
      extracted: ExtractedData;
      action: Action;
    }
  | {
      kind: 'ignored';
      extracted: ExtractedData;
      message: string;
    }
  | {
      kind: 'error';
      extracted: ExtractedData;
      message: string;
    };
type EmailParseResult<T> =
  | {
      email: TinyEmail;
      kind: 'ignored';
    }
  | {
      email: TinyEmail;
      kind: 'changes';
      isPending: boolean;
      changes: T[];
    }
  | {
      email: TinyEmail;
      kind: 'error';
      message: string;
    };

function interpretData(
  extracted: ExtractedData,
  data: CallSchedule,
  skipShiftCheck: boolean = false,
): ExtractedAction {
  // Find day
  const date = extracted.date;
  let dayId: DayId | undefined = undefined;
  for (let weekIndex = 0; weekIndex < data.weeks.length; weekIndex++) {
    const week = data.weeks[weekIndex];
    for (let dayIndex = 0; dayIndex < week.days.length; dayIndex++) {
      const day = week.days[dayIndex];
      if (date === day.date) {
        dayId = { weekIndex, dayIndex };
        break;
      }
    }
  }
  if (dayId === undefined) {
    return {
      kind: 'error',
      extracted,
      message: `Cannot find day for date ${date}.`,
    };
  }
  const day = data.weeks[dayId.weekIndex].days[dayId.dayIndex];
  const dow = dateToDayOfWeek(day.date);

  // Figure out what shift this is
  const amionShift = extracted.amionShift;
  const candidates: {
    shift: string;
    day: Day;
    validateThenIgnoreReason?: string;
  }[] = [];
  if (
    ['VA Night', 'VA Day Inpatients', 'VA Day Consults'].includes(amionShift)
  ) {
    return {
      kind: 'ignored',
      extracted,
      message: `Ignoring ${amionShift} shift, because we react to HMC instead.`,
    };
  } else if (amionShift === 'HMC Night') {
    if (dow == 'fri' || dow == 'sat' || dow == 'sun') {
      const friday = assertNonNull(
        findDay(
          data,
          nextDay(day.date, dow == 'fri' ? 0 : dow == 'sat' ? -1 : -2),
        ),
      );
      if (dow != 'sun') {
        candidates.push({
          shift: 'weekend_south',
          day: friday,
          validateThenIgnoreReason:
            dow != 'fri' ? 'we react to the Friday shift instead' : undefined,
        });
      }
      candidates.push({
        shift: 'south_power',
        day: friday,
        validateThenIgnoreReason:
          dow != 'fri' ? 'we react to the Friday shift instead' : undefined,
      });
    }

    if (!(dow == 'fri' || dow == 'sat')) {
      candidates.push({
        shift: 'weekday_south',
        day,
      });
    }
  } else if (['HMC Day Inpatient', 'HMC Day Consult'].includes(amionShift)) {
    if (dow == 'sat' || dow == 'sun') {
      const friday = assertNonNull(
        findDay(data, nextDay(day.date, dow == 'sat' ? -1 : -2)),
      );
      for (const shift of ['weekend_south', 'south_power']) {
        candidates.push({
          shift,
          day: friday,
          validateThenIgnoreReason: `we react to the Friday shift instead`,
        });
      }
    } else {
      return {
        kind: 'error',
        extracted,
        message: `Don't know how to handle day shifts like ${amionShift} not on a weekend like ${date} (${dow}).`,
      };
    }
  } else {
    return {
      kind: 'error',
      extracted,
      message: `No implementation yet to handle ${amionShift}.`,
    };
  }

  let selectedCandidate = undefined;
  const errors = [];
  for (const candidate of candidates) {
    const personOnCall = candidate.day.shifts[candidate.shift];
    if (personOnCall !== undefined) {
      if (!skipShiftCheck) {
        if (personOnCall === extracted.newPerson) {
          return {
            kind: 'ignored',
            extracted,
            message: `Ignoring '${amionShift}' on '${day.date}' because the change has already been applied, and '${extracted.newPerson}' is already on call (instead of ${extracted.oldPerson}).`,
          };
        }
        if (personOnCall !== extracted.oldPerson) {
          throw new Error(
            `Inferred ${amionShift} on ${day.date} to be ${candidate.shift} on ${candidate.day.date}, but found ${personOnCall} to be on call then, instead of ${extracted.oldPerson}.`,
          );
        }
      }
      selectedCandidate = candidate;
      if (candidate.validateThenIgnoreReason !== undefined) {
        return {
          kind: 'ignored',
          extracted,
          message: `Ignoring '${amionShift}' on '${day.date}' because ${
            candidate.validateThenIgnoreReason
          } (validated against '${candidate.shift}' on '${
            candidate.day.date
          }' (${dateToDayOfWeek(candidate.day.date)})).`,
        };
      }
      break;
    } else {
      errors.push(
        `${candidate.shift} on ${
          candidate.day.date
        }, but only has ${Object.keys(candidate.day.shifts).join('/')}`,
      );
    }
  }
  if (selectedCandidate == undefined) {
    if (candidates.length === 0) {
      return {
        kind: 'error',
        extracted,
        message: `No candidate shifts found for ${amionShift} on ${day.date}.`,
      };
    }
    return {
      kind: 'error',
      extracted,
      message: `Tried to handle ${amionShift} on ${
        day.date
      } using these candidates, but none worked: ${errors.join('; ')}.`,
    };
  }

  return {
    kind: 'action',
    extracted,
    action: {
      kind: 'regular',
      shift: {
        ...dayId,
        shiftName: selectedCandidate.shift,
      },
      previous: extracted.oldPerson,
      next: extracted.newPerson,
      date: selectedCandidate.day.date,
    },
  };
}

function extractDataFromAmionEmail(
  email: TinyEmail,
  data: CallSchedule,
): EmailParseResult<ExtractedData> {
  try {
    const isPending = email.subject.startsWith('FW: Pending trade');

    if (email.subject === 'FW: Changes to your Amion schedule') {
      console.log(`Ignoring email with subject: ${email.subject}`);
      return { email, kind: 'ignored' };
    }

    if (
      email.subject.startsWith(`FW: Cover Chief Back-Up on `) ||
      email.subject.startsWith(`FW: Your trade proposal to `) ||
      email.subject.startsWith(`FW: Coverage for Chief Back-Up on `)
    ) {
      console.log(`Ignoring email with subject: ${email.subject}`);
      return { email, kind: 'ignored' };
    }

    const isScheduleSubjectRegex =
      /FW: (January|February|March|April|May|June|July|August|September|October|November|December) schedule/;
    if (isScheduleSubjectRegex.exec(email.subject) !== null) {
      console.log(`Ignoring email with subject: ${email.subject}`);
      return { email, kind: 'ignored' };
    }

    const changes: ExtractedData[] = [];
    if (email.subject.startsWith('FW: Approved trade') || isPending) {
      console.log(`Parsing email with subject: ${email.subject}`);
      console.log(email.body);
      const regex =
        /([A-Za-z ]+) (is taking|takes) ([A-Za-z ]+)'s ([A-Za-z ]+) on ([A-Za-z]+). ([A-Za-z]+) ([0-9]+)./g;
      const matches = Array.from(email.body.matchAll(regex));
      console.log(`Found ${matches.length} changes.`);
      for (const match of matches) {
        const dateData = {
          line: match[0],
          dow: match[5],
          month: match[6],
          day: match[7],
        };
        const date = parseDate(dateData);
        if (typeof date !== 'string') {
          return {
            email,
            kind: 'error',
            message: date.message,
          };
        }
        const newPerson = parsePerson(
          { line: match[0], person: match[1] },
          data,
        );
        const oldPerson = parsePerson(
          { line: match[0], person: match[3] },
          data,
        );
        if (typeof newPerson !== 'string') {
          return {
            email,
            kind: 'error',
            message: newPerson.message,
          };
        }
        if (typeof oldPerson !== 'string') {
          return {
            email,
            kind: 'error',
            message: oldPerson.message,
          };
        }
        const amionShift = match[4];

        changes.push({
          line: dateData.line,
          date,
          oldPerson,
          newPerson,
          amionShift,
        });
      }
    }
    if (changes.length === 0) {
      return {
        email,
        kind: 'error',
        message: `No changes found in email.`,
      };
    }
    return {
      email,
      kind: 'changes',
      isPending,
      changes,
    };
  } catch (e) {
    return {
      email,
      kind: 'error',
      message: `Failed to extract uninterpreted changes from email: ${exceptionToString(
        e,
      )}.`,
    };
  }
}

export function parseAmionEmails(
  emails: TinyEmail[],
  data: CallSchedule,
  skipShiftCheck: boolean = false,
): EmailParseResult<ExtractedAction>[] {
  const results: EmailParseResult<ExtractedAction>[] = [];
  for (const email of emails) {
    const extracted = extractDataFromAmionEmail(email, data);
    if (extracted.kind === 'changes') {
      const changes: ExtractedAction[] = [];
      for (const change of extracted.changes) {
        changes.push(interpretData(change, data, skipShiftCheck));
      }
      results.push({
        email,
        kind: 'changes',
        isPending: extracted.isPending,
        changes,
      });
    } else {
      results.push(extracted);
    }
  }
  return results;
}

export function summarizeEmailParseResults(
  results: EmailParseResult<ExtractedAction>[],
): string {
  const lines = [];
  for (const result of results) {
    lines.push(`Email: ${result.email.subject}`);
    if (result.kind === 'changes') {
      const okay = result.changes.filter(x => x.kind === 'action');
      const ignored = result.changes.filter(x => x.kind === 'ignored');
      const errors = result.changes.filter(x => x.kind === 'error');
      if (
        okay.length + ignored.length + errors.length !==
        result.changes.length
      ) {
        throw new Error(`Unexpected kind in changes: ${objectToJson(result)}`);
      }
      lines.push(
        `Found ${result.changes.length} items: ${okay.length} actions, ${
          ignored.length
        } ignored${errors.length > 0 ? `, ${errors.length} errors` : ''} [${
          result.isPending ? 'pending' : 'approved'
        }]`,
      );
      let i = 1;
      for (const change of result.changes) {
        lines.push(
          `${i.toString().padStart(2, ' ')}. '${change.extracted.line.trim()}'`,
        );
        lines.push(
          `    -> '${change.extracted.newPerson}' is replacing '${
            change.extracted.oldPerson
          }' for '${change.extracted.amionShift}' on '${
            change.extracted.date
          }' (${dateToDayOfWeek(change.extracted.date)})'`,
        );
        if (change.kind === 'action') {
          lines.push(
            `    -> Action: ${change.action.date} ${change.action.shift.shiftName}: ${change.action.previous} -> ${change.action.next}`,
          );
        } else if (change.kind === 'ignored') {
          lines.push(`    -> Ignored: ${change.message}`);
        } else if (change.kind === 'error') {
          lines.push(`    -> Error: ${change.message}`);
        }
        i += 1;
      }
    } else if (result.kind === 'ignored') {
      lines.push(`Ignored (not relevant)`);
    } else if (result.kind === 'error') {
      lines.push(`Error: ${result.message}`);
    }
    lines.push('');
    lines.push('');
  }
  return lines.join('\n').trim();
}

function parseDate(input: {
  line: string;
  dow: string;
  month: string;
  day: string;
}):
  | IsoDate
  | {
      kind: 'error';
      message: string;
    } {
  let year = new Date().getFullYear();
  let date = new Date(`${input.month} ${input.day}, ${year}`);
  if (date.getTime() < Date.now()) {
    year++;
    date = new Date(`${input.month} ${input.day}, ${year}`);
  }
  if (dateToDayOfWeek(date) !== input.dow.toLowerCase()) {
    return {
      kind: 'error',
      message: `Day of week mismatch: ${input.dow} vs ${dateToDayOfWeek(
        date,
      )} for ${date}, while parsing ${input.line}`,
    };
  }
  return dateToIsoDate(date);
}

function parsePerson(
  input: { line: string; person: string },
  data: CallSchedule,
):
  | string
  | {
      kind: 'error';
      message: string;
    } {
  const parts = input.person.split(' ');
  if (parts.length !== 2) {
    return {
      kind: 'error',
      message: `Expected two parts for person (first and last name), but got ${input.person}; while parsing ${input.line}`,
    };
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
  return {
    kind: 'error',
    message: `Cannot find person for ${input.person}; while parsing ${input.line}`,
  };
}
