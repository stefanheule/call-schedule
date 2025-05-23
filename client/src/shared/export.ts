import {
  CallSchedule,
  MaybeChief,
  ShiftKind,
  callPoolPeople,
  isHolidayShift,
} from './types';

import * as datefns from 'date-fns';
import { IsoDate, assertNonNull, isoDateToDate } from './common/check-type';
import {
  collectHolidayCall,
  countHolidayShifts,
  nextDay,
  processCallSchedule,
  yearToColor,
} from './compute';

type CellType = {
  text: string;
  color?: string;
  italic?: boolean;
  background?: string;
  bold?: boolean;
  border?: string;
  borderTop?: string;
  borderBottom?: string;
  borderDashed?: boolean;
  fontSize?: number;
  noWrap?: boolean;
};

type SimpleCellType = CellType | string;

function MkBold<T extends SimpleCellType | SimpleCellType[]>(cell: T): T {
  if (Array.isArray(cell)) {
    return cell.map(c => MkBold(c)) as T;
  }
  const result = simpleCellToCell(cell);
  result.bold = true;
  return result as T;
}
// function _MkColor<T extends SimpleCellType | SimpleCellType[]>(
//   cell: T,
//   color: string,
// ): T {
//   if (Array.isArray(cell)) {
//     return cell.map(c => _MkColor(c, color)) as T;
//   }
//   const result = simpleCellToCell(cell);
//   result.color = color;
//   return result as T;
// }
function Mk<T extends SimpleCellType | SimpleCellType[]>(
  cell: T,
  config: Omit<CellType, 'text'>,
): T {
  if (Array.isArray(cell)) {
    return cell.map(c => Mk(c, config)) as T;
  }
  const result = {
    ...config,
    ...simpleCellToCell(cell),
  };
  return result as T;
}

type ExportShiftKind =
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  'backup' | ShiftKind;

