import { useState } from 'react';
import { Column, Row } from '../common/flex';
import { useAsync } from '../common/hooks';
import { Heading, Text } from '../common/text';
import { getAcademicYear, StoredCallScheduleMetaData } from '../shared/types';
import { MainLayout } from './layout';
import { rpcGetDiff, rpcListCallSchedules, rpcLoadCallSchedules, rpcRestorePreviousVersion } from './rpc';
import { LoadingIndicator } from '../common/loading';
import {
  assertNonNull,
  deparseUserIsoDatetime,
  IsoDatetime,
  isoDatetimeToDate,
} from '../shared/common/check-type';
import { formatRelative } from '../shared/common/formatting';
import { Button, Checkbox, Dialog, IconButton, Snackbar, ToggleButton, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useData } from './data-context';
import CloseIcon from '@mui/icons-material/Close';
import { Ui } from '../App';
import { ButtonWithConfirm } from '../common/button';
import { CheckBox } from '@mui/icons-material';

export function HistoryPage() {
  const [schedules, setSchedules] = useState<
    undefined | StoredCallScheduleMetaData[]
  >(undefined);
  const navigate = useNavigate();
  const [data] = useData();
  const [isLoading, setIsLoading] = useState(false);

  useAsync(async () => {
    if (schedules === undefined && data.isPublic !== true) {
      const result = await rpcListCallSchedules({
        kind: 'list',
        academicYear: getAcademicYear(data.academicYear),
      });
      setSchedules(result.schedules);
    }
  }, [schedules, data.isPublic, data.academicYear]);

  if (data.isPublic === true) {
    return <Ui />;
  }

  return (
    <MainLayout>
      <Column spacing="10px">
        <Row>
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              await navigate(`/${data.academicYear}`);
            }}
            disabled={isLoading}
          >
            Go back
          </Button>
        </Row>
        <Heading>History</Heading>
        {schedules == undefined && <LoadingIndicator />}
        {schedules != undefined && (
          <RenderSchedules
            schedules={schedules}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        )}
      </Column>
    </MainLayout>
  );
}

