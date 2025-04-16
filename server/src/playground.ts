import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { globalSetup } from './common/error-reporting';
import * as xlsx from 'node-xlsx';
import {
  CallSchedule,
  Day,
  PeopleConfig,
  ROTATIONS,
  Rotation,
  RotationSchedule,
  ShiftKind,
  VacationSchedule,
  Week,
  isHolidayShift,
} from './shared/types';

import * as datefns from 'date-fns';
import {
  IsoDate,
  dateToIsoDate,
  deepCopy,
  isoDateToDate,
  mapEnum,
} from './shared/common/check-type';
import {
  compareData,
  dateToDayOfWeek,
  inferShift,
  nextDay,
  processCallSchedule,
  scheduleToStoredSchedule,
  serializeActions,
} from './shared/compute';
import {
  assertCallSchedule,
  assertIsoDate,
  assertPerson,
} from './shared/check-type.generated';
import { assertRunType } from './check-type.generated';
import { loadStorage, storeStorage } from './storage';
import fs from 'fs';
import { exportSchedule } from './shared/export';
import * as Diff from 'diff';
import deepEqual from 'deep-equal';

// @check-type
export type RunType =
  | 'infer-weekends'
  | 'infer-weekdays'
  | 'noop'
  | 'delete-previous'
  | 'export'
  | 'clear-weekends'
  | 'clear-weekdays'
  | 'diff-previous'
  | 'parse-email'
  | 'day-history';

function runType(): RunType {
  if (process.argv.length < 3) return 'noop';
  const arg = process.argv[2];

  return assertRunType(arg);
}

function findDate(data: CallSchedule, date: string): Day {
  for (const week of data.weeks) {
    for (let idx = 0; idx < week.days.length; idx++) {
      const day = week.days[idx];
      if (day.date === date) {
        return day;
      }
    }
  }
  throw new Error(`Tried to find ${date}, but doesn't exist.`);
}