// const _HOLIDAY_COLOR = '#ffeeee';
const HOLIDAY_BORDER = '#ff0000';
const SPECIAL_BORDER = '#0000ff';
const TABLE_BORDER = '#888888';
export async function exportSchedule(
  data: CallSchedule,
): Promise<ExcelJS.Buffer> {
  const processed = processCallSchedule(data);
  const rows: SimpleCellType[][] = [];

  const shifts: {
    [day: string]: Record<
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
      ShiftKind | 'backup',
      {
        person: string;
        isHoliday: boolean;
      }
    >;
  } = {};
  let day = data.firstDay;
  while (day <= data.lastDay) {
    shifts[day] = {};
    day = nextDay(day);
  }

  day = data.firstDay;
  let lastBackup:
    | {
        person: MaybeChief;
        isHoliday: boolean;
      }
    | undefined = undefined;
  while (day <= data.lastDay) {
    const idx = processed.day2weekAndDay[day];
    const backupShifts = Object.entries(
      data.weeks[idx.weekIndex].days[idx.dayIndex].backupShifts,
    );
    if (backupShifts.length > 0) {
      if (backupShifts.length > 1) {
        throw new Error(`Multiple backups on ${day}`);
      }
      lastBackup = {
        person: backupShifts[0][1],
        isHoliday: backupShifts[0][0].includes('holiday'),
      };
    }
    if (lastBackup) {
      shifts[day].backup = lastBackup;
    }
    for (const [shift, person] of Object.entries(
      data.weeks[idx.weekIndex].days[idx.dayIndex].shifts,
    )) {
      const call = {
        person,
        isHoliday: Boolean(isHolidayShift(processed, day, shift)),
      };
      const shiftConfig = data.shiftConfigs[shift];
      const exportShift = shiftConfig.exportKind ?? shiftConfig.kind;
      shifts[day][exportShift] = call;
      for (
        let i = 0;
        i < (shiftConfig.daysForExport ?? shiftConfig.days);
        i++
      ) {
        shifts[nextDay(day, i)][exportShift] = call;
      }
    }
    day = nextDay(day);
  }

  rows.push([
    {
      text: 'Call Schedule for AY2025',
      fontSize: 26,
      bold: true,
      noWrap: true,
    },
  ]);
  rows.push([
    {
      text: `Last updated on ${datefns.format(
        new Date(),
        'EEE, M/d/yyyy',
      )} at ${datefns.format(new Date(), 'h:mm a')}`,
      noWrap: true,
    },
  ]);
  rows.push([]);
  rows.push([
    {
      text: `Legend`,
      bold: true,
    },
  ]);
  rows.push([
    'Holiday call',
    { text: '', border: HOLIDAY_BORDER, borderDashed: true },
  ]);
  rows.push([
    'Conference/event/etc',
    { text: '', border: SPECIAL_BORDER, borderDashed: true },
  ]);
  rows.push(['Chief resident', { text: '', background: yearToColor('C') }]);
  rows.push(['MAD', { text: '', background: yearToColor('M') }]);
  rows.push(['Senior resident', { text: '', background: yearToColor('S') }]);
  rows.push(['Research resident', { text: '', background: yearToColor('R') }]);
  rows.push(['R3 resident', { text: '', background: yearToColor('3') }]);
  rows.push(['R2 resident', { text: '', background: yearToColor('2') }]);

  rows.push([]);
  rows.push([]);

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  function shiftName(shift: ShiftKind | 'backup') {
    if (shift == 'backup') {
      return 'Chief Backup Call';
    }
    return data.shiftConfigs[shift].nameLong;
  }

  for (const week of data.weeks) {
    const dates: SimpleCellType[] = [];
    const shiftData: {
      [Property in ExportShiftKind]?: SimpleCellType[];
    } = {};
    const vacations: SimpleCellType[] = [];
    const priorityWeekend: SimpleCellType[] = [];
    const holidays: SimpleCellType[] = [];
    let dayIndex = 0;
    for (const day of week.days) {
      dates.push(datefns.format(isoDateToDate(day.date), 'EEE, M/d'));
      holidays.push(
        data.holidays[day.date]
          ? {
              text: data.holidays[day.date],
              border: HOLIDAY_BORDER,
              borderDashed: true,
            }
          : data.specialDays[day.date]
            ? {
                text: data.specialDays[day.date],
                border: SPECIAL_BORDER,
                borderDashed: true,
              }
            : '',
      );
      const peopleOnVacation = callPoolPeople(data).filter(p => {
        const info = processed.day2person2info[day.date]?.[p];
        return info && info.onVacation;
      });
      vacations.push(peopleOnVacation.join(', '));

      const peoplePriorityWeekend = callPoolPeople(data).filter(p => {
        const info = processed.day2person2info[day.date]?.[p];
        return info && info.onPriorityWeekend;
      });
      priorityWeekend.push(peoplePriorityWeekend.join(', '));

      for (const [shift, person] of Object.entries(shifts[day.date] ?? {})) {
        if (!shiftData[shift]) {
          shiftData[shift] = [];
        }
        if (person.person == '') continue;
        assertNonNull(shiftData[shift])[dayIndex] = {
          text: person.person,
          background: yearToColor(
            assertNonNull(data.people[person.person]).year,
          ),
          border: person.isHoliday ? HOLIDAY_BORDER : undefined,
          borderDashed: true,
        };
      }
      dayIndex += 1;
    }
    rows.push(MkBold(['', ...dates]));
    if (!holidays.every(x => x == '')) {
      rows.push(['Holidays/Special', ...holidays]);
    }
    const LESS_IMPORTANT_STYLE = {
      color: '#555555',
      italic: true,
    } as const;
    if (!vacations.every(x => x == '')) {
      rows.push(Mk(['Vacations', ...vacations], LESS_IMPORTANT_STYLE));
    }
    if (!priorityWeekend.every(x => x == '')) {
      rows.push(
        Mk(['Priority Weekend', ...priorityWeekend], LESS_IMPORTANT_STYLE),
      );
    }

    const exportedShiftsOrder = dedup([
      'backup',
      ...Object.values(data.shiftConfigs).map(x => x.exportKind ?? x.kind),
    ]);
    for (const shift of exportedShiftsOrder) {
      const name = shiftName(shift);
      const sd = shiftData[shift];
      if (sd) {
        rows.push([name, ...[0, 1, 2, 3, 4, 5, 6].map(i => sd[i] ?? '')]);
      }
    }

    rows.push([]);
    rows.push([]);
  }

  const rows2: SimpleCellType[][] = [];
  rows2.push([
    {
      text: 'Call Tallies',
      fontSize: 26,
      bold: true,
      noWrap: true,
    },
  ]);
  rows2.push([
    {
      text: `Each call shift is either a weekday call (Sun - Thu night south call), a weekend call (Fri - Sun call),`,
      noWrap: true,
    },
  ]);
  rows2.push([
    {
      text: `a holiday call (any call during a holiday/holiday weekend) or night float. There is no double-counting,`,
      noWrap: true,
    },
  ]);
  rows2.push([
    {
      text: `if a weekend call happens during a holiday, it is counted as a holiday call, and not as a weekend call.`,
      noWrap: true,
    },
  ]);
  rows2.push([]);
  rows2.push([MkBold(`Regular calls`)]);
  rows2.push(
    MkBold([
      `Person`,
      `Weekend calls`,
      `Weekday calls (Sun - Thu)`,
      `Weekday calls (Sun only)`,
      `Night Float`,
    ]),
  );
  for (const person of callPoolPeople(data)) {
    const callCount = processed.callCounts[person];
    rows2.push(
      Mk(
        [
          person,
          `${callCount.weekend}`,
          `${callCount.weekday + callCount.sunday}`,
          `${callCount.sunday}`,
          `${callCount.nf}`,
        ],
        {
          background: yearToColor(assertNonNull(data.people[person]).year),
          borderTop: TABLE_BORDER,
        },
      ),
    );
  }

  rows2.push(Mk(['', '', '', '', ''], { borderTop: TABLE_BORDER }));
  rows2.push([MkBold(`Holiday calls`)]);
  rows2.push(
    MkBold([`Person`, `Holiday calls`, `Holiday call hours`, `List of calls`]),
  );
  for (const person of callPoolPeople(data)) {
    const shifts = collectHolidayCall(person, data, processed);
    const { calls, hours } = countHolidayShifts(data, shifts);
    shifts.forEach((shift, index) => {
      rows2.push(
        Mk(
          [
            index == 0 ? person : '',
            index == 0 ? `${calls}` : ``,
            index == 0 ? `${hours}` : ``,
            {
              text: `${shiftName(shift.shift)} on ${datefns.format(
                isoDateToDate(shift.day as IsoDate),
                'EEE, M/d',
              )} during ${shift.holiday}`,
            },
          ],
          {
            background: yearToColor(assertNonNull(data.people[person]).year),
            borderTop: index == 0 ? TABLE_BORDER : undefined,
          },
        ),
      );
    });
  }
  rows2.push(Mk(['', '', '', ''], { borderTop: TABLE_BORDER }));

  return await rowsToXlsx([
    {
      name: 'Call Schedule AY2025',
      rows,
      fn: worksheet => {
        worksheet.columns.forEach((column, index) => {
          column.width = index == 0 ? 25 : 11;
        });
      },
    },
    {
      name: 'Call Tallies',
      rows: rows2,
      fn: worksheet => {
        worksheet.columns.forEach((column, index) => {
          column.width = index == 0 ? 15 : 11;
        });
        for (let index = 25; index <= rows2.length; index++) {
          worksheet.mergeCells(`D${index}:K${index}`);
        }
      },
    },
  ]);
}

