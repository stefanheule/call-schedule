import { assertNonNull, isoDateToDate, mapEnumWithDefault } from 'check-type';
import { Children, Column, Row } from '../common/flex';
import { DefaultTextSize, Heading, Text } from '../common/text';
import {
  CallSchedule,
  DayId,
  PersonConfig,
  ShiftId,
  WeekId,
  YearOnSchedule,
  Year,
  yearToString,
  LocalData,
  ShiftKind,
  MaybePerson,
  Person,
} from '../shared/types';
import { useData, useLocalData, useProcessedData } from './data-context';
import * as datefns from 'date-fns';
import React, { createContext, forwardRef, useContext, useState } from 'react';
import { Button, Dialog } from '@mui/material';

const DAY_SPACING = `2px`;

export function RenderCallSchedule() {
  return (
    <PersonPickerProvider>
      <Column
        style={{
          height: '100%',
        }}
      >
        <DefaultTextSize defaultSize={'12px'}>
          <Row
            crossAxisAlignment="start"
            style={{
              height: '100%',
            }}
          >
            <Column
              spacing="5px"
              style={{
                overflowY: 'scroll',
                height: '100%',
              }}
            >
              {Array.from({ length: 53 }).map((_, i) => (
                <RenderWeek key={i} id={{ weekIndex: i }} />
              ))}
            </Column>
            <Column
              style={{
                marginLeft: `10px`,
              }}
            >
              <Highlight />
              <Heading>Errors</Heading>
            </Column>
          </Row>
        </DefaultTextSize>
      </Column>
      <PersonPickerDialog />
    </PersonPickerProvider>
  );
}

function Highlight() {
  const [data] = useData();
  const [_, setLocalData] = useLocalData();
  const year2people = getYearToPeople(data);
  return (
    <Column spacing="5px">
      <Heading>Highlight</Heading>
      {Object.entries(year2people).map(([year, people]) => (
        <Row key={year}>
          <Text style={{ width: '60px' }}>{yearToString(year as Year)}</Text>
          <Row spacing="5px">
            {people.map(person => (
              <RenderPerson
                key={person.id}
                person={person.id}
                style={{
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setLocalData((localData: LocalData) => {
                    localData.highlightedPeople[person.id] =
                      !localData.highlightedPeople[person.id];
                    return { ...localData };
                  });
                }}
              />
            ))}
          </Row>
        </Row>
      ))}
    </Column>
  );
}

function RenderWeek({ id }: { id: WeekId }) {
  const [data] = useData();
  const week = data.weeks[id.weekIndex];
  return (
    <Row
      crossAxisAlignment="start"
      spacing={DAY_SPACING}
      style={{
        boxSizing: 'border-box',
      }}
    >
      <RenderLegend />
      {week.days.map((day, dayIndex) => (
        <RenderDay id={{ ...id, dayIndex }} key={day.date} />
      ))}
    </Row>
  );
}

const DAY_WIDTH = 110;
const DAY_PADDING = 5;
const DAY_VACATION_HEIGHT = '20px';
const DAY_BORDER = `1px solid black`;
const DAY_BOX_STYLE: React.CSSProperties = {
  padding: `2px ${DAY_PADDING}px`,
};

function RenderLegend() {
  return (
    <Column
      style={{
        border: DAY_BORDER,
        boxSizing: 'border-box',
        borderRadius: `5px`,
        minHeight: `100px`,
      }}
    >
      <Column
        style={{
          ...DAY_BOX_STYLE,
          color: 'white',
        }}
      >
        <Text>.</Text>
        <Text>.</Text>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, height: DAY_VACATION_HEIGHT }}>
        <Text>Vacations</Text>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE }}>
        <Text>Call</Text>
      </Column>
    </Column>
  );
}