async function main() {
  await globalSetup();

  const run = runType();

  const storage = loadStorage({
    noCheck: true,
  });

  const latest = storage.versions[storage.versions.length - 1];
  let data = deepCopy(latest.callSchedule);
  console.log(`Latest = ${latest.name}`);

  if (run === 'day-history') {
    if (process.argv.length < 4) {
      console.log(`Usage: yarn playground day-history <date>`);
      return;
    }
    const date = assertIsoDate(process.argv[3]);
    let current = findDate(data, date);
    console.log(current);
    for (const version of [...storage.versions].reverse()) {
      const day = findDate(version.callSchedule, date);
      if (!deepEqual(current, day)) {
        console.log(`${version.ts} - ${version.name} made changes:`);
        console.log(day);
        current = day;
      }
    }
    // Actually, doing this for real in the frontend.
    return;
  }

  if (run == 'parse-email') {
    console.log(`not implemented`);
    return;
  }

  if (run == 'diff-previous') {
    for (let i = 0; i < 8; i++) {
      const n = storage.versions[storage.versions.length - 1 - i];
      const nMinus1 = storage.versions[storage.versions.length - 2 - i];

      const diff = compareData(nMinus1.callSchedule, n.callSchedule);
      if (diff.kind == 'error') {
        console.log(`Error: ${diff.message}`);
      } else {
        console.log(
          `Changes in ${n.name != '' ? n.name : '<unnamed version>'} from ${
            n.ts
          }:`,
        );
        console.log(serializeActions(n.callSchedule, diff.changes));
        console.log('\n\n');
      }
    }
    return;
  }

  if (run == 'clear-weekends') {
    const processed = processCallSchedule(data);
    for (const week of data.weeks) {
      for (const day of week.days) {
        for (const shift of Object.keys(day.shifts)) {
          if (isHolidayShift(processed, day.date, shift)) continue;
          const shiftConfig = data.shiftConfigs[shift];
          if (shiftConfig && shiftConfig.type === 'weekend') {
            day.shifts[shift] = '';
          }
        }
      }
    }
  }

  if (run == 'clear-weekdays') {
    const processed = processCallSchedule(data);
    for (const week of data.weeks) {
      for (const day of week.days) {
        for (const shift of Object.keys(day.shifts)) {
          if (isHolidayShift(processed, day.date, shift)) continue;
          const shiftConfig = data.shiftConfigs[shift];
          if (shiftConfig && shiftConfig.type === 'weekday') {
            day.shifts[shift] = '';
          }
        }
      }
    }
  }

  if (run == 'infer-weekends') {
    const processed = processCallSchedule(data);
    for (const week of data.weeks) {
      const friday = week.days[5];
      if (dateToDayOfWeek(friday.date) !== 'fri')
        throw new Error(`Should be friday: ${dateToDayOfWeek(friday.date)}`);

      if (friday.date < data.firstDay || friday.date > data.lastDay) continue;
      for (const [shift, assigned] of Object.entries(friday.shifts)) {
        if (assigned) continue;

        const inference = inferShift(data, processed, friday.date, shift, {
          enableLog: true,
          skipUnavailablePeople: true,
        });

        if (inference.best) {
          friday.shifts[shift] = inference.best.person;
        }
      }
    }
  }

  if (run == 'infer-weekdays') {
    const processed = processCallSchedule(data);
    for (const week of data.weeks) {
      for (const day of week.days) {
        if (day.date < data.firstDay || day.date > data.lastDay) continue;
        const shift: ShiftKind = 'weekday_south';
        if (!(shift in day.shifts)) continue;
        if (day.shifts[shift]) continue;

        const inference = inferShift(data, processed, day.date, shift, {
          enableLog: true,
          skipUnavailablePeople: true,
        });

        if (inference.best) {
          day.shifts[shift] = inference.best.person;
        }
      }
    }
  }

  if (run == 'noop') {
    console.log('No operation specified.');
    return;
  }

  if (run == 'export') {
    const buffer = await exportSchedule(data);
    const outputFile = `${__dirname}/../../Call-Schedule-AY2025.xlsx`;
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
    fs.writeFileSync(outputFile, buffer as Buffer);
    return;
  }

  switch (run) {
    case 'delete-previous': {
      const x = storage.versions.pop();
      console.log(`Dropped ${x?.name}`);
      break;
    }
    case 'clear-weekends':
    case 'infer-weekends':
    case 'infer-weekdays':
    case 'clear-weekdays': {
      const text = mapEnum(run, {
        'clear-weekends': 'Cleared weekends to start over',
        'clear-weekdays': 'Cleared weekday calls to start over',
        'infer-weekends': 'Auto-assigned weekends',
        'infer-weekdays': 'Auto-assigned weekdays',
      });

      data = assertCallSchedule(data);

      // Print diff
      const previous =
        storage.versions[storage.versions.length - 1].callSchedule;
      const diff = Diff.createPatch(
        'storage.json',
        JSON.stringify(previous, null, 2),
        JSON.stringify(data, null, 2),
        undefined,
        undefined,
        {
          context: 4,
        },
      );
      console.log(diff);

      storage.versions.push(scheduleToStoredSchedule(data, text, '<admin>'));
      console.log(`Saving as: '${text}'`);
      break;
    }
  }
  storeStorage(storage);

  // const data = await importPreviousSchedule();
  // // inferSchedule(data);
  // clearSchedule(data);

  // const storage: StoredCallSchedules = {
  //   versions: [
  //     {
  //       ...scheduleToStoredSchedule(
  //         JSON.parse(
  //           fs.readFileSync(`${__dirname}/shared/init.json`, 'utf-8'),
  //         ) as CallSchedule,
  //         `Example`,
  //       ),
  //       ts: `2024-05-18T15:49:50-07:00` as IsoDatetime,
  //     },
  //     scheduleToStoredSchedule(data, `Empty initial schedule`),
  //   ],
  // };
  // storeStorage(storage);

  // Write to file in data/init.json
  // fs.writeFileSync(
  //   `${__dirname}/shared/init.json`,
  //   JSON.stringify(data, null, 2),
  // );
}

