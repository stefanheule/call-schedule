import {
  assertNonNull,
  dateToIsoDatetime,
  isoDateToDate,
  mapEnum,
  sleep,
} from 'check-type';
import { Children, Column, ElementSpacer, Row, Spaced } from '../common/flex';
import { DefaultTextSize, Heading, Text } from '../common/text';
import {
  CallSchedule,
  DayId,
  PersonConfig,
  ShiftId,
  WeekId,
  Year,
  yearToString,
  LocalData,
  ShiftKind,
  MaybePerson,
  Person,
  Issue,
  RotationDetails,
  Hospital2People,
  ChiefShiftKind,
  ChiefShiftId,
  Chief,
  CallScheduleProcessed,
  YEAR_ORDER,
  allChiefs,
  callPoolPeople,
  HOSPITAL_ORDER,
} from '../shared/types';
import {
  useData,
  useInitialData,
  useLocalData,
  useProcessedData,
} from './data-context';
import * as datefns from 'date-fns';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
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
  useMediaQuery,
} from '@mui/material';
import { WarningOutlined, ErrorOutlined } from '@mui/icons-material';
import TuneIcon from '@mui/icons-material/Tune';
import {
  HolidayShift,
  applyActions,
  collectHolidayCall,
  compareData,
  countHolidayShifts,
  elementIdForDay,
  elementIdForShift,
  nextDay,
  deserializeActions,
  serializeDate,
  serializePerson,
  serializeShift,
  undoActions,
  yearToColor,
  serializeActions,
} from '../shared/compute';
import { useHotkeys } from 'react-hotkeys-hook';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { rpcSaveCallSchedules } from './rpc';
import { LoadingIndicator } from '../common/loading';
import { VList, VListHandle } from 'virtua';

import { saveAs } from 'file-saver';
import { exportSchedule } from '../shared/export';
import {
  assertMaybeCallPoolPerson,
  assertMaybeChief,
} from '../shared/check-type.generated';
import { dateToIsoDate } from '../shared/optimized';
import {
  PersonPickerDialog,
  PersonPickerProvider,
  usePersonPicker,
} from './person-picker';
import {
  ConfigEditorConfig,
  ConfigEditorDialog,
  ConfigEditorProvider,
  configEditorTitle,
  RegularConfigEditorKind,
  useConfigEditor,
} from './config-editor';

function canEditRawData(_data: CallSchedule, localData: LocalData): boolean {
  return localData.unsavedChanges == 0;
}
function showEditRawData(data: CallSchedule, _localData: LocalData): boolean {
  if (data.isPublic) return false;
  if (data.currentUser === undefined) return false;

  return [
    'local',
    'stefanheule@gmail.com',
    'lisazhang0829@hotmail.com',
  ].includes(data.currentUser);
}

export function RenderCallSchedule() {
  return (
    <PersonPickerProvider>
      <ConfigEditorProvider>
        <RenderCallScheduleImpl />
      </ConfigEditorProvider>
    </PersonPickerProvider>
  );
}

