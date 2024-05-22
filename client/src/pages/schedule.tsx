import {
  assertNonNull,
  dateToIsoDatetime,
  isoDateToDate,
  mapEnumWithDefault,
} from 'check-type';
import { Children, Column, ElementSpacer, Row } from '../common/flex';
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
  Issue,
  RotationDetails,
  Hospital2People,
  SHIFT_ORDER,
} from '../shared/types';
import { useData, useLocalData, useProcessedData } from './data-context';
import * as datefns from 'date-fns';
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Button, Dialog, TextField } from '@mui/material';
import { WarningOutlined, ErrorOutlined } from '@mui/icons-material';
import { elementIdForDay, elementIdForShift, nextDay } from '../shared/compute';
import { Checkbox } from '@mui/material';
import { useHotkeys } from 'react-hotkeys-hook';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { rpcSaveCallSchedules } from './rpc';
import { LoadingIndicator } from '../common/loading';
import { VList } from 'virtua';

const DAY_SPACING = `2px`;

export function RenderCallSchedule() {
  const [showRotations, setShowRotations] = useState(true);
  const [copyPasteSnackbar, setCopyPasteSnackbar] = useState('');
  const [localData, setLocalData] = useLocalData();
  const [data, setData] = useData();
  const processed = useProcessedData();
  const navigate = useNavigate();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.onbeforeunload = confirmExit;
    function confirmExit() {
      if (localData.unsavedChanges == 0) return null;
      return `There are unsaved changes, are you sure you want to exit?`;
    }
  }, [localData]);

  useHotkeys(
    ['ctrl+z', 'command+z'],
    () => {
      setLocalData((localData: LocalData) => {
        const lastAction = localData.history.pop();
        setData((data: CallSchedule) => {
          if (lastAction) {
            localData.undoHistory.push(lastAction);
            const day =
              data.weeks[lastAction.shift.weekIndex].days[
                lastAction.shift.dayIndex
              ];
            day.shifts[lastAction.shift.shiftName] = lastAction.previous;
            if (localData.unsavedChanges === 0) {
              localData.firstUnsavedChange = dateToIsoDatetime(new Date());
            }
            setCopyPasteSnackbar(`Undo shift assignment for ${day.date}.`);
          } else {
            setCopyPasteSnackbar(`Cannot undo, no action in history.`);
            return data;
          }
          return { ...data };
        });
        if (!lastAction) return localData;
        return { ...localData };
      });
    },
    [],
  );

  useHotkeys(
    ['ctrl+y', 'command+y', 'ctrl+shift+z', 'command+shift+z'],
    () => {
      setLocalData((localData: LocalData) => {
        const lastAction = localData.undoHistory.pop();
        setData((data: CallSchedule) => {
          if (lastAction) {
            localData.history.push(lastAction);
            const day =
              data.weeks[lastAction.shift.weekIndex].days[
                lastAction.shift.dayIndex
              ];
            day.shifts[lastAction.shift.shiftName] = lastAction.next;
            if (localData.unsavedChanges === 0) {
              localData.firstUnsavedChange = dateToIsoDatetime(new Date());
            }
            localData.unsavedChanges += 1;
            setCopyPasteSnackbar(`Redo shift assignment for ${day.date}.`);
          } else {
            setCopyPasteSnackbar(`Cannot redo, no action in history.`);
            return data;
          }
          return { ...data };
        });
        if (!lastAction) return localData;
        return { ...localData };
      });
    },
    [],
  );

  // ...

  return (
    <PersonPickerProvider>
      <Snackbar
        open={copyPasteSnackbar != ''}
        onClose={() => setCopyPasteSnackbar('')}
        message={copyPasteSnackbar}
        autoHideDuration={5000}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            sx={{ p: 0.5 }}
            onClick={() => setCopyPasteSnackbar('')}
          >
            <CloseIcon />
          </IconButton>
        }
      />
      <Column
        style={{
          height: '100%',
        }}
      >
        <DefaultTextSize defaultSize={'12px'}>
          <Row
            crossAxisAlignment="start"
            mainAxisAlignment="start"
            style={{
              height: '100%',
            }}
          >
            <Column
              style={{
                height: '100%',
                minWidth: '880px',
              }}
            >
              {/* {Array.from({ length: 53 }).map((_, i) => (
                <Column key={i}>
                  <RenderWeek
                    id={{ weekIndex: i }}
                    showRotations={showRotations}
                  />
                  <ElementSpacer />
                </Column>
              ))} */}
              <VList style={{ height: '100%' }}>
                {Array.from({ length: 53 }).map((_, i) => (
                  <Column key={i}>
                    <RenderWeek
                      setWarningSnackbar={setCopyPasteSnackbar}
                      id={{ weekIndex: i }}
                      showRotations={showRotations}
                    />
                    <ElementSpacer />
                  </Column>
                ))}
              </VList>
              {/* <AutoSizer>
                {({ height, width }) => (
                  <FixedSizeList
                    height={height}
                    itemCount={53}
                    itemSize={35}
                    width={width}
                  >
                    {({ index }) => (
                      <RenderWeek key={index} id={{ weekIndex: index }} />
                    )}
                  </FixedSizeList>
                )}
              </AutoSizer> */}
            </Column>
            <Column
              style={{
                height: '100%',
                marginLeft: `10px`,
              }}
            >
              <Column>
                <Heading>Options</Heading>
                <Row spacing="8px">
                  <Row>
                    <Checkbox
                      checked={showRotations}
                      onChange={() => setShowRotations(!showRotations)}
                    />
                    Show rotations
                  </Row>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/history')}
                  >
                    History
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={
                      localData.unsavedChanges == 0 || data.isPublic === true
                    }
                    onClick={() => {
                      setSaveName('');
                      setSaveDialogOpen(true);
                    }}
                    style={{
                      width: '150px',
                    }}
                  >
                    {data.isPublic !== true &&
                      localData.unsavedChanges > 0 &&
                      `Save ${localData.unsavedChanges} change${
                        localData.unsavedChanges > 2 ? 's' : ''
                      }`}
                    {data.isPublic !== true &&
                      localData.unsavedChanges == 0 &&
                      `Saved`}
                    {data.isPublic === true && `View only version`}
                  </Button>
                  <Dialog
                    open={saveDialogOpen}
                    maxWidth="xl"
                    onClose={() => setSaveDialogOpen(false)}
                  >
                    <Column
                      style={{ padding: '20px', minWidth: '450px' }}
                      spacing="10px"
                    >
                      <Row>
                        <Heading>Save current changes</Heading>
                      </Row>
                      <Text
                        style={{
                          fontSize: '16px',
                        }}
                      >
                        Optionally name the current version.
                      </Text>
                      <Row>
                        <TextField
                          size="small"
                          value={saveName}
                          onChange={ev => setSaveName(ev.target.value)}
                        />
                      </Row>
                      <Row
                        style={{ marginTop: '10px' }}
                        mainAxisAlignment="end"
                        spacing="10px"
                      >
                        <Button
                          variant="outlined"
                          onClick={() => setSaveDialogOpen(false)}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          disabled={isSaving}
                          onClick={async () => {
                            try {
                              setIsSaving(true);
                              const result = await rpcSaveCallSchedules({
                                name: saveName,
                                callSchedule: data,
                              });
                              setLocalData({
                                ...localData,
                                unsavedChanges: 0,
                              });
                              console.log({ result });
                              setCopyPasteSnackbar(`Saved successfully`);
                              setSaveDialogOpen(false);
                            } catch (e) {
                              console.log(e);
                              setCopyPasteSnackbar(
                                `Failed to save, please try again`,
                              );
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                        >
                          {isSaving ? (
                            <LoadingIndicator color="secondary" />
                          ) : (
                            `Save now`
                          )}
                        </Button>
                      </Row>
                    </Column>
                  </Dialog>
                </Row>
              </Column>
              <Highlight />
              <RenderCallCounts />
              <Column
                style={{
                  paddingRight: `10px`,
                  overflowY: 'scroll',
                  height: '100%',
                }}
              >
                <Heading>
                  Rule violations (hard: {processed.issueCounts.hard}, soft:{' '}
                  {processed.issueCounts.soft})
                </Heading>
                {Object.entries(processed.issues)
                  .sort((a, b) => a[1].startDay.localeCompare(b[1].startDay))
                  .map(([id, issue]) => (
                    <RuleViolation key={id} id={id} issue={issue} />
                  ))}
              </Column>
            </Column>
          </Row>
        </DefaultTextSize>
      </Column>
      <PersonPickerDialog />
    </PersonPickerProvider>
  );
}

function RenderCallCounts() {
  const processed = useProcessedData();
  const [data] = useData();
  return (
    <Column>
      <Heading>Call counts</Heading>
      <Column>
        {Object.entries(processed.callCounts)
          .filter(([person]) => data.people[person as Person].year != 'C')
          .map(([person, counts]) => (
            <Row key={person} spacing={'5px'}>
              <RenderPerson
                person={person as Person}
                style={{
                  width: '23px',
                }}
              />
              <Text>
                {counts.weekday} weekday / {counts.weekend} weekend /{' '}
                {counts.holiday} holiday / {counts.nf} NF
              </Text>
            </Row>
          ))}
      </Column>
    </Column>
  );
}

function RuleViolation({ issue }: { id: string; issue: Issue }) {
  return (
    <Row
      spacing="5px"
      style={{
        border: '1px solid #ccc',
        padding: '1px 4px',
        marginBottom: '2px',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
      onClick={() => {
        const firstElement = document.getElementById(`day-${issue.startDay}`);
        if (firstElement) {
          firstElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        for (const element of issue.elements) {
          const el = document.getElementById(element);
          if (el) el.classList.add('blink-twice');
        }
        setTimeout(() => {
          for (const element of issue.elements) {
            const el = document.getElementById(element);
            if (el) el.classList.remove('blink-twice');
          }
        }, 3000);
      }}
    >
      {!issue.isHard ? (
        <WarningOutlined style={{ color: WARNING_COLOR, height: 18 }} />
      ) : (
        <ErrorOutlined style={{ color: ERROR_COLOR, height: 18 }} />
      )}
      <Text>{issue.message}</Text>
    </Row>
  );
}

const WARNING_COLOR = '#FFCC00';
const ERROR_COLOR = 'hsl(0, 70%, 50%)';

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

function RenderWeek({
  id,
  showRotations,
  setWarningSnackbar,
}: {
  id: WeekId;
  showRotations: boolean;
  setWarningSnackbar: (v: string) => void;
}) {
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
      <RenderLegend showRotations={showRotations} />
      {week.days.map((day, dayIndex) => (
        <RenderDay
          id={{ ...id, dayIndex }}
          key={day.date}
          setWarningSnackbar={setWarningSnackbar}
          showRotations={showRotations}
        />
      ))}
    </Row>
  );
}

const DAY_WIDTH = 110;
const DAY_PADDING = 5;
const DAY_VACATION_HEIGHT = '37px';
const DAY_HOSPITALS_HEIGHT = '90px';
const DAY_BORDER = `1px solid black`;
const DAY_BOX_STYLE: React.CSSProperties = {
  padding: `2px ${DAY_PADDING}px`,
};
const secondaryInfoOpacity = 0.65;

function RenderLegend({ showRotations }: { showRotations: boolean }) {
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
      {showRotations && (
        <>
          <Column style={{ borderBottom: DAY_BORDER }}></Column>
          <Column
            style={{
              ...DAY_BOX_STYLE,
              minHeight: DAY_HOSPITALS_HEIGHT,
            }}
          >
            <Text>Rotations</Text>
          </Column>
        </>
      )}
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, minHeight: DAY_VACATION_HEIGHT }}>
        <Text>Vacations</Text>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE }}>
        <Text>Call</Text>
      </Column>
    </Column>
  );
}