async function _importRotationSchedule(
  people: PeopleConfig,
): Promise<[RotationSchedule, VacationSchedule]> {
  const workSheetsFromFile = xlsx.parse(
    `${__dirname}/../../input-files/vacation scheduling.xlsx`,
  );
  const sheet = workSheetsFromFile[0];

  let rowIndex = 0;

  const vacations: VacationSchedule = {
    MAD: [],
    DK: [],
    LZ: [],
    TW: [],
    CP: [],
    AA: [],
    DC: [],
    AJ: [],
    KO: [],
    RB: [],
    MJ: [],
    TM: [],
    GN: [],
    MB: [],
    CPu: [],
    NR: [],
    LX: [],
    CC: [],
    CF: [],
    HL: [],
    TH: [],
    SO: [],
  };
  const result: RotationSchedule = {
    MAD: [],
    DK: [],
    LZ: [],
    TW: [],
    CP: [],
    AA: [],
    DC: [],
    AJ: [],
    MB: [],
    RB: [],
    MJ: [],
    TM: [],
    GN: [],
    KO: [],
    CPu: [],
    NR: [],
    LX: [],
    CC: [],
    CF: [],
    HL: [],
    TH: [],
    SO: [],
  };

  // Import vacations
  for (rowIndex = 0; rowIndex < 7; rowIndex += 1) {
    for (let col = 3; col <= 3 + 52; col++) {
      const startDay = nextDay('2024-07-01', (col - 3) * 7);
      let per = sheet.data[rowIndex][col] as string;
      if (per === undefined || per == '') continue;
      if (per.includes('(S1)') || per.includes('(S2)')) continue;
      per = per.replace(/[0-9]/, '').replace('*', '');
      if (per == 'TB') per = 'MAD';
      if (per == 'HS') per = 'MAD';
      const person = assertPerson(per);
      vacations[person].push(startDay);
    }
  }

  // Import rotations
  for (rowIndex = 3 + 7; rowIndex < sheet.data.length; rowIndex += 1) {
    if (sheet.data[rowIndex][0] == 'Research') continue; // configured manually
    if (sheet.data[rowIndex][0] == 'U1-Intern') break;
    const per = sheet.data[rowIndex][1] as string;
    const person = Object.keys(people).find(
      p =>
        per &&
        (p.toLowerCase().endsWith(per.toLowerCase()) ||
          (per == 'Madigan' && p == 'MAD')),
    );
    if (person) {
      const personConfig = people[person];
      for (let col = 3; col <= 3 + 52; col++) {
        const startDay = nextDay('2024-07-01', (col - 3) * 7);
        const rotationString = sheet.data[rowIndex][col] as string;
        if (rotationString) {
          const parts = rotationString.split(' ');
          let rotation: Rotation | undefined = undefined;
          let hospital = parts[0];
          if (hospital == 'UWMC') hospital = 'UW';
          if (ROTATIONS.includes(hospital as Rotation)) {
            rotation = hospital as Rotation;
          }
          if (hospital == 'VM') rotation = 'OFF';
          if (hospital == 'NF4') rotation = 'NF';
          if (hospital == 'Andro/URPS') rotation = 'Andro';
          if (hospital == 'WWAMI') rotation = 'Alaska';
          if (hospital == 'RESEARCH') rotation = 'Research';
          if (!rotation) {
            console.log(
              `Couldn't understand rotation string: ${rotationString}. hospital: ${hospital}`,
            );
            continue;
          }
          result[person].push({
            start: startDay,
            rotation,
            chief:
              personConfig.year == 'C' ||
              rotationString.toLocaleLowerCase().includes('chief'),
          });
        }
      }
    }
  }
  return [result, vacations];
}

// async function importPreviousSchedule() {
//   const workSheetsFromFile = xlsx.parse(
//     `${__dirname}/../../input-files/ay24.xlsx`,
//   );
//   const sheet = workSheetsFromFile[1];

