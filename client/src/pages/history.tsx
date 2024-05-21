import { useState } from 'react';
import { Column, Row } from '../common/flex';
import { useAsync } from '../common/hooks';
import { Heading, Text } from '../common/text';
import { StoredCallScheduleMetaData } from '../shared/types';
import { MainLayout } from './layout';
import { rpcListCallSchedules, rpcLoadCallSchedules } from './rpc';
import { LoadingIndicator } from '../common/loading';
import { deparseUserIsoDatetime, isoDatetimeToDate } from 'check-type';
import { formatRelative } from '../shared/common/formatting';
import { Button, IconButton, Snackbar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useData } from './data-context';
import CloseIcon from '@mui/icons-material/Close';

export function HistoryPage() {
  const [schedules, setSchedules] = useState<
    undefined | StoredCallScheduleMetaData[]
  >(undefined);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useAsync(async () => {
    if (schedules === undefined) {
      const result = await rpcListCallSchedules({
        kind: 'list',
      });
      setSchedules(result.schedules);
    }
  }, [schedules]);

  return (
    <MainLayout>
      <Column spacing="10px">
        <Row>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              navigate('/');
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
  const [, setData] = useData();
  const [errorSnackbar, setErrorSnackbar] = useState('');
  const navigate = useNavigate();
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
        Here are all previous version of the schedule. Click to view any of
        them.
      </Text>
      {schedules
        .sort((a, b) => -a.ts.localeCompare(b.ts))
        .map(schedule => {
          return (
            <Row
              key={schedule.ts}
              onClick={async () => {
                try {
                  const result = await rpcLoadCallSchedules({
                    ts: schedule.ts,
                  });
                  setData(result);
                  navigate('/');
                } catch (e) {
                  console.log(e);
                  setIsLoading(false);
                  setErrorSnackbar(`Failed to fetch schedule.`);
                }
              }}
              style={{
                width: '600px',
                padding: '5px 10px',
                border: '1px solid #ccc',
                cursor: 'pointer',
                opacity: isLoading ? 0.5 : undefined,
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
              <Column>
                <Text>{schedule.name}</Text>
                <Text
                  style={{
                    fontSize: '12px',
                  }}
                >
                  Shifts assigned: {schedule.shiftCounts.assigned}/
                  {schedule.shiftCounts.total}; Violations:{' '}
                  {schedule.issueCounts.soft} soft and{' '}
                  {schedule.issueCounts.hard} hard
                </Text>
              </Column>
            </Row>
          );
        })}
    </Column>
  );
}