function RenderDay({
  id,
  showRotations,
  setWarningSnackbar,
}: {
  id: DayId;
  showRotations: boolean;
  setWarningSnackbar: (v: string) => void;
}) {
  const [data] = useData();
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const date = isoDateToDate(day.date);
  const processed = useProcessedData();
  const isHoliday = data.holidays[day.date] !== undefined;
  const isSpecial = data.specialDays[day.date] !== undefined;
  const showRotationsToday =
    (id.dayIndex == 0 && id.weekIndex !== 0) ||
    (id.dayIndex == 1 && id.weekIndex == 0);
  const backgroundColor = isHoliday ? '#fee' : isSpecial ? '#eef' : undefined;
  return (
    <Column
      id={elementIdForDay(day.date)}
      style={{
        border: DAY_BORDER,
        boxSizing: 'border-box',
        borderRadius: `5px`,
        width: `${DAY_WIDTH}px`,
        minHeight: `100px`,
        opacity: day.date < data.firstDay || day.date > data.lastDay ? 0.5 : 1,
        backgroundColor,
      }}
    >
      <Column
        style={{
          color: isHoliday ? 'red' : isSpecial ? 'blue' : 'black',
          ...DAY_BOX_STYLE,
        }}
      >
        <Text
          style={{
            fontWeight: isHoliday || isSpecial ? 'bold' : 'normal',
          }}
        >
          {datefns.format(date, 'EEE, M/d')}
        </Text>
        <Text
          color={isHoliday || isSpecial ? undefined : 'white'}
          style={{
            fontWeight: isHoliday || isSpecial ? 'bold' : 'normal',
            textOverflow: 'ellipsis',
            textWrap: 'nowrap',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {data.holidays[day.date] ?? data.specialDays[day.date] ?? '.'}
        </Text>
      </Column>
      {showRotations && (
        <>
          <Column style={{ borderBottom: DAY_BORDER }}></Column>
          {showRotationsToday && (
            <Column
              style={{
                ...DAY_BOX_STYLE,
                minHeight: DAY_HOSPITALS_HEIGHT,
                position: 'relative',
                width: id.dayIndex == 0 ? '750px' : '600px',
                background: 'white',
                zIndex: 100,
              }}
            >
              <RenderHospitals
                info={processed.day2hospital2people[nextDay(day.date)]}
              />
            </Column>
          )}
          {!showRotationsToday && (
            <Column
              style={{
                ...DAY_BOX_STYLE,
                minHeight: DAY_HOSPITALS_HEIGHT,
                background: 'white',
              }}
            ></Column>
          )}
        </>
      )}
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, minHeight: DAY_VACATION_HEIGHT }}>
        <Row style={{ opacity: secondaryInfoOpacity, flexWrap: 'wrap' }}>
          {processed.day2person2info[day.date] &&
            Object.entries(processed.day2person2info[day.date])
              .filter(([_, info]) => info.onVacation)
              .map(([person]) => (
                <RenderPerson key={person} person={person as Person} />
              ))}
        </Row>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, padding: '3px' }}>
        {Object.entries(day.shifts)
          .sort(
            (a, b) =>
              SHIFT_ORDER.indexOf(a[0] as ShiftKind) -
              SHIFT_ORDER.indexOf(b[0] as ShiftKind),
          )
          .map(([shiftName]) => (
            <RenderShift
              id={{ ...id, shiftName: shiftName as ShiftKind }}
              setWarningSnackbar={setWarningSnackbar}
              key={`${day.date}-${shiftName}`}
            />
          ))}
      </Column>
    </Column>
  );
}