//   let rowIndex = 0;
//   let sunday = '';

//   function consumeRow(expected: string[]): boolean {
//     // Check if all remaining rows are empty
//     let allEmpty = true;
//     for (let i = rowIndex; i < sheet.data.length; i++) {
//       if (sheet.data[i].length !== 0) {
//         allEmpty = false;
//         break;
//       }
//     }
//     if (allEmpty == true) {
//       return true;
//     }
//     for (let i = 0; i < expected.length; i++) {
//       if (sheet.data[rowIndex][i] !== expected[i]) {
//         console.log(sheet.data[rowIndex]);
//         throw new Error(
//           `Expected ${expected[i]} at ${i} in row ${rowIndex} and day ${sunday}`,
//         );
//       }
//     }
//     rowIndex += 1;
//     return false;
//   }

//   function rand<T>(arr: T[]): T {
//     return arr[Math.floor(Math.random() * arr.length)];
//   }

//   function consumeCall(pool: CallPool): MaybeCallPoolPerson[] {
//     const key = mapEnum(pool, {
//       north: 'NWH/SCH',
//       uw: 'UWMC',
//       south: 'HMC/VA',
//     });
//     if (sheet.data[rowIndex][0] !== key) {
//       throw new Error(`Expected ${pool} call to start with string ${key}`);
//     }
//     const call = sheet.data[rowIndex].slice(1) as string[];
//     rowIndex += 1;
//     // This is not true for holidays, skip for now.
//     // if (sheet.data[rowIndex].length !== 0) {
//     //   console.log(sheet.data[rowIndex]);
//     //   throw new Error(`Expected empty row after ${pool} row for ${sunday}`);
//     // }
//     rowIndex += 1;
//     for (let i = 0; i < call.length; i++) {
//       let parts = call[i].split(`>`);
//       if (parts.length === 1) {
//         parts = call[i].split(`--`);
//       }
//       call[i] = parts[parts.length - 1];
//       call[i] = call[i].replace(/\*/g, '');
//       call[i] = call[i].trim();
//       call[i] = call[i].toUpperCase();

//       if (rowIndex === 4 || rowIndex === 6 || rowIndex === 8) {
//         call[i] = {
//           JR: 'CP',
//           LZ: 'LX',
//           DC: 'AJ',
//           TW: 'AA',
//           AJ: 'MB',
//           CC: 'RB',
//           DK: 'DC',
//           AA: 'MJ',
//           LX: 'TM',
//           JC: 'LZ',
//         }[call[i]] as string;
//       }

//       switch (call[i]) {
//         case 'MADIGAN':
//           call[i] = 'MAD';
//           break;
//         // old 2 -> new 2
//         case 'MB':
//           call[i] = 'GN';
//           break;
//         case 'RB':
//           call[i] = 'KO';
//           break;
//         case 'MJ':
//           call[i] = 'CPu';
//           break;
//         case 'TM':
//           call[i] = 'NR';
//           break;
//         // old 3 -> new 3
//         case 'AJ':
//         case 'LX':
//         case 'CC':
//           call[i] = rand(['MB', 'RB', 'MJ', 'TM']);
//           break;
//         // old r -> new r
//         case 'DC':
//           call[i] = 'LX';
//           break;
//         case 'AA':
//           call[i] = 'CC';
//           break;
//         // old 4 -> new 4
//         case 'TW':
//           call[i] = 'DC';
//           break;
//         case 'LZ':
//           call[i] = 'AA';
//           break;
//         case 'DK':
//           call[i] = 'AJ';
//           break;
//         case 'CP':
//           call[i] = rand(['DC', 'AA', 'AJ']);
//           break;
//         default:
//           throw new Error(`Unknown person ${call[i]} at row ${rowIndex}`);
//       }
//     }
//     return call;
//   }