function RenderDay({ id }: { id: DayId }) {
  const [data] = useData();
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const date = isoDateToDate(day.date);
  const processed = useProcessedData();
  const isHoliday = data.holidays[day.date] !== undefined;

  if (id.dayIndex == 4 && id.weekIndex === 0) {
    console.log(day);
  }
  return (
    <Column
      style={{
        border: DAY_BORDER,
        boxSizing: 'border-box',
        borderRadius: `5px`,
        width: `${DAY_WIDTH}px`,
        minHeight: `100px`,
        opacity: day.date < data.firstDay || day.date > data.lastDay ? 0.5 : 1,
      }}
    >
      <Column
        style={{
          color: isHoliday ? 'red' : 'black',
          backgroundColor: isHoliday ? '#fee' : undefined,
          ...DAY_BOX_STYLE,
        }}
      >
        <Text>{datefns.format(date, 'EEEE, M/d')}</Text>
        <Text color={isHoliday ? undefined : 'white'}>
          {data.holidays[day.date] ?? '.'}
        </Text>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, height: DAY_VACATION_HEIGHT }}>
        {/* {processed.day2hospital2people[day.date] &&
          Object.entries(processed.day2hospital2people[day.date]).map(
            ([hospital, people]) => (
              <RenderHospital
                hospital={hospital}
                people={people}
                key={`${day.date}-${hospital}`}
              />
            ),
          )} */}
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE }}>
        {Object.entries(day.shifts).map(([shiftName]) => (
          <RenderShift
            id={{ ...id, shiftName: shiftName as ShiftKind }}
            key={`${day.date}-${shiftName}`}
          />
        ))}
      </Column>
    </Column>
  );
}

function RenderHospital({
  hospital,
  people,
}: {
  hospital: string;
  people: string[] | undefined;
}) {
  console.log(people);
  return null;
}

function RenderShift({ id }: { id: ShiftId }) {
  const [data, setData] = useData();
  const personId =
    data.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName] ?? '';
  const personPicker = usePersonPicker();
  const name = data.shiftConfigs[id.shiftName].name;
  return (
    <Column
      style={{
        boxSizing: 'border-box',
        border: `1px solid #ccc`,
        marginBottom: `1px`,
        cursor: 'pointer',
        minHeight: '44px',
        padding: '3px',
        // position: 'relative',
        // left: `${-DAY_PADDING}px`,
        // width: `${DAY_WIDTH-2}px`,
      }}
      onClick={() => {
        personPicker.requestDialog(
          person =>
            setData((d: CallSchedule) => {
              d.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName] =
                person;
              return { ...d };
            }),
          personId,
        );
      }}
    >
      <Text>{name}</Text>
      <Row>
        <RenderPerson person={personId} />
      </Row>
    </Column>
  );
}

function personToColor(
  data: CallSchedule,
  person: MaybePerson | undefined,
  dark: boolean = false,
): string {
  const personConfig = person ? data.people[person] : undefined;
  return yearToColor(personConfig?.year, dark);
}

function yearToColor(year: string | undefined, dark: boolean = false): string {
  const color = mapEnumWithDefault(
    year as string,
    {
      R: '#baffc9', // green
      '2': '#ffffba', // yellow
      '3': '#ffdfba', // orange
      S: '#ffb3ba', // red
      M: '#bae1ff', // blue
    },
    '#ccc',
  );
  if (dark) return shadeColor(color, -20);
  return color;
}

function shadeColor(color: string, percent: number) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = (R * (100 + percent)) / 100;
  G = (G * (100 + percent)) / 100;
  B = (B * (100 + percent)) / 100;

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  R = Math.round(R);
  G = Math.round(G);
  B = Math.round(B);

  const RR = R.toString(16).length == 1 ? '0' + R.toString(16) : R.toString(16);
  const GG = G.toString(16).length == 1 ? '0' + G.toString(16) : G.toString(16);
  const BB = B.toString(16).length == 1 ? '0' + B.toString(16) : B.toString(16);

  return '#' + RR + GG + BB;
}

