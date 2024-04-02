import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { globalSetup } from './common/error-reporting';
import * as xlsx from 'node-xlsx';
import {
  ALL_PEOPLE,
  CallPool,
  CallSchedule,
  Day,
  HospitalKind,
  MaybePerson,
  Person,
  PersonConfig,
  ROTATIONS,
  Week,
} from './shared/types';

import * as datefns from 'date-fns';
import fs from 'fs';
import { IsoDate, dateToIsoDate, isoDateToDate, mapEnum } from 'check-type';

async function main() {
  await globalSetup();

  await importPreviousSchedule();
}

const people: {
  [Property in Person]: PersonConfig;
} = {
  MAD: {
    name: 'MAD',
    year: 'M',
  },
  DK: {
    name: 'DK',
    year: 'C',
  },
  LZ: {
    name: 'LZ',
    year: 'C',
  },
  TW: {
    name: 'TW',
    year: 'C',
  },
  CP: {
    name: 'CP',
    year: 'C',
  },
  AA: {
    name: 'AA',
    year: 'S',
  },
  DC: {
    name: 'DC',
    year: 'S',
  },
  AJ: {
    name: 'AJ',
    year: 'S',
  },
  LX: {
    name: 'LX',
    year: 'R',
  },
  CC: {
    name: 'CC',
    year: 'R',
  },
  MB: {
    name: 'MB',
    year: '3',
  },
  RB: {
    name: 'RB',
    year: '3',
  },
  MJ: {
    name: 'MJ',
    year: '3',
  },
  TM: {
    name: 'TM',
    year: '3',
  },
  GN: {
    name: 'GN',
    year: '2',
  },
  KO: {
    name: 'KO',
    year: '2',
  },
  CPu: {
    name: 'CPu',
    year: '2',
  },
  NR: {
    name: 'NR',
    year: '2',
  },
};