//   let weeks: Array<{
//     sunday: string;
//     north: MaybeCallPoolPerson[];
//     uw: MaybeCallPoolPerson[];
//     south: MaybeCallPoolPerson[];
//   }> = [];
//   for (rowIndex = 0; rowIndex < sheet.data.length; ) {
//     // Header row
//     if (
//       consumeRow([
//         undefined as unknown as string,
//         'Sunday',
//         'Sunday after 5pm',
//         'Monday',
//         'Tuesday',
//         'Wednesday',
//         'Thursday',
//         'Friday',
//         'Saturday',
//       ])
//     )
//       break;

//     // Date row
//     sunday = xlsxDateToIsoDate(sheet.data[rowIndex][1]);
//     rowIndex += 1;

//     // Actual schedule
//     const north = consumeCall('north');
//     const uw = consumeCall('uw');
//     const south = consumeCall('south');

//     consumeRow(['Vacation']);
//     consumeRow(['Special']);
//     consumeRow(['Conference']);
//     consumeRow(['Events']);

//     weeks.push({ sunday, north, uw, south });
//   }
//   weeks = weeks.slice(0, -1);

//   const allPeople = new Set<string>();
//   for (const week of weeks) {
//     for (const call of [week.north, week.uw, week.south]) {
//       if (call.length != 8) {
//         console.log(week);
//         console.log(call);
//         throw new Error('Expected 8 calls');
//       }
//       for (const person of call) {
//         allPeople.add(person);
//       }
//     }
//   }

//   const data: CallSchedule = {
//     firstDay: '2024-06-30',
//     lastDay: '2025-06-30',
//     weeks: [],
//     shiftConfigs,
//     chiefShiftConfigs,
//     callTargets,
//     people,
//     holidays: {},
//     specialDays: {
//       '2024-10-27': 'Western AUA',
//       '2024-10-28': 'Western AUA',
//       '2024-10-29': 'Western AUA',
//       '2024-10-30': 'Western AUA',
//       '2024-10-31': 'Western AUA',
//       '2024-11-01': 'Western AUA',
//       '2024-11-16': 'In-Service Exam',
//       '2025-04-26': 'AUA',
//       '2025-04-27': 'AUA',
//       '2025-04-28': 'AUA',
//       '2025-04-29': 'AUA',
//       '2025-05-30': 'Chief Board Review',
//       '2025-05-31': 'Chief Board Review',
//       '2025-06-01': 'Chief Board Review',
//       '2025-06-07': 'Graduation',
//     },
//     vacations: {
//       LZ: [],
//       MAD: [],
//       DK: [],
//       TW: [],
//       CP: [],
//       AA: [],
//       DC: [],
//       AJ: [],
//       LX: [],
//       CC: [],
//       MB: [],
//       RB: [],
//       MJ: [],
//       TM: [],
//       GN: [],
//       KO: [],
//       CPu: [],
//       NR: [],
//       CF: [],
//       HL: [],
//       TH: [],
//       SO: [],
//     },
//     rotations: {
//       MAD: [],
//       DK: [],
//       LZ: [],
//       TW: [],
//       CP: [],
//       AA: [],
//       DC: [],
//       AJ: [],
//       LX: [],
//       CC: [],
//       MB: [],
//       RB: [],
//       MJ: [],
//       TM: [],
//       GN: [],
//       KO: [],
//       CPu: [],
//       NR: [],
//       CF: [],
//       HL: [],
//       TH: [],
//       SO: [],
//     },
//   };

//   [data.rotations, data.vacations] = await importRotationSchedule();

//   {
//     let sunday: IsoDate = '2024-06-30' as IsoDate;
//     function sundayPlus(days: number) {
//       return dateToIsoDate(datefns.addDays(isoDateToDate(sunday), days));
//     }
//     for (const week of weeks) {
//       const days: Day[] = [];