function RenderPerson({
  person,
  style,
  onClick,
}: {
  person: MaybePerson;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const [data] = useData();
  const [localData] = useLocalData();
  if (!person) {
    return null;
  }
  return (
    <ColorPill
      color={personToColor(data, person)}
      style={style}
      onClick={onClick}
      highlighted={localData.highlightedPeople[person]}
    >
      <Text
        style={{
          textAlign: 'center',
          padding: `0 2px`,
        }}
      >
        {person}
      </Text>
    </ColorPill>
  );
}

export const ColorPill = forwardRef(function ColorPillImp(
  {
    color,
    children,
    more,
    style,
    onClick,
    highlighted,
  }: {
    color: string;
    size?: string;
    style?: React.CSSProperties;
    more?: Record<string, unknown>;
    onClick?: () => void;
    highlighted?: boolean;
  } & Children,
  ref: React.Ref<HTMLDivElement>,
): JSX.Element {
  return (
    <div
      style={{
        ...style,
        backgroundColor: color,
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 3px',
        border: highlighted ? '2px solid black' : `2px solid ${color}`,
      }}
      {...more}
      onClick={onClick}
      ref={ref}
    >
      {children}
    </div>
  );
});

type PersonPickerType = {
  requestDialog: (
    callback: (person: MaybePerson) => void,
    currentPersonId: MaybePerson,
  ) => void;
  handleDialogResult: (person: MaybePerson) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentPerson: MaybePerson;
};

const PersonPickerContext = createContext<PersonPickerType | undefined>(
  undefined,
);

export function usePersonPicker(): PersonPickerType {
  return assertNonNull(useContext(PersonPickerContext));
}

export const PersonPickerProvider = ({ children }: Children) => {
  const [isOpen, setIsOpen] = useState(false);
  const [onResult, setOnResult] = useState(() => (_: MaybePerson) => {});
  const [currentPerson, setCurrentPerson] = useState<MaybePerson>('');

  const requestDialog = (
    callback: (person: MaybePerson) => void,
    currentPersonId: MaybePerson,
  ) => {
    setIsOpen(true);
    setOnResult(() => callback);
    setCurrentPerson(currentPersonId);
  };

  const handleDialogResult = (person: MaybePerson) => {
    setIsOpen(false);
    onResult(person);
  };

  return (
    <PersonPickerContext.Provider
      value={{
        requestDialog,
        handleDialogResult,
        isOpen,
        setIsOpen,
        currentPerson,
      }}
    >
      {children}
    </PersonPickerContext.Provider>
  );
};

function getYearToPeople(
  data: CallSchedule,
): Record<YearOnSchedule, (PersonConfig & { id: Person })[]> {
  const yearToPeople: Record<
    YearOnSchedule,
    (PersonConfig & { id: Person })[]
  > = {
    '2': [],
    '3': [],
    S: [],
    R: [],
    M: [],
  };
  for (const [id, person] of Object.entries(data.people)) {
    if (person.year == '1' || person.year == 'C') continue;
    yearToPeople[person.year].push({ ...person, id: id as Person });
  }
  return yearToPeople;
}

function PersonPickerDialog() {
  const personPicker = usePersonPicker();
  const [data] = useData();

  const yearToPeople = getYearToPeople(data);
  return (
    <Dialog
      open={personPicker.isOpen}
      style={{
        minWidth: '650px',
        minHeight: '400px',
      }}
      maxWidth="xl"
      onClose={() => personPicker.setIsOpen(false)}
    >
      <Column style={{ padding: '20px' }}>
        <Row crossAxisAlignment="start">
          {Object.entries(yearToPeople).map(([year, people]) =>
            people.length == 0 ? null : (
              <Column key={year} style={{ marginRight: '20px' }}>
                <Text
                  style={{
                    fontWeight: 'bold',
                    color: yearToColor(year, true),
                  }}
                >
                  {yearToString(year as Year)}
                </Text>
                <Column spacing="3px">
                  {people.map(person => (
                    // <Text
                    //   key={person.name}
                    //   style={{
                    //     cursor: 'pointer',
                    //   }}
                    //   onClick={() =>
                    //     personPicker.handleDialogResult(person.name)
                    //   }
                    // >
                    //   {person.name}
                    // </Text>
                    <Button
                      key={person.name}
                      variant={
                        personPicker.currentPerson === person.id
                          ? 'contained'
                          : 'outlined'
                      }
                      size="small"
                      onClick={() => personPicker.handleDialogResult(person.id)}
                    >
                      {person.name} ({person.id})
                    </Button>
                  ))}
                </Column>
              </Column>
            ),
          )}
        </Row>
        <Row
          style={{ marginTop: '10px' }}
          mainAxisAlignment="end"
          spacing="10px"
        >
          <Button
            variant="contained"
            onClick={() => personPicker.setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => personPicker.handleDialogResult('')}
          >
            Clear
          </Button>
        </Row>
      </Column>
    </Dialog>
  );
}