async function importPreviousSchedule() {
  const workSheetsFromFile = xlsx.parse(
    `${__dirname}/../../input-files/ay24.xlsx`,
  );
  const sheet = workSheetsFromFile[1];

  let rowIndex = 0;
  let sunday = '';

  function consumeRow(expected: string[]): boolean {
    // Check if all remaining rows are empty
    let allEmpty = true;
    for (let i = rowIndex; i < sheet.data.length; i++) {
      if (sheet.data[i].length !== 0) {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty == true) {
      return true;
    }
    for (let i = 0; i < expected.length; i++) {
      if (sheet.data[rowIndex][i] !== expected[i]) {
        console.log(sheet.data[rowIndex]);
        throw new Error(
          `Expected ${expected[i]} at ${i} in row ${rowIndex} and day ${sunday}`,
        );
      }
    }
    rowIndex += 1;
    return false;
  }

  function rand<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function consumeCall(pool: CallPool): MaybePerson[] {
    const key = mapEnum(pool, {
      north: 'NWH/SCH',
      uw: 'UWMC',
      south: 'HMC/VA',
    });
    if (sheet.data[rowIndex][0] !== key) {
      throw new Error(`Expected ${pool} call to start with string ${key}`);
    }
    const call = sheet.data[rowIndex].slice(1) as string[];
    rowIndex += 1;
    // This is not true for holidays, skip for now.
    // if (sheet.data[rowIndex].length !== 0) {
    //   console.log(sheet.data[rowIndex]);
    //   throw new Error(`Expected empty row after ${pool} row for ${sunday}`);
    // }
    rowIndex += 1;
    for (let i = 0; i < call.length; i++) {
      let parts = call[i].split(`>`);
      if (parts.length === 1) {
        parts = call[i].split(`--`);
      }
      call[i] = parts[parts.length - 1];
      call[i] = call[i].replace(/\*/g, '');
      call[i] = call[i].trim();
      call[i] = call[i].toUpperCase();

      if (rowIndex === 4 || rowIndex === 6 || rowIndex === 8) {
        call[i] = {
          JR: 'CP',
          LZ: 'LX',
          DC: 'AJ',
          TW: 'AA',
          AJ: 'MB',
          CC: 'RB',
          DK: 'DC',
          AA: 'MJ',
          LX: 'TM',
          JC: 'LZ',
        }[call[i]] as string;
      }

      switch (call[i]) {
        case 'MADIGAN':
          break;
        // old 2 -> new 2
        case 'MB':
          call[i] = 'GN';
          break;
        case 'RB':
          call[i] = 'KO';
          break;
        case 'MJ':
          call[i] = 'CPu';
          break;
        case 'TM':
          call[i] = 'NR';
          break;
        // old 3 -> new 3
        case 'AJ':
        case 'LX':
        case 'CC':
          call[i] = rand(['MB', 'RB', 'MJ', 'TM']);
          break;
        // old r -> new r
        case 'DC':
          call[i] = 'LX';
          break;
        case 'AA':
          call[i] = 'CC';
          break;
        // old 4 -> new 4
        case 'TW':
          call[i] = 'DC';
          break;
        case 'LZ':
          call[i] = 'AA';
          break;
        case 'DK':
          call[i] = 'AJ';
          break;
        case 'CP':
          call[i] = rand(['DC', 'AA', 'AJ']);
          break;
        default:
          throw new Error(`Unknown person ${call[i]} at row ${rowIndex}`);
      }
    }
    return call as MaybePerson[];
  }

  let weeks: Array<{
    sunday: string;
    north: MaybePerson[];
    uw: MaybePerson[];
    south: MaybePerson[];
  }> = [];
  for (rowIndex = 0; rowIndex < sheet.data.length; ) {
    // Header row
    if (
      consumeRow([
        undefined as unknown as string,
        'Sunday',
        'Sunday after 5pm',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ])
    )
      break;

    // Date row
    sunday = xlsxDateToIsoDate(sheet.data[rowIndex][1]);
    rowIndex += 1;

    // Actual schedule
    const north = consumeCall('north');
    const uw = consumeCall('uw');
    const south = consumeCall('south');

    consumeRow(['Vacation']);
    consumeRow(['Special']);
    consumeRow(['Conference']);
    consumeRow(['Events']);

    weeks.push({ sunday, north, uw, south });
  }
  weeks = weeks.slice(0, -1);

  const allPeople = new Set<string>();
  for (const week of weeks) {
    for (const call of [week.north, week.uw, week.south]) {
      if (call.length != 8) {
        console.log(week);
        console.log(call);
        throw new Error('Expected 8 calls');
      }
      for (const person of call) {
        allPeople.add(person);
      }
    }
  }

  const SOUTH_HOSPITALS: HospitalKind[] = ['HMC', 'VA'];
  const NWHSCH_HOSPITALS: HospitalKind[] = ['NWH', 'SCH'];
  const data: CallSchedule = {
    firstDay: '2024-07-01',
    lastDay: '2025-06-30',
    weeks: [],
    shiftConfigs: {
      weekday_south: {
        kind: `weekday_south`,
        name: `South`,
        hospitals: SOUTH_HOSPITALS,
        days: 2,
      },
      weekend_uw: {
        kind: 'weekend_uw',
        name: 'UW',
        hospitals: ['UW'],
        days: 3,
      },
      weekend_nwhsch: {
        kind: 'weekend_nwhsch',
        name: 'NWH/SCH',
        hospitals: NWHSCH_HOSPITALS,
        days: 3,
      },
      weekend_south: {
        kind: 'weekend_south',
        name: `South`,
        hospitals: SOUTH_HOSPITALS,
        days: 3,
      },
      day_nwhsch: {
        kind: 'day_nwhsch',
        name: `NWH/SCH Day`,
        hospitals: NWHSCH_HOSPITALS,
        days: 1,
      },
      day_uw: {
        kind: 'day_uw',
        name: `UW Day`,
        hospitals: ['UW'],
        days: 1,
      },
      south_24: {
        kind: 'south_24',
        name: `South 24`,
        hospitals: SOUTH_HOSPITALS,
        days: 2,
      },
      power_nwhsch: {
        kind: 'power_nwhsch',
        name: `Power NWH/SCH`,
        hospitals: NWHSCH_HOSPITALS,
        days: 3,
      },
      power_uw: {
        kind: 'power_uw',
        name: `Power UW`,
        hospitals: ['UW'],
        days: 3,
      },
      power_south: {
        kind: 'power_south',
        name: `Power South`,
        hospitals: SOUTH_HOSPITALS,
        days: 3,
      },
      thanksgiving_south: {
        kind: 'thanksgiving_south',
        name: `Thanksgiving South`,
        hospitals: SOUTH_HOSPITALS,
        days: 3,
      },
    },
    people,
    holidays: {},
    vacations: {
      LZ: ['2024-07-10'],
      MAD: [],
      DK: [],
      TW: [],
      CP: [],
      AA: [],
      DC: [],
      AJ: [],
      LX: [],
      CC: [],
      MB: [],
      RB: [],
      MJ: [],
      TM: [],
      GN: [],
      KO: [],
      CPu: [],
      NR: [],
    },
    rotations: {
      MAD: [],
      DK: [],
      LZ: [],
      TW: [],
      CP: [],
      AA: [],
      DC: [],
      AJ: [],
      LX: [],
      CC: [],
      MB: [],
      RB: [],
      MJ: [],
      TM: [],
      GN: [],
      KO: [],
      CPu: [],
      NR: [],
    },
  };

  // add dummy rotation info
  let i = 0;
  for (const person of ALL_PEOPLE) {
    const p: Person = person;
    data.rotations[p].push({
      start: '2024-04-01',
      rotation: ROTATIONS[i],
    });
    i = (i + 1) % ROTATIONS.length;
  }

  {
    let sunday: IsoDate = '2024-06-30' as IsoDate;
    function sundayPlus(days: number) {
      return dateToIsoDate(datefns.addDays(isoDateToDate(sunday), days));
    }
    for (const week of weeks) {
      const days: Day[] = [];

      // Weekday calls
      for (let i = 0; i < 5; i++) {
        days.push({
          date: sundayPlus(i),
          shifts: {
            weekday_south: week.south[1 + i],
          },
        });
      }
      // Weekend call (on Friday)
      days.push({
        date: sundayPlus(5),
        shifts: {
          weekend_south: week.south[6],
          weekend_uw: week.uw[6],
          weekend_nwhsch: week.north[6],
        },
      });
      // Saturday (no shifts)
      days.push({
        date: sundayPlus(6),
        shifts: {},
      });

      const newWeek: Week = {
        sundayDate: sunday,
        days,
      };
      data.weeks.push(newWeek);

      // Next week
      sunday = sundayPlus(7);
    }

    function findDate(date: string): Day {
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
    function datePlusN(date: string, n: number): IsoDate {
      const day = isoDateToDate(date as IsoDate);
      day.setDate(day.getDate() + n);
      return dateToIsoDate(day);
    }

    // Override holidays
    data.holidays = {
      '2024-07-04': 'Indep. Day',
      '2024-09-02': 'Labor Day',
      '2024-10-14': 'Indigenous Ppl',
      '2024-11-11': 'Veterans Day',
      '2024-11-28': 'Thanksgiving',
      '2024-11-29': 'Thanksgiving',
      '2024-12-25': 'Christmas',
      '2025-01-01': 'New Year',
      '2025-01-20': 'MLK Day',
      '2025-02-17': "President's Day",
      '2025-05-26': 'Memorial Day',
      '2025-06-19': 'Juneteenth',
    };

    for (const [date, name] of Object.entries(data.holidays)) {
      const dateObj = isoDateToDate(datePlusN(date, 0));

      // Monday holidays
      if (dateObj.getDay() === 1) {
        const sunday = findDate(datePlusN(date, -1));
        const monday = findDate(date);
        sunday.shifts = {
          south_24: '',
        };
        monday.shifts = {
          day_nwhsch: '',
          day_uw: '',
        };
      }

      // Wednesday/Thursday holidays
      else if (dateObj.getDay() === 3 || dateObj.getDay() === 4) {
        const weekday = findDate(date);
        weekday.shifts = {
          day_nwhsch: '',
          day_uw: '',
          south_24: '',
        };
      } else if (name === 'Thanksgiving') {
        continue; // handled below
      } else {
        throw new Error(
          `Don't know how to handle call for holiday ${name} on ${date}`,
        );
      }
    }

    // Thanksgiving
    {
      const date = '2024-11-28';
      const thursday = findDate(date);
      const friday = findDate(datePlusN(date, 1));
      const wednesday = findDate(datePlusN(date, -1));
      wednesday.shifts = {
        thanksgiving_south: '',
      };
      thursday.shifts = {
        day_nwhsch: '',
        day_uw: '',
        south_24: '',
      };
      friday.shifts = {
        power_south: '',
        power_nwhsch: '',
        power_uw: '',
      };
    }
  }

  // Write to file in data/init.json
  fs.writeFileSync(
    `${__dirname}/shared/init.json`,
    JSON.stringify(data, null, 2),
  );

  return data;
}

function xlsxDateToIsoDate(xlsxDate: unknown) {
  if (typeof xlsxDate !== 'number') {
    throw new Error('Expected number');
  }
  const date = new Date(1900, 0, xlsxDate - 1);
  return date.toISOString().split('T')[0];
}

void main();