//       // Weekday calls
//       for (let i = 0; i < 5; i++) {
//         days.push({
//           date: sundayPlus(i),
//           shifts: {
//             weekday_south: week.south[1 + i],
//           },
//           backupShifts: {},
//         });
//       }
//       // Weekend call (on Friday)
//       days.push({
//         date: sundayPlus(5),
//         shifts: {
//           weekend_south: week.south[6],
//           weekend_uw: week.uw[6],
//           weekend_nwhsch: week.north[6],
//         },
//         backupShifts: {},
//       });
//       // Saturday (no shifts)
//       days.push({
//         date: sundayPlus(6),
//         shifts: {},
//         backupShifts: {},
//       });

//       const newWeek: Week = {
//         sundayDate: sunday,
//         days,
//       };
//       data.weeks.push(newWeek);

//       // Next week
//       sunday = sundayPlus(7);
//     }

//     // Override holidays
//     data.holidays = {
//       '2024-07-04': 'Indep. Day',
//       '2024-09-02': 'Labor Day',
//       '2024-10-14': 'Indigenous Ppl',
//       '2024-11-11': 'Veterans Day',
//       '2024-11-28': 'Thanksgiving',
//       '2024-11-29': 'Thanksgiving',
//       '2024-12-25': 'Christmas',
//       '2025-01-01': 'New Year',
//       '2025-01-20': 'MLK Day',
//       '2025-02-17': "President's Day",
//       '2025-05-26': 'Memorial Day',
//       '2025-06-19': 'Juneteenth',
//     };

//     for (const [date, name] of Object.entries(data.holidays)) {
//       const dow = dateToDayOfWeek(date);

//       if (name == 'Indigenous Ppl') {
//         const monday = findDate(data, date);
//         monday.shifts.day_va = '';
//         continue;
//       }

//       // Monday holidays
//       if (dow === 'mon') {
//         const friday = findDate(data, nextDay(date, -3));
//         const sunday = findDate(data, nextDay(date, -1));
//         const monday = findDate(data, date);
//         sunday.shifts = {};
//         friday.shifts = {
//           weekend_nwhsch: '',
//           weekend_uw: '',
//           south_power: '',
//         };
//         monday.shifts = {
//           day_nwhsch: '',
//           day_uw: '',
//           south_24: '',
//         };
//       }

//       // Handled below
//       else if (name === 'Thanksgiving') {
//         continue;
//       }

//       // Wednesday/Thursday holidays
//       else if (dow == 'wed' || dow == 'thu') {
//         const weekday = findDate(data, date);
//         weekday.shifts = {
//           day_nwhsch: '',
//           day_uw: '',
//           south_24: '',
//         };
//       } else {
//         throw new Error(
//           `Don't know how to handle call for holiday ${name} on ${date}`,
//         );
//       }
//     }

//     // Thanksgiving
//     {
//       const date = '2024-11-28';
//       const thursday = findDate(data, date);
//       // const friday = findDate(datePlusN(date, 1));
//       // const wednesday = findDate(datePlusN(date, -1));
//       // wednesday.shifts = {
//       //   thanksgiving_south: '',
//       // };
//       thursday.shifts = {
//         day_2x_nwhsch: '',
//         day_2x_uw: '',
//         south_34: '',
//       };
//       // friday.shifts = {
//       //   power_south: '',
//       //   power_nwhsch: '',
//       //   power_uw: '',
//       // };
//     }
//   }

//   const processed = processCallSchedule(data);

//   // check call target matches up.
//   let weekday = 0;
//   for (const year in data.callTargets.weekday) {
//     const weekdayTargets = assertNonNull(
//       data.callTargets.weekday[year as Year],
//     );
//     for (const person in weekdayTargets) {
//       weekday += weekdayTargets[person];
//     }
//   }
//   if (processed.totalCalls.weekday != weekday) {
//     throw new Error(
//       `Expected ${processed.totalCalls.weekday} weekday calls, got ${weekday} from WEEKDAY_CALL_TARGET`,
//     );
//   }
//   let weekend = 0;
//   for (const year in data.callTargets.weekend) {
//     const weekendTargets = assertNonNull(
//       data.callTargets.weekend[year as Year],
//     );
//     for (const person in weekendTargets) {
//       weekend += weekendTargets[person];
//     }
//   }
//   if (processed.totalCalls.weekend != weekend) {
//     throw new Error(
//       `Expected ${processed.totalCalls.weekend} weekend calls, got ${weekend} from WEEKEND_CALL_TARGET`,
//     );
//   }