function RenderSchedules({
  schedules,
  isLoading,
  setIsLoading,
}: {
  schedules: StoredCallScheduleMetaData[];
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}) {
  const [originalData, setData] = useData();
  const [errorSnackbar, setErrorSnackbar] = useState('');
  const navigate = useNavigate();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([0]);
  const [diff, setDiff] = useState<string>('');

  const runDiff = async (beforeTs: IsoDatetime, afterTs: IsoDatetime) => {
    if (beforeTs > afterTs) {
      const temp = beforeTs;
      beforeTs = afterTs;
      afterTs = temp;
    }
    try {
      setIsLoading(true);
      const result = await rpcGetDiff({
        academicYear: getAcademicYear(originalData.academicYear),
        beforeTs,
        afterTs,
      });
      switch (result.kind) {
        case 'ok':
          setDiff(result.diff);
          setIsLoading(false);
          return;
        case 'not-found':
          setErrorSnackbar(`Could not find the version you are trying to restore. Maybe ask Stefan for help.`);
          break;
      }
    } catch (e) {
      console.log(e);
      setIsLoading(false);
      setErrorSnackbar(`Failed to fetch schedule.`);
    }
  };

  return (
    <Column spacing="5px">
      <Snackbar
        open={errorSnackbar != ''}
        onClose={() => setErrorSnackbar('')}
        message={errorSnackbar}
        autoHideDuration={5000}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            sx={{ p: 0.5 }}
            onClick={() => setErrorSnackbar('')}
          >
            <CloseIcon />
          </IconButton>
        }
      />
      <Text>
        Here are all previous version of the schedule.
      </Text>
      <Button
        disabled={isLoading || selectedIndices.length !== 2}
        onClick={async () => {
          await runDiff(schedules[selectedIndices[0]].ts, schedules[selectedIndices[1]].ts);
        }}
        variant="outlined"
        size="small"
        style={{
          width: '300px',
        }}
      >
        <Text>Compare selected versions</Text>
      </Button>
      <Dialog open={diff !== ''} onClose={() => setDiff('')}>
        <Row style={{
          margin: '20px',
          width: '950px',
        }}>
          <Column spacing="10px">
            <Heading>Changes</Heading>
            <pre>{diff}</pre>
          </Column>
        </Row>
      </Dialog>
      {schedules
        .sort((a, b) => -a.ts.localeCompare(b.ts))
        .map((schedule, scheduleIndex) => {
          return (
            <Row
              key={schedule.ts}
              style={{
                width: '950px',
                padding: '5px 10px',
                border: '1px solid #ccc',
              }}
              spacing="20px"
            >
              <Column
                style={{
                  minWidth: '160px',
                }}
              >
                <Text>{deparseUserIsoDatetime(schedule.ts)}</Text>
                <Text
                  style={{
                    fontSize: '12px',
                  }}
                >
                  {formatRelative(isoDatetimeToDate(schedule.ts), 'past')}
                </Text>
              </Column>
              <Column style={{ width: '500px' }}>
                <Text>
                  {schedule.name == ''
                    ? 'Manual save without name'
                    : schedule.name}
                </Text>
                {/* <Text
                  style={{
                    fontSize: '12px',
                  }}
                >
                  Shifts assigned: {schedule.shiftCounts.assigned}/
                  {schedule.shiftCounts.total};{' '}
                  {schedule.backupShiftCounts &&
                    `Backup shifts: ${schedule.backupShiftCounts.assigned}/${schedule.backupShiftCounts.total}; `}
                  Violations: {schedule.issueCounts.soft} soft and{' '}
                  {schedule.issueCounts.hard} hard
                  {schedule.lastEditedBy
                    ? `; saved by ${schedule.lastEditedBy}`
                    : ''}
                </Text> */}
                <Text
                  style={{
                    fontSize: '12px',
                  }}
                >
                  {schedule.shortDiff ?? ''}
                </Text>
              </Column>
              <Row spacing="5px">
                <Tooltip title={
                  scheduleIndex === 0 ?
                    'This is already the current version.' :
                    !schedule.canRestore ?
                      'This version cannot be restored because it is using an outdated storage format. Please ask Stefan for help.' :
                      ''}>
                  <Row spacing="5px">
                    <ButtonWithConfirm
                      confirmText='This will restore this version and make it the new current version for everyone.'
                      disabled={isLoading || !schedule.canRestore || scheduleIndex === 0}
                      onClick={async () => {
                        try {
                          setIsLoading(true);
                          const result = await rpcRestorePreviousVersion({
                            currentVersionToReplace: assertNonNull(originalData.lastEditedAt),
                            versionToRestore: schedule.ts,
                            academicYear: getAcademicYear(originalData.academicYear),
                          });
                          switch (result.kind) {
                            case 'ok':
                              setData(result.data);
                              await navigate(`/${originalData.academicYear}`);
                              break;
                            case 'not-found':
                              setErrorSnackbar(`Could not find the version you are trying to restore. Maybe ask Stefan for help.`);
                              break;
                            case 'not-latest':
                              setErrorSnackbar(`There is a more recent version available; please refresh the page first, then try again.`);
                              break;
                          }
                        } catch (e) {
                          console.log(e);
                          setIsLoading(false);
                          setErrorSnackbar(`Failed to fetch schedule.`);
                        }
                      }}
                      variant="outlined"
                      size="small"
                    >
                      <Text>Restore</Text>
                    </ButtonWithConfirm>
                    <ButtonWithConfirm
                      confirmText='This allows you to just view a previous version (but will not change the current version for anyone else until you click restore).'
                      disabled={isLoading || !schedule.canRestore || scheduleIndex === 0}
                      onClick={async () => {
                        try {
                          setIsLoading(true);
                          const result = await rpcLoadCallSchedules({
                            ts: schedule.ts,
                            currentTs: assertNonNull(originalData.lastEditedAt),
                            academicYear: getAcademicYear(originalData.academicYear),
                          });
                          switch (result.kind) {
                            case 'not-available':
                              setErrorSnackbar(`This schedule is not available.`);
                              return;
                            case 'call-schedule':
                              setData(result);
                              await navigate(`/${originalData.academicYear}`);
                              break;
                            case undefined:
                              setErrorSnackbar(`Failed to fetch schedule.`);
                              break;
                          }
                        } catch (e) {
                          console.log(e);
                          setIsLoading(false);
                          setErrorSnackbar(`Failed to fetch schedule.`);
                        }
                      }}
                      variant="contained"
                      size="small"
                    >
                      <Text>View</Text>
                    </ButtonWithConfirm>
                  </Row>
                </Tooltip>
                <Button
                  disabled={isLoading || !schedule.canRestore || scheduleIndex === schedules.length - 1}
                  onClick={async () => {
                    await runDiff(schedule.ts, assertNonNull(schedules[scheduleIndex + 1].ts));
                  }}
                  variant="outlined"
                  size="small"
                >
                  <Text>Compare with previous</Text>
                </Button>
                <Checkbox
                  checked={selectedIndices.includes(scheduleIndex)}
                  onChange={val => {
                    if (val.target.checked) {
                      setSelectedIndices([scheduleIndex, ...selectedIndices.slice(0, 1)]);
                    } else {
                      setSelectedIndices(selectedIndices.filter(i => i !== scheduleIndex));
                    }
                  }}
                />
              </Row>
            </Row>
          );
        })}
    </Column>
  );
}
