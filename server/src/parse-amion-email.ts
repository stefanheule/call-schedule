import { assertNonNull, dateToIsoDate, IsoDate } from 'check-type';
import { Action, CallSchedule, Day, DayId } from './shared/types';
import { dateToDayOfWeek, findDay, nextDay } from './shared/compute';

// ---- IMPORTANT: these are shared definitions/types between metro and call-schedule.

export const TERRA_AUTH_ENV_VARIABLE = `TERRA_SECRET`;

// @check-type
export type ApplyAmionChangeRequest = {
  auth: string;
  initialTry: boolean;
  email: {
    subject: string;
    body: string;
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

// function parseShift(
//   input: { line: string; shift: string },
//   data: CallSchedule,
// ): ShiftKind {
//   for (const shift of Object.values(data.shiftConfigs)) {
//     if (shift.amionName === undefined) continue;
//     if (shift.amionName === input.shift) {
//       return shift.kind;
//     }
//   }
//   throw new Error(`Unknown shift: ${input.shift} while parsing ${input.line}.`);
// }

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
  skipShiftCheck: boolean = false,
):
  | {
      kind: 'not-relevant';
      skipNotification?: boolean;
    }
  | {
      kind: 'changes';
      changes: Action[];
      skipNotification?: boolean;
    }
  | {
      kind: 'pending-changes';
      changes: Action[];
      skipNotification?: boolean;
    } {
  if (request.email.subject === 'FW: Changes to your Amion schedule') {
    console.log(`Ignoring email with subject: ${request.email.subject}`);
    return { kind: 'not-relevant', skipNotification: true };
  }

  const isScheduleSubjectRegex =
    /FW: (January|February|March|April|May|June|July|August|September|October|November|December) schedule/;
  if (isScheduleSubjectRegex.exec(request.email.subject) !== null) {
    console.log(`Ignoring email with subject: ${request.email.subject}`);
    return { kind: 'not-relevant', skipNotification: true };
  }

  const isPending = request.email.subject.startsWith('FW: Pending trade');
  if (request.email.subject.startsWith('FW: Approved trade') || isPending) {
    const changes = [];
    let ignoredChanges = false;
    console.log(`Parsing email with subject: ${request.email.subject}`);
    console.log(request.email.body);
    const regex =
      /([A-Za-z ]+) (is taking|takes) ([A-Za-z ]+)'s ([A-Za-z ]+) on ([A-Za-z]+). ([A-Za-z]+) ([0-9]+)./g;
    const matches = Array.from(request.email.body.matchAll(regex));
    console.log(`Found ${matches.length} changes.`);
    for (const match of matches) {
      console.log(`Match: ${match[0]}`);
      const dateData = {
        line: match[0],
        dow: match[5],
        month: match[6],
        day: match[7],
      };
      console.log(`Parsed date data: ${JSON.stringify(dateData)}`);
      const date = parseDate(dateData);
      console.log(`Parsed date: ${date}`);
      const newPerson = parsePerson({ line: match[0], person: match[1] }, data);
      const oldPerson = parsePerson({ line: match[0], person: match[3] }, data);
      console.log(`Parsed new person: ${newPerson}`);
      console.log(`Parsed old person: ${oldPerson}`);
      const amionShift = match[4];

      // Find day
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
        throw new Error(`Cannot find day for date ${date}`);
      }
      const day = data.weeks[dayId.weekIndex].days[dayId.dayIndex];
      const dow = dateToDayOfWeek(day.date);

      // Figure out what shift this is
      const candidates: {
        shift: string;
        day: Day;
        validateThenIgnore?: boolean;
      }[] = [];
      if (
        ['VA Night', 'VA Day Inpatients', 'VA Day Consults'].includes(
          amionShift,
        )
      ) {
        console.log(
          `Ignoring ${amionShift} shift, because we react to HMC instead.`,
        );
        ignoredChanges = true;
        continue;
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
              validateThenIgnore: dow == 'fri',
            });
          }
          candidates.push({
            shift: 'south_power',
            day: friday,
            validateThenIgnore: dow == 'fri',
          });
        }

        if (!(dow == 'fri' || dow == 'sat')) {
          candidates.push({
            shift: 'weekday_south',
            day,
          });
        }
      } else if (
        ['HMC Day Inpatient', 'HMC Day Consult'].includes(amionShift)
      ) {
        if (dow == 'sat' || dow == 'sun') {
          const friday = assertNonNull(
            findDay(data, nextDay(day.date, dow == 'sat' ? -1 : -2)),
          );
          for (const shift of ['weekend_south', 'south_power']) {
            candidates.push({
              shift,
              day: friday,
              validateThenIgnore: true,
            });
          }
        } else {
          throw new Error(
            `Don't know how to handle day shifts not on a weekend.`,
          );
        }
      } else {
        throw new Error(
          `No implementation yet to handle ${amionShift} on ${day.date}`,
        );
      }

      let shift = undefined;
      const errors = [];
      for (const candidate of candidates) {
        const personOnCall = candidate.day.shifts[candidate.shift];
        if (personOnCall !== undefined) {
          if (personOnCall !== oldPerson && !skipShiftCheck) {
            throw new Error(
              `Inferred ${amionShift} on ${day.date} to be ${candidate.shift} on ${candidate.day.date}, but found ${personOnCall} to be on call then, instead of ${oldPerson}.`,
            );
          } else {
            shift = candidate.shift;
            if (candidate.validateThenIgnore) {
              ignoredChanges = true;
            }
            break;
          }
        } else {
          errors.push(
            `${candidate.shift} on ${
              candidate.day.date
            }, but only has ${Object.keys(candidate.day.shifts).join('/')}`,
          );
        }
      }
      if (shift == undefined) {
        if (candidates.length === 0) {
          throw new Error(
            `No candidate shifts found for ${amionShift} on ${day.date}.`,
          );
        }
        throw new Error(
          `Tried to handle ${amionShift} on ${
            day.date
          } using these candidates, but none worked: ${errors.join('; ')}.`,
        );
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
      changes.push(action);
    }

    if (changes.length === 0) {
      if (ignoredChanges) {
        return { kind: 'not-relevant' };
      }
      throw new Error(`No changes found in email.`);
    }

    if (isPending) {
      return {
        kind: 'pending-changes',
        changes,
      };
    }

    return {
      kind: 'changes',
      changes,
    };
  }

  throw new Error(`Unknown email subject: ${request.email.subject}`);
}