//   for (const person of callPoolPeople(data)) {
//     const priority = data.people[person].priorityWeekendSaturday;
//     if (priority) {
//       if (dateToDayOfWeek(priority) != 'sat') {
//         throw new Error(`Priority weekend should be a Saturday: ${priority}`);
//       }
//     }
//   }

//   // haw many weeks south vs north
//   const southWeekdays: Record<CallPoolPerson, number> = {} as Record<
//     CallPoolPerson,
//     number
//   >;
//   const northWeekdays: Record<CallPoolPerson, number> = {} as Record<
//     CallPoolPerson,
//     number
//   >;
//   for (const week of data.weeks) {
//     for (const day of week.days) {
//       const dow = dateToDayOfWeek(day.date);
//       if (dow == 'sun' || dow == 'sat') continue;
//       for (const person of callPoolPeople(data)) {
//         if (!northWeekdays[person]) northWeekdays[person] = 0;
//         if (!southWeekdays[person]) southWeekdays[person] = 0;
//         const info = processed.day2person2info?.[day.date]?.[person];
//         if (info) {
//           switch (info.rotation) {
//             case 'Research':
//             case 'UW':
//             case 'SCH':
//             case 'NWH':
//             case 'Andro':
//               northWeekdays[person] += 1;
//               break;
//             case 'VA':
//             case 'HMC':
//               southWeekdays[person] += 1;
//               break;
//             case 'Alaska':
//             case 'NF':
//             case 'OFF':
//               break;
//           }
//         }
//       }
//     }
//   }

//   if (1 == 1 + 1) {
//     console.log(
//       `Here's how much people spend at a south rotation vs how much south call they take.`,
//     );
//     for (const person of callPoolPeople(data)) {
//       const personConfig = data.people[person];
//       console.log(
//         `${person.length > 2 ? '' : ' '}${person}: ${
//           southWeekdays[person]
//         } <-> ${data.callTargets.weekday[personConfig.year as 'R'][person]}`,
//       );
//     }
//   }

//   assertCallSchedule(data);
//   assertCallScheduleProcessed(processed);

//   return data;
// }

function _xlsxDateToIsoDate(xlsxDate: unknown) {
  if (typeof xlsxDate !== 'number') {
    throw new Error('Expected number');
  }
  const date = new Date(1900, 0, xlsxDate - 1);
  return date.toISOString().split('T')[0];
}