function RenderHospitals({ info }: { info?: Hospital2People }) {
  if (!info) return null;
  return (
    <Row
      style={{
        opacity: secondaryInfoOpacity,
      }}
    >
      <Column
        style={{
          width: '300px',
        }}
      >
        <RenderHospital hospital="UW" people={info.UW ?? []} />
        <RenderHospital hospital="HMC" people={info.HMC ?? []} />
        <RenderHospital hospital="VA" people={info.VA ?? []} />
        <RenderHospital hospital="SCH" people={info.SCH ?? []} />
        <RenderHospital hospital="NWH" people={info.NWH ?? []} />
      </Column>
      <Column>
        <RenderHospital hospital="Andro" people={info.Andro ?? []} />
        <RenderHospital hospital="Research" people={info.Research ?? []} />
        <RenderHospital hospital="NF" people={info.NF ?? []} />
        <RenderHospital hospital="Alaska" people={info.Alaska ?? []} />
      </Column>
    </Row>
  );
}

function RenderHospital({
  hospital,
  people,
}: {
  hospital: string;
  people: Array<RotationDetails & { person: Person }>;
}) {
  const [data] = useData();
  return (
    <Row style={{}} spacing="6px">
      <Text>{hospital}:</Text>
      {people.map(person => (
        <Row key={person.person}>
          <RenderPerson key={person.person} person={person.person} />
          {person.chief && data.people[person.person].year != 'C' && (
            <Text>(C)</Text>
          )}
        </Row>
      ))}
    </Row>
  );
}

