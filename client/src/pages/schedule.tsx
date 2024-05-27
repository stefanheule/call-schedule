import {
  IsoDate,
  assertNonNull,
  dateToIsoDatetime,
  isoDateToDate,
  sleep,
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
  MaybeCallPoolPerson,
  CallPoolPerson,
  CALL_POOL,
} from '../shared/types';
import { useData, useLocalData, useProcessedData } from './data-context';
import * as datefns from 'date-fns';
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TooltipProps,
  styled,
  tooltipClasses,
} from '@mui/material';
import { WarningOutlined, ErrorOutlined } from '@mui/icons-material';
import {
  HolidayShift,
  WEEKDAY_CALL_TARGET,
  WEEKEND_CALL_TARGET,
  collectHolidayCall,
  countHolidayShifts,
  elementIdForDay,
  elementIdForShift,
  inferShift,
  nextDay,
  rate,
  ratingMinus,
  ratingToString,
  yearToColor,
} from '../shared/compute';
import { useHotkeys } from 'react-hotkeys-hook';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { rpcSaveCallSchedules } from './rpc';
import { LoadingIndicator } from '../common/loading';
import { VList, VListHandle } from 'virtua';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import { saveAs } from 'file-saver';
import { exportSchedule } from '../shared/export';

const DAY_SPACING = `2px`;

export function RenderCallSchedule() {
  const [showRotations, _setShowRotations] = useState(true);
  const [copyPasteSnackbar, setCopyPasteSnackbar] = useState('');
  const [localData, setLocalData] = useLocalData();
  const [data, setData] = useData();
  const processed = useProcessedData();
  const navigate = useNavigate();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const weekListRef = useRef<VListHandle>(null);

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
              <VList style={{ height: '100%' }} ref={weekListRef}>
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
                <Row spacing="8px">
                  {/* <Row>
                    <Checkbox
                      checked={showRotations}
                      onChange={() => setShowRotations(!showRotations)}
                    />
                    Show rotations
                  </Row> */}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      const buffer = await exportSchedule(data);
                      const blob = new Blob([buffer], {
                        // cspell:disable-next-line
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      });
                      saveAs(blob, 'Call-Schedule-AY2025.xlsx');
                    }}
                  >
                    Download
                  </Button>
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
              <ElementSpacer />
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
                    <RuleViolation
                      key={id}
                      id={id}
                      issue={issue}
                      weekListRef={weekListRef}
                    />
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

function holidayShiftsToString(holidayShifts: HolidayShift[]): string {
  const { calls, hours } = countHolidayShifts(holidayShifts);
  if (holidayShifts.length == 0) return `none`;
  return `${hours}h or ${calls} calls: ${holidayShifts
    .map(
      h =>
        `${h.shift == 'south_power' ? 'power_weekend_south' : h.shift} on ${
          h.day
        } (${h.holiday})`,
    )
    .join(', ')}`;
}

