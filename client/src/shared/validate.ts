import { CallSchedule, Person, SingleCallTarget, YEAR_ORDER } from './types';
import { dateToDayOfWeek, nextDay } from './compute';
import { assertNonNull, IsoDate } from './common/check-type';

export function validateData(data: CallSchedule): void {
  function validateDate(date: string, location: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        `${location}: Invalid date format: ${date}. Use YYYY-MM-DD.`,
      );
    }
    if (date < data.firstDay) {
      throw new Error(
        `${location}: Date ${date} is before the first day of the schedule.`,
      );
    }
    if (date > data.lastDay) {
      throw new Error(
        `${location}: Date ${date} is after the last day of the schedule.`,
      );
    }
  }
  function nonNegative(value: number, location: string): void {
    if (value < 0) {
      throw new Error(`${location}: must be non-negative.`);
    }
  }
  function nonEmpty<T>(value: T[] | string, location: string): void {
    if (value.length == 0) {
      throw new Error(`${location}: must be non-empty.`);
    }
  }

  if (data.firstDay >= data.lastDay) {
    throw new Error('First day must be before last day.');
  }

  let previous = nextDay(data.weeks[0].days[0].date, -1);
  data.weeks.forEach((week, weekIndex) => {
    if (week.sundayDate != week.days[0].date) {
      throw new Error(
        `Week ${weekIndex + 1}: Sunday date ${
          week.sundayDate
        } is not the same as the first day ${week.days[0].date}.`,
      );
    }
    week.days.forEach((day, dayIndex) => {
      if (weekIndex != 0 && day.date < data.firstDay) {
        throw new Error(
          `Week ${weekIndex + 1}, day ${dayIndex + 1}: Date ${
            day.date
          } is before the first day of the schedule.`,
        );
      }
      if (weekIndex != data.weeks.length - 1 && day.date > data.lastDay) {
        throw new Error(
          `Week ${weekIndex + 1}, day ${dayIndex + 1}: Date ${
            day.date
          } is after the last day of the schedule.`,
        );
      }
      if (day.date != nextDay(previous, 1)) {
        throw new Error(
          `Week ${weekIndex + 1}, day ${dayIndex + 1}: Date ${
            day.date
          } is not the day after ${previous}.`,
        );
      }
      previous = day.date;

      const dow = dateToDayOfWeek(day.date);

      for (const shift in day.shifts) {
        const config = data.shiftConfigs[shift];
        if (!config) {
          throw new Error(
            `Week ${weekIndex + 1}, day ${
              dayIndex + 1
            }: Shift ${shift} is not defined in shiftConfigs.`,
          );
        }
        const p = day.shifts[shift];
        const person = data.people[p];
        if (p != '') {
          if (!person) {
            throw new Error(
              `Week ${weekIndex + 1}, day ${
                dayIndex + 1
              }: Person ${p} is not defined in people.`,
            );
          }

          if (person.year == '1' || person.year == 'C') {
            throw new Error(
              `Week ${weekIndex + 1}, day ${dayIndex + 1}: ${
                day.date
              } cannot have a first-year or chief on call for ${shift}.`,
            );
          }
        }

        if (config.type == 'weekday' && (dow == 'fri' || dow == 'sat')) {
          throw new Error(
            `Week ${weekIndex + 1}, day ${dayIndex + 1}: ${
              day.date
            } cannot have a weekday call (${shift}) on a non-weekday.`,
          );
        }
      }

      for (const shift in day.backupShifts) {
        if (!data.chiefShiftConfigs[shift]) {
          throw new Error(
            `Week ${weekIndex + 1}, day ${
              dayIndex + 1
            }: Backup shift ${shift} is not defined in shiftConfigs.`,
          );
        }
        const p = day.backupShifts[shift];
        const person = data.people[p];
        if (p != '') {
          if (!person) {
            throw new Error(
              `Week ${weekIndex + 1}, day ${
                dayIndex + 1
              }: Person ${p} is not defined in people.`,
            );
          }
          if (person.year != 'C') {
            throw new Error(
              `Week ${weekIndex + 1}, day ${dayIndex + 1}: ${
                day.date
              } cannot have non-chief on backup call for ${shift}.`,
            );
          }
        }
      }
    });
  });

  for (const shift in data.shiftConfigs) {
    const config = data.shiftConfigs[shift];
    if (shift !== config.kind) {
      throw new Error(
        `Shift ${shift}: kind ${config.kind} does not match shift name.`,
      );
    }
    nonNegative(config.days, `days for shift config ${shift}`);
    nonNegative(
      config.daysForConsecutiveCall,
      `daysForConsecutiveCall for shift config ${shift}`,
    );
    if (config.daysForExport !== undefined)
      nonNegative(
        config.daysForExport,
        `daysForExport for shift config ${shift}`,
      );
    nonNegative(config.hours, `hours for shift config ${shift}`);
    nonEmpty(config.hospitals, `hospitals for shift config ${shift}`);
    nonEmpty(config.name, `name for shift config ${shift}`);
    nonEmpty(config.nameLong, `nameLong for shift config ${shift}`);
  }

  for (const shift in data.chiefShiftConfigs) {
    const config = data.chiefShiftConfigs[shift];
    if (shift !== config.kind) {
      throw new Error(
        `Backup shift ${shift}: kind ${config.kind} does not match shift name.`,
      );
    }
    nonEmpty(config.name, `name for backup shift config ${shift}`);
    nonEmpty(config.nameLong, `nameLong for backup shift config ${shift}`);
  }

  function validateCallTarget(target: SingleCallTarget, location: string) {
    const checked: Record<Person, boolean> = {};
    for (const year of YEAR_ORDER) {
      if (!(year in target)) {
        throw new Error(`${location}: call target for ${year} is missing.`);
      }
      if (year == '1' || year == 'C') {
        if (Object.keys(target[year]).length > 0) {
          throw new Error(
            `${location}: call target for ${year} must be empty.`,
          );
        }
      }
      for (const person in target[year]) {
        if (checked[person]) {
          throw new Error(
            `${location}: call target for ${year} has duplicate person ${person}.`,
          );
        }
        checked[person] = true;
        const config = data.people[person];
        if (!config) {
          throw new Error(
            `${location}: call target for ${year} has undefined person ${person}.`,
          );
        }
        if (config.year != year) {
          throw new Error(
            `${location}: call target for ${year} has person ${person} with year ${config.year}.`,
          );
        }
      }
    }
    for (const p in data.people) {
      const person = data.people[p];
      if (person.year !== '1' && person.year !== 'C' && !checked[p]) {
        throw new Error(
          `${location}: call target is missing person ${p} with year ${person.year}.`,
        );
      }
    }
  }
  validateCallTarget(data.callTargets.weekday, 'weekday call target');
  validateCallTarget(data.callTargets.weekend, 'weekend call target');

  for (const person in data.people) {
    const config = data.people[person];
    if (person.length < 2 || person.length > 3) {
      throw new Error(
        `Person ${person}: short name must be 2 or 3 characters long.`,
      );
    }
    if (config.priorityWeekendSaturday) {
      validateDate(
        config.priorityWeekendSaturday,
        `priorityWeekendSaturday for person ${person}`,
      );
      const dow = dateToDayOfWeek(config.priorityWeekendSaturday);
      if (dow != 'sat') {
        throw new Error(
          `Person ${person}: priorityWeekendSaturday must be a Saturday, but it's ${dow}.`,
        );
      }
    }
    if (config.maternity) {
      validateDate(
        config.maternity.from,
        `maternity.from for person ${person}`,
      );
      validateDate(config.maternity.to, `maternity.to for person ${person}`);
      if (config.maternity.from >= config.maternity.to) {
        throw new Error(
          `Person ${person}: maternity.from must be before maternity.to.`,
        );
      }
    }
    if (person != 'MAD') {
      if (Array.isArray(config.name.first)) {
        if (
          !config.name.first.some(
            first => first[0].toLowerCase() == person[0].toLowerCase(),
          )
        ) {
          throw new Error(
            `Person ${person}: name.first must contain a name starting with ${person[0]}.`,
          );
        }
      } else {
        if (config.name.first[0].toLowerCase() != person[0].toLowerCase()) {
          throw new Error(
            `Person ${person}: name.first must start with ${person[0]}.`,
          );
        }
      }
      if (Array.isArray(config.name.last)) {
        if (
          !config.name.last.some(
            last => last[0].toLowerCase() == person[1].toLowerCase(),
          )
        ) {
          throw new Error(
            `Person ${person}: name.last must contain a name starting with ${person[1]}.`,
          );
        }
      } else {
        if (config.name.last[0].toLowerCase() != person[1].toLowerCase()) {
          throw new Error(
            `Person ${person}: name.last must start with ${person[1]}.`,
          );
        }
      }
    } else {
      if (
        !Array.isArray(config.name.first) ||
        !Array.isArray(config.name.last)
      ) {
        throw new Error(
          `Person ${person}: name.first and name.last must be arrays.`,
        );
      }
      if (config.name.first.length != config.name.last.length) {
        throw new Error(
          `Person ${person}: name.first and name.last must have the same length.`,
        );
      }
    }
  }

  for (const d in data.holidays) {
    const date = d as IsoDate;
    const holiday = data.holidays[date];
    validateDate(date, `holiday ${holiday}`);
  }
  for (const d in data.specialDays) {
    const date = d as IsoDate;
    const specialDay = data.specialDays[date];
    validateDate(date, `special day ${specialDay}`);
  }

  for (const person in data.vacations) {
    const vacations = data.vacations[person];
    vacations.forEach((vacation, index) => {
      if (typeof vacation == 'string') {
        validateDate(vacation, `vacation #${index + 1} for person ${person}`);
        const dow = dateToDayOfWeek(vacation);
        if (dow != 'mon') {
          throw new Error(
            `Vacation #${
              index + 1
            } for person ${person} should be a Monday, but it's ${dow}.`,
          );
        }
      } else {
        validateDate(
          vacation.start,
          `split vacation #${index + 1} start day for person ${person}`,
        );
        nonNegative(
          vacation.length,
          `split vacation #${index + 1} length for person ${person}`,
        );
      }
    });
  }

  for (const person in data.rotations) {
    const rotations = data.rotations[person];
    const personConfig = data.people[person];
    let previous: IsoDate | null = null;
    rotations.forEach((rotation, index) => {
      validateDate(
        rotation.start,
        `rotation #${index + 1} for person ${person}`,
      );

      if (rotation.chief && !['S', 'C'].includes(personConfig.year)) {
        throw new Error(
          `Rotation #${index + 1} at ${
            rotation.rotation
          } for person ${person} is a service chief rotation, but they are not a senior or chief.`,
        );
      }

      if (previous && rotation.start <= previous) {
        throw new Error(
          `Rotation #${index + 1} at ${
            rotation.rotation
          } for person ${person} starts before the previous rotation ends.`,
        );
      }

      previous = rotation.start;
    });
  }
}

/*

export type CallSchedule = {
  lastEditedBy?: string;
  lastEditedAt?: IsoDatetime;

  firstDay: IsoDate;
  lastDay: IsoDate;
  weeks: Week[];

  shiftConfigs: ShiftConfigs;
  chiefShiftConfigs: ChiefShiftConfigs;

  callTargets: CallTarget;
  people: PeopleConfig;
  holidays: Holidays;
  specialDays: SpecialDays;
  vacations: VacationSchedule;
  rotations: RotationSchedule;

  isPublic?: boolean;
  currentUser?: string;
};
*/