// 2024-09-14: good start, but probably doesn't fully work
function _fillEmptyCallSchedule(data: CallSchedule) {
  let sunday: IsoDate = '2024-06-30' as IsoDate;
  function sundayPlus(days: number) {
    return dateToIsoDate(datefns.addDays(isoDateToDate(sunday), days));
  }
  for (let weekIdx = 0; weekIdx < 53; weekIdx++) {
    const days: Day[] = [];

    // Weekday calls
    for (let i = 0; i < 5; i++) {
      days.push({
        date: sundayPlus(i),
        shifts: {
          weekday_south: '',
        },
        backupShifts: {},
      });
    }
    // Weekend call (on Friday)
    days.push({
      date: sundayPlus(5),
      shifts: {
        weekend_south: '',
        weekend_uw: '',
        weekend_nwhsch: '',
      },
      backupShifts: {},
    });
    // Saturday (no shifts)
    days.push({
      date: sundayPlus(6),
      shifts: {},
      backupShifts: {},
    });

    const newWeek: Week = {
      sundayDate: sunday,
      days,
    };
    data.weeks.push(newWeek);

    // Next week
    sunday = sundayPlus(7);
  }

  for (const [date, name] of Object.entries(data.holidays)) {
    const dow = dateToDayOfWeek(date);

    if (name == 'Indigenous Ppl') {
      const monday = findDate(data, date);
      monday.shifts.day_va = '';
      continue;
    }

    // Monday holidays
    if (dow === 'mon') {
      const friday = findDate(data, nextDay(date, -3));
      const sunday = findDate(data, nextDay(date, -1));
      const monday = findDate(data, date);
      sunday.shifts = {};
      friday.shifts = {
        weekend_nwhsch: '',
        weekend_uw: '',
        south_power: '',
      };
      monday.shifts = {
        day_nwhsch: '',
        day_uw: '',
        south_24: '',
      };
    }

    // Handled below
    else if (name === 'Thanksgiving') {
      continue;
    }

    // Wednesday/Thursday holidays
    else if (dow == 'wed' || dow == 'thu') {
      const weekday = findDate(data, date);
      weekday.shifts = {
        day_nwhsch: '',
        day_uw: '',
        south_24: '',
      };
    } else {
      throw new Error(
        `Don't know how to handle call for holiday ${name} on ${date}`,
      );
    }
  }

  // Thanksgiving
  {
    const date = '2024-11-28';
    const thursday = findDate(data, date);
    // const friday = findDate(datePlusN(date, 1));
    // const wednesday = findDate(datePlusN(date, -1));
    // wednesday.shifts = {
    //   thanksgiving_south: '',
    // };
    thursday.shifts = {
      day_2x_nwhsch: '',
      day_2x_uw: '',
      south_34: '',
    };
    // friday.shifts = {
    //   power_south: '',
    //   power_nwhsch: '',
    //   power_uw: '',
    // };
  }

  // TODO: add backup shifts
  // if (run == 'add-chief-shifts') {
  //   for (const week of data.weeks) {
  //     for (const day of week.days) {
  //       const dow = dateToDayOfWeek(day.date);
  //       day.backupShifts = {};
  //       if (dow == 'sat' || dow == 'sun') continue;
  //       if (dow == 'fri') {
  //         day.backupShifts.backup_weekend = '';
  //       } else {
  //         day.backupShifts.backup_weekday = '';
  //       }
  //     }
  //   }

  //   // holiday backup call
  //   for (const [date, name] of Object.entries(data.holidays)) {
  //     const dow = dateToDayOfWeek(date);

  //     if (name == 'Indigenous Ppl') {
  //       continue;
  //     }

  //     // Monday holidays
  //     if (dow == 'mon') {
  //       const friday = findDate(data, nextDay(date, -3));
  //       const monday = findDate(data, date);
  //       friday.backupShifts = {
  //         backup_holiday: '',
  //       };
  //       monday.backupShifts = {};
  //     }

  //     // Handled below
  //     else if (name === 'Thanksgiving') {
  //       continue;
  //     }

  //     // Wednesday/Thursday holidays
  //     else if (dow == 'wed' || dow == 'thu') {
  //       const weekday = findDate(data, date);
  //       const dayBefore = findDate(data, nextDay(date, -1));
  //       dayBefore.backupShifts = {
  //         backup_holiday: '',
  //       };
  //       weekday.backupShifts = {};
  //     } else {
  //       throw new Error(
  //         `Don't know how to handle call for holiday ${name} on ${date}`,
  //       );
  //     }
  //   }

  //   // Thanksgiving
  //   {
  //     const date = '2024-11-28';
  //     const thursday = findDate(data, date);
  //     const friday = findDate(data, nextDay(date, 1));
  //     const wednesday = findDate(data, nextDay(date, -1));
  //     wednesday.backupShifts = {
  //       backup_holiday: '',
  //     };
  //     thursday.backupShifts = {};
  //     friday.backupShifts = {};
  //   }

  //   assertCallSchedule(data);
  //   latest.callSchedule = data;
  //   storeStorage(storage);

  //   console.log(`Added chief shifts`);
  //   return;
  // }
}

void main();