const SHOW_TARGETS = true;
function RenderCallCounts() {
  const processed = useProcessedData();
  const [data] = useData();
  const [holiday, setHoliday] = useState<'regular' | 'holiday'>('regular');
  return (
    <Column>
      <Row>
        <Heading>Call counts</Heading>
        <ElementSpacer />
        {/* <Checkbox checked={holiday} onChange={() => setHoliday(!holiday)} />
        <Text>Show holiday call counts?</Text> */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={holiday}
          color="primary"
          style={{
            height: '28px',
          }}
          onChange={(_, v) => setHoliday(assertNonNull(v) as 'regular')}
        >
          <ToggleButton size="small" value="regular">
            Regular calls
          </ToggleButton>
          <ToggleButton size="small" value="holiday">
            Holiday calls
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      {holiday == 'holiday' && (
        <Column spacing="5px">
          {CALL_POOL.map(person => (
            <Row key={person} spacing={'3px'}>
              <RenderPerson
                person={person}
                style={{
                  width: '23px',
                }}
              />
              <Text>
                {holidayShiftsToString(
                  collectHolidayCall(person, data, processed),
                )}
              </Text>
            </Row>
          ))}
        </Column>
      )}
      {holiday == 'regular' && (
        <Column>
          {CALL_POOL.map(person => {
            const counts = processed.callCounts[person];
            return (
              <Row key={person} spacing={'5px'}>
                <RenderPerson
                  person={person}
                  style={{
                    width: '23px',
                  }}
                />
                <Row spacing="2px">
                  <Text
                    style={{
                      fontWeight:
                        counts.weekday + counts.sunday >
                        WEEKDAY_CALL_TARGET[person]
                          ? 'bold'
                          : 'normal',
                    }}
                  >
                    {counts.weekday + counts.sunday} weekday
                  </Text>
                  {SHOW_TARGETS && (
                    <Text
                      style={{
                        fontWeight:
                          counts.weekday + counts.sunday <
                          WEEKDAY_CALL_TARGET[person]
                            ? 'bold'
                            : 'normal',
                      }}
                    >
                      (target: {WEEKDAY_CALL_TARGET[person]})
                    </Text>
                  )}
                  <Text>out of which {counts.sunday} are sundays</Text>
                  <Text>/</Text>
                  <Text
                    style={{
                      fontWeight:
                        counts.weekend > WEEKEND_CALL_TARGET[person]
                          ? 'bold'
                          : 'normal',
                    }}
                  >
                    {counts.weekend} weekend
                  </Text>
                  {SHOW_TARGETS && (
                    <Text
                      style={{
                        fontWeight:
                          counts.weekend < WEEKEND_CALL_TARGET[person]
                            ? 'bold'
                            : 'normal',
                      }}
                    >
                      (target: {WEEKEND_CALL_TARGET[person]})
                    </Text>
                  )}
                  <Text>/</Text>
                  <Text>{counts.nf} NF</Text>
                </Row>
              </Row>
            );
          })}
        </Column>
      )}
    </Column>
  );
}

function RuleViolation({
  issue,
  weekListRef,
}: {
  id: string;
  issue: Issue;
  weekListRef: React.RefObject<VListHandle>;
}) {
  const processed = useProcessedData();
  const weekIndex = processed.day2weekAndDay[issue.startDay].weekIndex;
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
      onClick={async () => {
        const firstElement = document.getElementById(`day-${issue.startDay}`);
        if (firstElement) {
          firstElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          weekListRef.current?.scrollToIndex(weekIndex);
          await sleep(100);
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
        <Text>Vacations</Text> <Text> (prio. wknd)</Text>
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

  const vacation = processed.day2person2info[day.date]
    ? Object.entries(processed.day2person2info[day.date]).filter(
        ([_, info]) => info.onVacation,
      )
    : [];
  const priorityWeekend = processed.day2person2info[day.date]
    ? Object.entries(processed.day2person2info[day.date]).filter(
        ([_, info]) => info.onPriorityWeekend,
      )
    : [];
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
          {vacation.map(([person]) => (
            <RenderPerson key={person} person={person as Person} />
          ))}
          {priorityWeekend.length + vacation.length > 0 && (
            <ElementSpacer space="2px" />
          )}
          {priorityWeekend.length > 0 && <Text>(</Text>}
          {priorityWeekend.map(([person]) => (
            <RenderPerson key={person} person={person as Person} />
          ))}
          {priorityWeekend.length > 0 && <Text>)</Text>}
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
  const name = assertNonNull(data.shiftConfigs[id.shiftName]).name;
  const processed = useProcessedData();
  const elId = elementIdForShift(day.date, id.shiftName);
  const hasIssue = processed.element2issueKind[elId];
  // useEffect(() => {
  //   if (day.date == '2024-07-04') {
  //     personPicker.requestDialog(() => {}, {
  //       currentPersonId: '',
  //       day: day.date,
  //       shift: id.shiftName,
  //     });
  //   }
  // }, []);
  return (
    <Row
      id={elId}
      style={{
        boxSizing: 'border-box',
        border: `1px solid #aaa`,
        borderStyle: processed.day2shift2isHoliday?.[day.date]?.[id.shiftName]
          ? 'dashed'
          : 'solid',
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
        personPicker.requestDialog(
          person => {
            if (data.isPublic) {
              setWarningSnackbar(
                `You won't be able to save your changes, this is a read-only version of the call schedule application`,
              );
            }
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
          },
          {
            currentPersonId: personId,
            day: day.date,
            shift: id.shiftName,
          },
        );
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

function omitFields<T extends object, K extends keyof T>(
  obj: T,
  fields: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const field of fields) {
    delete result[field];
  }
  return result;
}

const RenderPerson = React.forwardRef(function RenderPerson(
  props: {
    person: MaybePerson;
    large?: boolean;
    selected?: boolean;
    style?: React.CSSProperties;
    onClick?: () => void;
  },
  ref: React.Ref<HTMLDivElement>,
) {
  const { person, style, large, selected, onClick } = props;
  const [data] = useData();
  const [localData] = useLocalData();
  if (!person) {
    return null;
  }
  return (
    <ColorPill
      {...omitFields(props, [
        'large',
        'onClick',
        'person',
        'selected',
        'style',
      ])}
      color={personToColor(data, person)}
      style={style}
      onClick={onClick}
      highlighted={
        selected === undefined ? localData.highlightedPeople[person] : selected
      }
      ref={ref}
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
});

export const ColorPill = forwardRef(function ColorPillImp(
  props: {
    color: string;
    size?: string;
    style?: React.CSSProperties;
    more?: Record<string, unknown>;
    onClick?: () => void;
    highlighted?: boolean;
  } & Children,
  ref: React.Ref<HTMLDivElement>,
): JSX.Element {
  const { color, children, more, style, onClick, highlighted } = props;
  return (
    <div
      {...omitFields(props, [
        'children',
        'color',
        'highlighted',
        'more',
        'onClick',
        'size',
        'style',
      ])}
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

type PersonPickerConfig = {
  currentPersonId: MaybeCallPoolPerson;
  shift: ShiftKind;
  day: IsoDate;
};

type PersonPickerType = {
  requestDialog: (
    callback: (person: MaybeCallPoolPerson) => void,
    config: PersonPickerConfig,
  ) => void;
  handleDialogResult: (person: MaybeCallPoolPerson) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  config: PersonPickerConfig;
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
  const [config, setConfig] = useState<PersonPickerConfig>({
    currentPersonId: '',
    shift: 'day_nwhsch',
    day: '2024-05-23' as IsoDate,
  });

  const requestDialog = (
    callback: (person: MaybeCallPoolPerson) => void,
    config: PersonPickerConfig,
  ) => {
    setIsOpen(true);
    setOnResult(() => callback);
    setConfig(config);
  };

  const handleDialogResult = (person: MaybeCallPoolPerson) => {
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
        config,
      }}
    >
      {children}
    </PersonPickerContext.Provider>
  );
};

function getYearToPeople(
  data: CallSchedule,
): Record<YearOnSchedule, (PersonConfig & { id: CallPoolPerson })[]> {
  const yearToPeople: Record<
    YearOnSchedule,
    (PersonConfig & { id: CallPoolPerson })[]
  > = {
    '2': [],
    '3': [],
    S: [],
    R: [],
    M: [],
  };
  for (const [id, person] of Object.entries(data.people)) {
    if (person.year == '1' || person.year == 'C') continue;
    yearToPeople[person.year].push({ ...person, id: id as CallPoolPerson });
  }
  return yearToPeople;
}

const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.common.white,
    color: 'rgba(0, 0, 0, 0.87)',
    boxShadow: theme.shadows[1],
    border: '1px solid #ccc',
    fontSize: 15,
  },
}));

function PersonPickerDialog() {
  const personPicker = usePersonPicker();
  const [data] = useData();
  const processed = useProcessedData();
  const config = personPicker.config;
  const shiftConfig = assertNonNull(data.shiftConfigs[config.shift]);
  const inference = inferShift(data, processed, config.day, config.shift);
  const initialRating = rate(data, processed);

  const yearToPeople = getYearToPeople(data);
  const buttonWidth = 200;
  return (
    <Dialog
      open={personPicker.isOpen}
      style={{
        minWidth: '650px',
        minHeight: '400px',
      }}
      maxWidth="xl"
      transitionDuration={{
        enter: 0,
        exit: 0,
      }}
      onClose={() => personPicker.setIsOpen(false)}
    >
      <Column style={{ padding: '20px' }} spacing="10px">
        <Heading>
          {shiftConfig.name} on {config.day}
        </Heading>
        <Row crossAxisAlignment="start">
          {Object.entries(yearToPeople).map(([year, people]) =>
            people.length == 0 ? null : (
              <Column
                key={year}
                style={{ marginRight: '20px', width: '110px' }}
                crossAxisAlignment="end"
              >
                <Text
                  style={{
                    fontWeight: 'bold',
                    color: yearToColor(year, true),
                  }}
                >
                  {yearToString(year as Year)}
                </Text>
                <Column spacing="3px" crossAxisAlignment="end">
                  {people.map(person => {
                    const unavailable = inference.unavailablePeople[person.id];

                    const renderedPerson = (
                      <RenderPerson
                        person={person.id}
                        large
                        style={{
                          cursor: 'pointer',
                          opacity: !unavailable
                            ? undefined
                            : unavailable.soft
                              ? 0.5
                              : 0.3,
                        }}
                        selected={
                          personPicker.config.currentPersonId === person.id
                        }
                        onClick={() =>
                          personPicker.handleDialogResult(person.id)
                        }
                      />
                    );
                    const rating = inference.best?.ratings?.[person.id]?.rating;
                    return (
                      <Row key={person.name} spacing={'2px'}>
                        {rating && (
                          <Text
                            style={{
                              color: '#ccc',
                              fontSize: '12px',
                            }}
                          >
                            {ratingToString(ratingMinus(rating, initialRating))}
                          </Text>
                        )}
                        <DoNotDisturbIcon
                          sx={{
                            color: !unavailable
                              ? 'white'
                              : unavailable.soft
                                ? WARNING_COLOR
                                : ERROR_COLOR,
                            fontSize: 15,
                          }}
                        />
                        <Row
                          style={{
                            width: 50,
                          }}
                          mainAxisAlignment="end"
                        >
                          {unavailable && (
                            <LightTooltip
                              title={unavailable.reason}
                              style={{
                                fontSize: '20px',
                              }}
                              enterDelay={500}
                            >
                              {renderedPerson}
                            </LightTooltip>
                          )}
                          {!unavailable && renderedPerson}
                        </Row>
                      </Row>
                    );
                  })}
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
            style={{
              width: buttonWidth,
            }}
            onClick={() => personPicker.handleDialogResult('')}
          >
            Clear assigned person
          </Button>
          <Button
            variant="contained"
            size="small"
            style={{
              width: buttonWidth,
            }}
            disabled={!inference.best}
            onClick={() => {
              personPicker.handleDialogResult(inference.best?.person ?? '');
            }}
          >
            {inference.best && `Auto-assign (${inference.best.person})`}
            {!inference.best && `Nobody available`}
          </Button>
        </Row>
      </Column>
    </Dialog>
  );
}