function RenderCallScheduleImpl() {
  const [showRotations, _setShowRotations] = useState(true);
  const [copyPasteSnackbar, setCopyPasteSnackbar] = useState('');
  const [localData, setLocalData] = useLocalData();
  const [data, setData] = useData();
  const processed = useProcessedData();
  const navigate = useNavigate();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDoneDialogOpen, setImportDoneDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const weekListRef = useRef<VListHandle>(null);
  const initialData = useInitialData();

  useMediaQuery(`(min-width:${SIDEBAR_WIDTH + WEEK_WIDTH}px)`);

  useEffect(() => {
    let weekIdx = 0;
    const today = dateToIsoDate(new Date());
    for (const week of data.weeks) {
      for (const day of week.days) {
        if (day.date === today) {
          weekListRef.current?.scrollToIndex(weekIdx);
          return;
        }
      }
      weekIdx += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            undoActions(data, [lastAction]);
            if (localData.unsavedChanges === 0) {
              localData.firstUnsavedChange = dateToIsoDatetime(new Date());
            }
            setCopyPasteSnackbar(
              `Undo shift assignment for ${
                data.weeks[lastAction.shift.weekIndex].days[
                  lastAction.shift.dayIndex
                ].date
              }.`,
            );
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
            applyActions(data, [lastAction]);
            if (localData.unsavedChanges === 0) {
              localData.firstUnsavedChange = dateToIsoDatetime(new Date());
            }
            localData.unsavedChanges += 1;
            setCopyPasteSnackbar(
              `Redo shift assignment for ${
                data.weeks[lastAction.shift.weekIndex].days[
                  lastAction.shift.dayIndex
                ].date
              }.`,
            );
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

  const configEditor = useConfigEditor();
  const showEditRaw = showEditRawData(data, localData);

  function EditorToggleRow({ children }: { children: React.ReactNode }) {
    return (
      <ToggleButtonGroup
        size="small"
        exclusive
        value={undefined}
        color="primary"
        style={{
          height: '24px',
        }}
        onChange={(_, v) => {
          if (v === undefined) return;
          configEditor.requestDialog(() => {}, {
            kind: assertNonNull(v) as RegularConfigEditorKind,
          });
        }}
      >
        {children}
      </ToggleButtonGroup>
    );
  }

  function EditorToggleButton({ kind }: { kind: RegularConfigEditorKind }) {
    return (
      <ToggleButton
        size="small"
        value={kind}
        style={{
          fontSize: '12px',
          lineHeight: '12px',
        }}
      >
        {configEditorTitle(kind)}
      </ToggleButton>
    );
  }

  // ...

  return (
    <>
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
              <VList ref={weekListRef}>
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
                  {!data.isPublic && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/history')}
                    >
                      History
                    </Button>
                  )}
                  <Button
                    variant={
                      data.isPublic === true && localData.unsavedChanges > 0
                        ? 'contained'
                        : 'outlined'
                    }
                    size="small"
                    disabled={
                      localData.unsavedChanges == 0 && data.isPublic !== true
                    }
                    onClick={() => {
                      if (data.isPublic) {
                        setSuggestDialogOpen(true);
                      } else {
                        setSaveName('');
                        setSaveDialogOpen(true);
                      }
                    }}
                    style={{
                      width: '170px',
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
                    {data.isPublic === true && `Suggest call trade`}
                  </Button>
                  {!data.isPublic && (
                    <Button
                      style={{
                        width: '160px',
                      }}
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setImportDialogOpen(true);
                        setImportDoneDialogOpen(false);
                        // setImportText('');
                      }}
                    >
                      Import call swap
                    </Button>
                  )}
                  <Dialog
                    open={importDialogOpen}
                    maxWidth="xl"
                    onClose={() => setImportDialogOpen(false)}
                  >
                    <RenderImportCallSwitchDialog
                      setImportDialogOpen={setImportDialogOpen}
                      setImportDoneDialogOpen={setImportDoneDialogOpen}
                      importText={importText}
                      setImportText={setImportText}
                    />
                  </Dialog>
                  <Dialog
                    open={suggestDialogOpen}
                    maxWidth="xl"
                    onClose={() => setSuggestDialogOpen(false)}
                  >
                    <RenderSuggestCallSwitchDialog
                      setCopyPasteSnackbar={setCopyPasteSnackbar}
                      setSuggestDialogOpen={setSuggestDialogOpen}
                    />
                  </Dialog>
                  <Dialog
                    open={importDoneDialogOpen}
                    maxWidth="xl"
                    onClose={() => {
                      setImportDoneDialogOpen(false);
                      setImportDialogOpen(false);
                    }}
                  >
                    <Column
                      style={{ padding: '20px', minWidth: '450px' }}
                      spacing="10px"
                    >
                      <Row>
                        <Heading>Import done</Heading>
                      </Row>
                      <Text
                        style={{
                          fontSize: '16px',
                        }}
                      >
                        The call swaps have been applied, but are NOT SAVED YET.
                      </Text>
                      <Row
                        style={{ marginTop: '10px' }}
                        mainAxisAlignment="end"
                        spacing="10px"
                      >
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setImportDoneDialogOpen(false);
                            setImportDialogOpen(false);
                          }}
                          disabled={isSaving}
                        >
                          Done
                        </Button>
                      </Row>
                    </Column>
                  </Dialog>
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
                                initialCallSchedule: initialData,
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
              {showEditRaw && (
                <>
                  <Column spacing={4}>
                    <Heading>Edit configuration</Heading>
                    <EditorToggleRow>
                      <EditorToggleButton kind="people" />
                      <EditorToggleButton kind="holidays" />
                      <EditorToggleButton kind="vacations" />
                      <EditorToggleButton kind="rotations" />
                    </EditorToggleRow>
                    <EditorToggleRow>
                      <EditorToggleButton kind="special-days" />
                      <EditorToggleButton kind="shift-configs" />
                      <EditorToggleButton kind="chief-shift-configs" />
                      <EditorToggleButton kind="call-targets" />
                    </EditorToggleRow>
                  </Column>
                  <ElementSpacer />
                </>
              )}
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
                  // .filter(([_, issue]) => issue.kind !== 'cross-coverage')
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
      <ConfigEditorDialog />
    </>
  );
}

