import {
  CALL_POOL,
  CallPoolPerson,
  CallSchedule,
  ShiftKind,
  isHolidayShift,
} from './types';

import * as datefns from 'date-fns';
import { IsoDate, assertNonNull, isoDateToDate, mapEnum } from 'check-type';
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
function _MkColor<T extends SimpleCellType | SimpleCellType[]>(
  cell: T,
  color: string,
): T {
  if (Array.isArray(cell)) {
    return cell.map(c => _MkColor(c, color)) as T;
  }
  const result = simpleCellToCell(cell);
  result.color = color;
  return result as T;
}
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
  | 'weekday_south'
  | 'weekend_south'
  | 'weekend_uw'
  | 'weekend_nwhsch'
  | 'day_uw'
  | 'day_va'
  | 'day_nwhsch'
  | 'south_24'
  | 'south_34'
  | 'south_power';

const EXPORT_SHIFT_ORDER: ExportShiftKind[] = [
  'weekend_nwhsch',
  'weekend_uw',
  'weekend_south',
  'weekday_south',
  'day_nwhsch',
  'day_uw',
  'south_24',
  'south_34',
  'south_power',
  'day_va',
];

const _HOLIDAY_COLOR = '#ffeeee';
const HOLIDAY_BORDER = '#ff0000';
const SPECIAL_BORDER = '#0000ff';
const TABLE_BORDER = '#888888';
export async function exportSchedule(
  data: CallSchedule,
): Promise<ExcelJS.Buffer> {
  const processed = processCallSchedule(data);
  const rows: SimpleCellType[][] = [];

  const shifts: {
    [day: string]: {
      [Property in ExportShiftKind]?: {
        person: string;
        isHoliday: boolean;
      };
    };
  } = {};
  let day = data.firstDay;
  while (day <= data.lastDay) {
    shifts[day] = {};
    day = nextDay(day);
  }

  day = data.firstDay;
  while (day <= data.lastDay) {
    const idx = processed.day2weekAndDay[day];
    for (const [s, person] of Object.entries(
      data.weeks[idx.weekIndex].days[idx.dayIndex].shifts,
    )) {
      const shift = s as ShiftKind;
      const call = {
        person,
        isHoliday: Boolean(isHolidayShift(processed, day, shift)),
      };
      const exportShift =
        shift == 'day_2x_nwhsch'
          ? 'day_nwhsch'
          : shift == 'day_2x_uw'
            ? 'day_uw'
            : shift;
      shifts[day][exportShift] = call;
      switch (shift) {
        case 'weekday_south':
        case 'south_24':
        case 'south_34':
        case 'day_uw':
        case 'day_va':
        case 'day_nwhsch':
          break;
        case 'weekend_south':
        case 'weekend_uw':
        case 'weekend_nwhsch':
          shifts[nextDay(day, 1)][exportShift] = call;
          shifts[nextDay(day, 2)][exportShift] = call;
          break;
        case 'south_power':
          shifts[nextDay(day, 1)][exportShift] = call;
          shifts[nextDay(day, 2)][exportShift] = call;
          shifts[nextDay(day, 3)][exportShift] = call;
        case 'day_2x_uw':
        case 'day_2x_nwhsch':
          shifts[nextDay(day, 1)][exportShift] = call;
          break;
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
  rows.push(['MAD', { text: '', background: yearToColor('M') }]);
  rows.push(['Senior resident', { text: '', background: yearToColor('S') }]);
  rows.push(['Research resident', { text: '', background: yearToColor('R') }]);
  rows.push(['R3 resident', { text: '', background: yearToColor('3') }]);
  rows.push(['R2 resident', { text: '', background: yearToColor('2') }]);

  rows.push([]);
  rows.push([]);

  function shiftName(shift: ShiftKind) {
    return mapEnum(shift, {
      weekday_south: 'Weekday South (5pm-7am)',
      weekend_south: 'Weekend South (5pm-5pm)',
      weekend_uw: 'Weekend UW (5pm-5pm)',
      weekend_nwhsch: 'Weekend NWH/SCH (5pm-5pm)',
      day_uw: 'Day UW (7am-5pm)',
      day_nwhsch: 'Day NWH/SCH (7am-5pm)',
      day_va: 'Day VA (7am-5pm)',
      south_24: 'South 24 (7am-7am)',
      south_34: 'South 34 (7am-5pm)',
      south_power: 'Weekend South Power (5pm-7am)',
      day_2x_uw: 'Day UW (7am-5pm) both Thu and Fri',
      day_2x_nwhsch: 'Day NWH/SCH (7am-5pm) both Thu and Fri',
    });
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
      const peopleOnVacation = CALL_POOL.filter(p => {
        const info = processed.day2person2info[day.date]?.[p];
        return info && info.onVacation;
      });
      vacations.push(peopleOnVacation.join(', '));

      const peoplePriorityWeekend = CALL_POOL.filter(p => {
        const info = processed.day2person2info[day.date]?.[p];
        return info && info.onPriorityWeekend;
      });
      priorityWeekend.push(peoplePriorityWeekend.join(', '));

      for (const [s, person] of Object.entries(shifts[day.date] ?? {})) {
        const shift = s as ExportShiftKind;
        if (!shiftData[shift]) {
          shiftData[shift] = [];
        }
        assertNonNull(shiftData[shift])[dayIndex] = {
          text: person.person,
          background: yearToColor(
            assertNonNull(data.people[person.person as CallPoolPerson]).year,
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

    for (const shift of EXPORT_SHIFT_ORDER) {
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
  for (const person of CALL_POOL) {
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
          background: yearToColor(
            assertNonNull(data.people[person as CallPoolPerson]).year,
          ),
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
  for (const person of CALL_POOL) {
    const shifts = collectHolidayCall(person, data, processed);
    const { calls, hours } = countHolidayShifts(shifts);
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
            background: yearToColor(
              assertNonNull(data.people[person as CallPoolPerson]).year,
            ),
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