function simpleCellToCell(cell: SimpleCellType): CellType {
  if (typeof cell === 'string') {
    return { text: cell };
  }
  return cell;
}

import * as ExcelJS from 'exceljs';
import { dedup } from './common/check-type';
function cssColorToExcel(color: string): {
  argb: string;
} {
  return { argb: 'FF' + color.replace('#', '') };
}
async function rowsToXlsx(
  sheets: {
    name: string;
    rows: SimpleCellType[][];
    fn?: (worksheet: ExcelJS.Worksheet) => void;
  }[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const rows = sheet.rows.map(row => row.map(simpleCellToCell));
    const worksheet = workbook.addWorksheet(sheet.name);

    let rowIndex = 1;
    for (const row of rows) {
      let colIndex = 1;
      for (const cell of row) {
        const excelCell = worksheet.getCell(rowIndex, colIndex);
        excelCell.value = cell.text;
        if (cell.color) {
          if (!excelCell.font) excelCell.font = {};
          excelCell.font.color = cssColorToExcel(cell.color);
        }
        if (cell.italic) {
          if (!excelCell.font) excelCell.font = {};
          excelCell.font.italic = true;
        }
        if (cell.bold) {
          if (!excelCell.font) excelCell.font = {};
          excelCell.font.bold = true;
        }
        if (cell.fontSize) {
          if (!excelCell.font) excelCell.font = {};
          excelCell.font.size = cell.fontSize;
        }
        if (cell.background) {
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: cssColorToExcel(cell.background),
          };
        }
        const borderStyle = cell.borderDashed ? 'mediumDashed' : 'thin';
        if (cell.border) {
          const border: ExcelJS.Border = {
            color: cssColorToExcel(cell.border),
            style: borderStyle,
          };
          excelCell.border = {
            bottom: border,
            top: border,
            left: border,
            right: border,
          };
        }
        if (cell.borderTop) {
          if (!excelCell.border) excelCell.border = {};
          excelCell.border.top = {
            color: cssColorToExcel(cell.borderTop),
            style: borderStyle,
          };
        }
        if (cell.borderBottom) {
          if (!excelCell.border) excelCell.border = {};
          excelCell.border.bottom = {
            color: cssColorToExcel(cell.borderBottom),
            style: borderStyle,
          };
        }
        excelCell.alignment = {
          wrapText: cell.noWrap ? false : true,
          vertical: 'top',
        };
        colIndex += 1;
      }

      rowIndex += 1;
    }

    if (sheet.fn) {
      sheet.fn(worksheet);
    }
  }

  // Save the workbook to a file
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