function RenderImportCallSwitchDialog({
  setImportDialogOpen,
  setImportDoneDialogOpen,
  importText,
  setImportText,
}: {
  setImportDialogOpen: (v: boolean) => void;
  setImportDoneDialogOpen: (v: boolean) => void;
  importText: string;
  setImportText: (v: string) => void;
}) {
  const [, setData] = useData();
  const processed = useProcessedData();
  const [localData, setLocalData] = useLocalData();

  let content = undefined;

  const { actions, errors } = deserializeActions(importText, processed);

  if (localData.unsavedChanges != 0) {
    content = (
      <Column>
        <Text>
          Error: You have unsaved changes. First, save them, or reload the page
          to discard those changes.
        </Text>
      </Column>
    );
  } else {
    content = (
      <Column>
        <Text>What call swaps would you like to import?</Text>
        <ElementSpacer />
        <TextField
          minRows={6}
          multiline
          placeholder="Paste the proposed call switch here"
          variant="outlined"
          value={importText}
          onChange={ev => setImportText(ev.target.value)}
        />
        <DefaultTextSize defaultSize={'12px'}>
          {errors.length > 0 && (
            <Column>
              <Text color={ERROR_COLOR}>
                Cannot understand the swaps. Maybe they were not generated by
                this page?
              </Text>
              {errors.map((e, i) => (
                <Text key={i} color={ERROR_COLOR}>
                  {e}
                </Text>
              ))}
            </Column>
          )}
          {errors.length == 0 && actions.length > 0 && (
            <Text color={OKAY_COLOR}>
              Ready to import {actions.length} call changes.
            </Text>
          )}
        </DefaultTextSize>
      </Column>
    );
  }

  return (
    <DefaultTextSize defaultSize={'16px'}>
      <Column
        style={{ padding: '20px', minWidth: '600px', maxWidth: '600px' }}
        spacing="10px"
      >
        <Row>
          <Heading>Import a call swap</Heading>
        </Row>
        {content}
        <Row
          style={{ marginTop: '10px' }}
          mainAxisAlignment="end"
          spacing="10px"
        >
          {localData.unsavedChanges == 0 && (
            <Button
              variant="contained"
              onClick={async () => {
                setLocalData((localData: LocalData) => {
                  const lastAction = localData.undoHistory.pop();
                  setData((data: CallSchedule) => {
                    for (const action of actions) {
                      const day =
                        data.weeks[action.shift.weekIndex].days[
                          action.shift.dayIndex
                        ];
                      if (action.kind == 'regular') {
                        day.shifts[action.shift.shiftName] = action.next;
                      } else {
                        day.backupShifts[action.shift.shiftName] = action.next;
                      }
                    }
                    localData.firstUnsavedChange = dateToIsoDatetime(
                      new Date(),
                    );
                    localData.unsavedChanges += actions.length;
                    localData.history = actions;
                    return { ...data };
                  });
                  if (!lastAction) return localData;
                  return { ...localData };
                });
                setImportDoneDialogOpen(true);
                setImportDialogOpen(false);
              }}
            >
              Apply changes
            </Button>
          )}
          <Button variant="outlined" onClick={() => setImportDialogOpen(false)}>
            Close
          </Button>
        </Row>
      </Column>
    </DefaultTextSize>
  );
}