function RenderShift({
  id,
  setWarningSnackbar,
}: {
  id: ShiftId;
  setWarningSnackbar: (v: string) => void;
}) {
  const [data, setData] = useData();
  const [, setLocalData] = useLocalData();
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const personId = day.shifts[id.shiftName] ?? '';
  const personPicker = usePersonPicker();
  const name = data.shiftConfigs[id.shiftName].name;
  const processed = useProcessedData();
  const elId = elementIdForShift(day.date, id.shiftName);
  const hasIssue = processed.element2issueKind[elId];
  return (
    <Row
      id={elId}
      style={{
        boxSizing: 'border-box',
        border: `1px solid #ccc`,
        marginBottom: `1px`,
        cursor: 'pointer',
        padding: '1px 3px',
        backgroundColor:
          hasIssue === undefined
            ? 'white'
            : hasIssue === 'hard'
              ? '#faa'
              : 'rgb(255, 252, 170)',
        borderRadius: '3px',
      }}
      onClick={() => {
        personPicker.requestDialog(person => {
          setWarningSnackbar(
            `You won't be able to save your changes, this is a read-only version of the call schedule application`,
          );
          const previous =
            data.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName];
          setData((d: CallSchedule) => {
            d.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName] =
              person;
            return { ...d };
          });
          setLocalData((d: LocalData) => {
            d.history.push({
              previous,
              next: person,
              shift: id,
            });
            d.undoHistory = [];
            if (d.unsavedChanges === 0) {
              d.firstUnsavedChange = dateToIsoDatetime(new Date());
            }
            d.unsavedChanges += 1;
            return { ...d };
          });
        }, personId);
      }}
    >
      <Text>{name}</Text>
      <ElementSpacer />
      <RenderPerson person={personId} />
    </Row>
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
  large,
  selected,
  onClick,
}: {
  person: MaybePerson;
  large?: boolean;
  selected?: boolean;
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
      highlighted={
        selected === undefined ? localData.highlightedPeople[person] : selected
      }
    >
      <Text
        style={{
          textAlign: 'center',
          padding: `0 -1px`,
          height: large ? '20px' : '13px',
          position: 'relative',
          top: '-2px',
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
                    <Row key={person.name}>
                      <RenderPerson
                        person={person.id}
                        large
                        style={{
                          cursor: 'pointer',
                        }}
                        selected={personPicker.currentPerson === person.id}
                        onClick={() =>
                          personPicker.handleDialogResult(person.id)
                        }
                      />
                    </Row>
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
            variant="outlined"
            size="small"
            onClick={() => personPicker.setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => personPicker.handleDialogResult('')}
          >
            Clear assigned person
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              personPicker.handleDialogResult('')
            }}
          >
            Auto-assign
          </Button>
        </Row>
      </Column>
    </Dialog>
  );
}
