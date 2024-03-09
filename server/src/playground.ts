import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { globalSetup } from './common/error-reporting';
import * as xlsx from 'node-xlsx';
import { CallPool } from './shared/types';

// eslint-disable-next-line unused-imports/no-unused-imports
import * as datefns from 'date-fns';
import { mapEnum } from 'check-type';

async function main() {
  await globalSetup();

  await importPreviousSchedule();
}

async function importPreviousSchedule() {
  const workSheetsFromFile = xlsx.parse(
    `${__dirname}/../../input-files/ay24.xlsx`,
  );
  const sheet = workSheetsFromFile[1];
  console.log(sheet.data.slice(0, 13));
  console.log(xlsxDateToIsoDate(sheet.data[1][1]));

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

  function consumeCall(pool: CallPool) {
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
    }
    return call;
  }

  let weeks: Array<{
    sunday: string;
    north: string[];
    uw: string[];
    south: string[];
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

  const people = new Set<string>();
  for (const week of weeks) {
    for (const call of [week.north, week.uw, week.south]) {
      if (call.length != 8) {
        console.log(week);
        console.log(call);
        throw new Error('Expected 8 calls');
      }
      for (const person of call) {
        people.add(person);
      }
    }
  }
  console.log(people);
}

function xlsxDateToIsoDate(xlsxDate: unknown) {
  if (typeof xlsxDate !== 'number') {
    throw new Error('Expected number');
  }
  const date = new Date(1900, 0, xlsxDate - 1);
  return date.toISOString().split('T')[0];
}

void main();