function RenderSuggestCallSwitchDialog({
  setSuggestDialogOpen,
  setCopyPasteSnackbar,
}: {
  setSuggestDialogOpen: (v: boolean) => void;
  setCopyPasteSnackbar: (v: string) => void;
}) {
  const [data] = useData();
  // data.weeks[1].days[3].shifts['weekday_south'] = 'AA';
  // data.weeks[0].days[1].shifts['weekday_south'] = 'GN';
  // data.weeks[0].days[1].backupShifts['backup_weekday'] = 'LZ';
  // data.weeks[0].days[3].shifts['weekday_south'] = 'MAD';
  const initialData = useInitialData();
  const compared = compareData(initialData, data);

  let content = undefined;

  if (compared.kind == 'error') {
    content = (
      <Row>
        <Text>An error occurred: {compared.message}</Text>
      </Row>
    );
  } else if (compared.changes.length == 0) {
    content = (
      <Column>
        <Row>
          <Heading>How do I suggest a call trade?</Heading>
        </Row>
        <Text
          style={{
            fontWeight: 'bold',
          }}
        >
          First, make some call trades
        </Text>
        <Text>
          You can directly make your call swaps on this page by clicking on the
          call shift you want to change, and then selecting the person you want
          to swap with.
        </Text>
        <Text
          style={{
            fontWeight: 'bold',
          }}
        >
          Then, come back here
        </Text>
        <Text>
          You'll get a summary of the changes that can be sent to the chiefs.
        </Text>
      </Column>
    );
  } else {
    content = (
      <Column>
        <Row>
          <Heading>Suggest a call trade</Heading>
        </Row>
        <Text>You made the following call trades:</Text>
        <ElementSpacer />
        <Column
          style={{
            marginLeft: '10px',
          }}
          spacing="4px"
        >
          {compared.changes.map((change, i) => {
            const personStyle: React.CSSProperties = {
              padding: '0 0.3em',
              borderRadius: '4px',
              // boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
            };
            return (
              <Row key={i}>
                <Text>
                  <Spaced spacing="3px">
                    <Text inline>{i + 1}. Replace</Text>
                    <Text
                      inline
                      style={
                        change.previous == ''
                          ? undefined
                          : {
                              ...personStyle,
                              backgroundColor: personToColor(
                                data,
                                change.previous,
                              ),
                            }
                      }
                    >
                      {serializePerson(change.previous)}
                    </Text>
                    <Text inline>with</Text>
                    <Text
                      inline
                      style={
                        change.next == ''
                          ? undefined
                          : {
                              ...personStyle,
                              backgroundColor: personToColor(data, change.next),
                            }
                      }
                    >
                      {serializePerson(change.next)}
                    </Text>
                    <Text inline>
                      for {serializeShift(data, change.shift.shiftName)} on{' '}
                      {serializeDate(
                        data.weeks[change.shift.weekIndex].days[
                          change.shift.dayIndex
                        ].date,
                      )}
                    </Text>
                  </Spaced>
                </Text>
              </Row>
            );
          })}
        </Column>
        <ElementSpacer />
        <Text>
          If this looks right, then copy the text above and send it to your
          chiefs. They can automatically import it after review.
        </Text>
      </Column>
    );
  }

  return (
    <DefaultTextSize defaultSize={'16px'}>
      <Column
        style={{ padding: '20px', minWidth: '600px', maxWidth: '600px' }}
        spacing="10px"
      >
        {content}
        <Row
          style={{ marginTop: '10px' }}
          mainAxisAlignment="end"
          spacing="10px"
        >
          {compared.kind == 'ok' && compared.changes.length > 0 && (
            <Button
              variant="contained"
              onClick={async () => {
                const text = serializeActions(data, compared.changes);
                await navigator.clipboard.writeText(text);
                setCopyPasteSnackbar('Copied to clipboard!');
              }}
            >
              Copy to clipboard
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => setSuggestDialogOpen(false)}
          >
            Close
          </Button>
        </Row>
      </Column>
    </DefaultTextSize>
  );
}

function holidayShiftsToString(
  data: CallSchedule,
  holidayShifts: HolidayShift[],
): string {
  const { calls, hours } = countHolidayShifts(data, holidayShifts);
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

function computeBackupCallTallies(
  processed: CallScheduleProcessed,
  holiday: boolean,
): [Chief, string][] {
  return allChiefs(processed.data).map(chief => {
    const result = [];
    for (const type of !holiday
      ? (['weekday', 'weekend'] as const)
      : (['holiday', 'holiday_hours'] as const)) {
      result.push(
        `${type.replace('_', ' ')}: ${
          processed.backupCallCounts[chief].regular[type] +
          processed.backupCallCounts[chief].r2[type]
        } = ${processed.backupCallCounts[chief].regular[type]} + ${
          processed.backupCallCounts[chief].r2[type]
        } (R2)`,
      );
    }
    return [chief, result.join(', ')];
  });
}

const SHOW_TARGETS = true;
function RenderCallCounts() {
  const processed = useProcessedData();
  const [data] = useData();
  const [holiday, setHoliday] = useState<
    'regular' | 'holiday' | 'backup' | 'backup_holiday'
  >('regular');
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
            Reg
          </ToggleButton>
          <ToggleButton size="small" value="holiday">
            Holiday
          </ToggleButton>
          <ToggleButton size="small" value="backup">
            Backup
          </ToggleButton>
          <ToggleButton size="small" value="backup_holiday">
            Backup Hol
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      {holiday == 'backup' && (
        <Column spacing="5px">
          {computeBackupCallTallies(processed, false).map(([person, info]) => (
            <Row key={person} spacing={'3px'}>
              <RenderPerson
                person={person}
                style={{
                  width: '23px',
                }}
              />
              <Text>{info}</Text>
            </Row>
          ))}
        </Column>
      )}
      {holiday == 'backup_holiday' && (
        <Column spacing="5px">
          {computeBackupCallTallies(processed, true).map(([person, info]) => (
            <Row key={person} spacing={'3px'}>
              <RenderPerson
                person={person}
                style={{
                  width: '23px',
                }}
              />
              <Text>{info}</Text>
            </Row>
          ))}
        </Column>
      )}
      {holiday == 'holiday' && (
        <Column spacing="5px">
          {callPoolPeople(data).map(person => (
            <Row key={person} spacing={'3px'}>
              <RenderPerson
                person={person}
                style={{
                  width: '23px',
                }}
              />
              <Text>
                {holidayShiftsToString(
                  data,
                  collectHolidayCall(person, data, processed),
                )}
              </Text>
            </Row>
          ))}
        </Column>
      )}
      {holiday == 'regular' && (
        <Column>
          {callPoolPeople(data).map(person => {
            const personConfig = data.people[person];
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
                      display: 'block',
                    }}
                  >
                    <Text
                      inline
                      style={{
                        fontWeight:
                          counts.weekday + counts.sunday >
                          data.callTargets.weekday[personConfig.year][person]
                            ? 'bold'
                            : 'normal',
                      }}
                    >
                      {counts.weekday + counts.sunday} weekday{' '}
                    </Text>
                    {SHOW_TARGETS && (
                      <Text
                        inline
                        style={{
                          fontWeight:
                            counts.weekday + counts.sunday <
                            data.callTargets.weekday[personConfig.year][person]
                              ? 'bold'
                              : 'normal',
                        }}
                      >
                        (target:{' '}
                        {data.callTargets.weekday[personConfig.year][person]}){' '}
                      </Text>
                    )}
                    <Text inline>
                      out of which {counts.sunday} are sundays{' '}
                    </Text>
                    <Text inline>/ </Text>
                    <Text
                      inline
                      style={{
                        fontWeight:
                          counts.weekend >
                          data.callTargets.weekend[personConfig.year][person]
                            ? 'bold'
                            : 'normal',
                      }}
                    >
                      {counts.weekend} weekend{' '}
                    </Text>
                    {SHOW_TARGETS && (
                      <Text
                        inline
                        style={{
                          fontWeight:
                            counts.weekend <
                            data.callTargets.weekend[personConfig.year][person]
                              ? 'bold'
                              : 'normal',
                        }}
                      >
                        (target:{' '}
                        {data.callTargets.weekend[personConfig.year][person]}){' '}
                      </Text>
                    )}
                    <Text inline>/ </Text>
                    <Text inline>{counts.nf} NF</Text>
                  </Text>
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

export const OKAY_COLOR = '#00CC00';
export const WARNING_COLOR = '#FFCC00';
export const ERROR_COLOR = 'hsl(0, 70%, 50%)';

function Highlight() {
  const [data] = useData();
  const [_, setLocalData] = useLocalData();
  const year2people = getYearToPeople(data, [
    '1',
    '2',
    '3',
    'S',
    'R',
    'M',
    'C',
  ]);
  return (
    <Column spacing="5px">
      <Heading>Highlight</Heading>
      {Object.entries(year2people)
        .sort(
          (a, b) =>
            YEAR_ORDER.indexOf(a[0] as Year) - YEAR_ORDER.indexOf(b[0] as Year),
        )
        .map(([year, people]) => (
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
      spacing={`${DAY_SPACING}px`}
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

const DAY_SPACING = 2;
const DAY_WIDTH = 110;
const DAY_LEGEND_WIDTH = 80;
const WEEK_WIDTH = DAY_WIDTH * 7 + DAY_SPACING * 7 + DAY_LEGEND_WIDTH;
const SIDEBAR_WIDTH = 560;
const DAY_PADDING = 5;
const DAY_VACATION_HEIGHT = '37px';
const DAY_BACKUP_HEIGHT = '23px';
const DAY_HOSPITALS_HEIGHT = '90px';
const DAY_BORDER = `1px solid black`;
const DAY_BORDER_TODAY = `2px solid black`;
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
        width: `${DAY_LEGEND_WIDTH}px`,
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
      <Column
        style={{
          ...DAY_BOX_STYLE,
          minHeight: DAY_BACKUP_HEIGHT,
          padding: `3px ${DAY_PADDING}px`,
        }}
      >
        <Text>Backup call</Text>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE }}>
        <Text>Call</Text>
      </Column>
    </Column>
  );
}

function RenderEditConfigButton({
  config,
  canEditRaw,
  showEditRaw,
  tiny,
}: {
  config: ConfigEditorConfig;
  canEditRaw: boolean;
  showEditRaw: boolean;
  tiny?: boolean;
}) {
  const configEditor = useConfigEditor();
  if (!showEditRaw) return null;
  return (
    <Tooltip title={configEditorTitle(config.kind)}>
      <TuneIcon
        sx={{
          fontSize: tiny === true ? 13 : undefined,
          cursor: canEditRaw ? 'pointer' : undefined,
          color: canEditRaw ? undefined : 'disabled',
        }}
        onClick={() => configEditor.requestDialog(() => {}, config)}
      />
    </Tooltip>
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
  const [localData] = useLocalData();
  const [today, setToday] = useState(dateToIsoDate(new Date()));
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const date = isoDateToDate(day.date);
  const processed = useProcessedData();
  const isHoliday = data.holidays[day.date] !== undefined;
  const isSpecial = data.specialDays[day.date] !== undefined;
  const isToday = day.date == today;
  const showRotationsToday =
    (id.dayIndex == 0 && id.weekIndex !== 0) ||
    (id.dayIndex == 1 && id.weekIndex == 0);
  const backgroundColor = isHoliday
    ? '#fee'
    : isSpecial
      ? '#eef'
      : isToday
        ? '#efe'
        : undefined;

  useEffect(() => {
    const timer = setInterval(
      () => {
        setToday(dateToIsoDate(new Date()));
      },
      1000 * 60 * 10,
    );
    return () => clearInterval(timer);
  }, []);

  const vacation = processed.day2person2info[day.date]
    ? Object.entries(processed.day2person2info[day.date]).filter(
        ([_, info]) => assertNonNull(info).onVacation,
      )
    : [];
  const priorityWeekend = processed.day2person2info[day.date]
    ? Object.entries(processed.day2person2info[day.date]).filter(
        ([_, info]) => assertNonNull(info).onPriorityWeekend,
      )
    : [];
  const showEditRaw = showEditRawData(data, localData);
  const canEditRaw = canEditRawData(data, localData);
  return (
    <Column
      id={elementIdForDay(day.date)}
      style={{
        border: isToday ? DAY_BORDER_TODAY : DAY_BORDER,
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
        <Row>
          <Text
            style={{
              fontWeight: isHoliday || isSpecial ? 'bold' : 'normal',
            }}
          >
            {datefns.format(date, 'EEE, M/d')}
          </Text>
          <ElementSpacer space={2} />
          {showEditRaw && (
            <>
              <RenderEditConfigButton
                showEditRaw={showEditRaw}
                canEditRaw={canEditRaw}
                config={{
                  kind: 'shifts',
                  day: day.date,
                }}
                tiny
              />
              <ElementSpacer space={2} />
              <RenderEditConfigButton
                showEditRaw={showEditRaw}
                canEditRaw={canEditRaw}
                config={{
                  kind: 'chief-shifts',
                  day: day.date,
                }}
                tiny
              />
            </>
          )}
        </Row>
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
            <RenderPerson key={person} person={person} />
          ))}
          {priorityWeekend.length + vacation.length > 0 && (
            <ElementSpacer space="2px" />
          )}
          {priorityWeekend.length > 0 && <Text>(</Text>}
          {priorityWeekend.map(([person]) => (
            <RenderPerson key={person} person={person} />
          ))}
          {priorityWeekend.length > 0 && <Text>)</Text>}
        </Row>
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column
        style={{
          ...DAY_BOX_STYLE,
          minHeight: DAY_BACKUP_HEIGHT,
          padding: '3px',
        }}
      >
        {Object.entries(day.backupShifts).map(([shiftName]) => (
          <RenderBackupShift
            id={{ ...id, shiftName }}
            key={`${day.date}-${shiftName}`}
          />
        ))}
      </Column>
      <Column style={{ borderBottom: DAY_BORDER }}></Column>
      <Column style={{ ...DAY_BOX_STYLE, padding: '3px' }}>
        {Object.entries(day.shifts)
          .sort(
            (a, b) =>
              HOSPITAL_ORDER.indexOf(data.shiftConfigs[a[0]].hospitals[0]) -
              HOSPITAL_ORDER.indexOf(data.shiftConfigs[b[0]].hospitals[0]),
          )
          .map(([shiftName]) => (
            <RenderShift
              id={{ ...id, shiftName }}
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

function RenderBackupShift({ id }: { id: ChiefShiftId }) {
  const [data, setData] = useData();
  const [, setLocalData] = useLocalData();
  const processed = useProcessedData();
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const personPicker = usePersonPicker();
  const personId = day.backupShifts[id.shiftName] ?? '';
  const backupShiftName = mapEnum(id.shiftName, {
    backup_weekday: 'Weekday',
    backup_weekend: 'Weekend',
    backup_holiday: 'Holiday',
  });
  // useEffect(() => {
  //   if (day.date == '2024-07-09') {
  //     personPicker.requestDialog(() => {}, {
  //       kind: 'backup',
  //       currentPersonId: '',
  //       day: day.date,
  //       shift: id.shiftName,
  //       shiftName: 'Backup',
  //     });
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
  return (
    <RenderShiftGeneric
      dayId={id}
      personId={personId}
      name={backupShiftName}
      shiftId={id.shiftName}
      dashedBorder={processed.day2isR2EarlyCall[day.date]}
      onClick={() => {
        personPicker.requestDialog(
          (p, assignWholeWeek) => {
            const person = assertMaybeChief(p);
            const days = assignWholeWeek
              ? [0, 1, 2, 3, 4, 5, 6]
              : [id.dayIndex];
            for (const dayIndex of days) {
              const previous =
                data.weeks[id.weekIndex].days[dayIndex].backupShifts[
                  id.shiftName
                ];
              if (previous === undefined) continue;
              setData((d: CallSchedule) => {
                d.weeks[id.weekIndex].days[dayIndex].backupShifts[
                  id.shiftName
                ] = person;
                return { ...d };
              });
              setLocalData((d: LocalData) => {
                d.history.push({
                  kind: 'backup',
                  previous,
                  next: person,
                  shift: {
                    ...id,
                    dayIndex,
                  },
                });
                d.undoHistory = [];
                if (d.unsavedChanges === 0) {
                  d.firstUnsavedChange = dateToIsoDatetime(new Date());
                }
                d.unsavedChanges += 1;
                return { ...d };
              });
            }
          },
          {
            kind: 'backup',
            currentPersonId: personId,
            day: day.date,
            shift: id.shiftName,
            shiftName: backupShiftName,
          },
        );
      }}
    />
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
  const processed = useProcessedData();
  const day = data.weeks[id.weekIndex].days[id.dayIndex];
  const personPicker = usePersonPicker();
  const personId = day.shifts[id.shiftName] ?? '';
  // useEffect(() => {
  //   if (day.date == '2024-07-04') {
  //     personPicker.requestDialog(() => {}, {
  //       kind: 'regular',
  //       currentPersonId: '',
  //       day: day.date,
  //       shift: id.shiftName,
  //       shiftName: assertNonNull(data.shiftConfigs[id.shiftName]).name,
  //     });
  //   }
  // }, []);
  return (
    <RenderShiftGeneric
      dayId={id}
      personId={personId}
      name={assertNonNull(data.shiftConfigs[id.shiftName]).name}
      shiftId={id.shiftName}
      dashedBorder={Boolean(
        processed.day2shift2isHoliday?.[day.date]?.[id.shiftName],
      )}
      onClick={() => {
        personPicker.requestDialog(
          p => {
            const person = assertMaybeCallPoolPerson(p);
            if (data.isPublic) {
              setWarningSnackbar(
                `You won't be able to save your changes, this is a read-only version of the call schedule application`,
              );
            }
            const previous = assertNonNull(
              data.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName],
            );
            setData((d: CallSchedule) => {
              d.weeks[id.weekIndex].days[id.dayIndex].shifts[id.shiftName] =
                person;
              return { ...d };
            });
            setLocalData((d: LocalData) => {
              d.history.push({
                kind: 'regular',
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
            kind: 'regular',
            currentPersonId: personId,
            day: day.date,
            shift: id.shiftName,
            shiftName: assertNonNull(data.shiftConfigs[id.shiftName]).name,
          },
        );
      }}
    />
  );
}

function RenderShiftGeneric({
  dayId,
  personId,
  name,
  shiftId,
  dashedBorder,
  onClick,
}: {
  dayId: DayId;
  personId: MaybePerson;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
  shiftId: ShiftKind | ChiefShiftKind;
  dashedBorder?: boolean;
  onClick?: () => void;
}) {
  const [data] = useData();
  const day = data.weeks[dayId.weekIndex].days[dayId.dayIndex];
  const processed = useProcessedData();
  const elId = elementIdForShift(day.date, shiftId);
  const hasIssue = processed.element2issueKind[elId];
  return (
    <Row
      id={elId}
      style={{
        boxSizing: 'border-box',
        border: `1px solid #aaa`,
        borderStyle: dashedBorder ? 'dashed' : 'solid',
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
      onClick={onClick}
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

export const RenderPerson = React.forwardRef(function RenderPerson(
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

export function getYearToPeople(
  data: CallSchedule,
  years: Year[] = ['2', '3', 'S', 'R', 'M'],
): {
  [year in Year]?: (PersonConfig & { id: Person })[];
} {
  const yearToPeople: {
    [year in Year]?: (PersonConfig & { id: Person })[];
  } = {};
  for (const [id, person] of Object.entries(data.people)) {
    if (!years.includes(person.year)) continue;
    if (!yearToPeople[person.year]) yearToPeople[person.year] = [];
    assertNonNull(yearToPeople[person.year]).push({
      ...person,
      id: id,
    });
  }
  return yearToPeople;
}

export const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
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
