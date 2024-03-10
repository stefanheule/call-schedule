import { isoDateToDate } from 'check-type';
import { Center, Children, Column, Row } from '../common/flex';
import { DefaultTextSize, Heading, Text } from '../common/text';
import { Day, Week } from '../shared/types';
import { useData } from './data-context';
import * as datefns from 'date-fns';

const DAY_SPACING = `2px`;

export function RenderCallSchedule() {
  const [data, setData] = useData();
  return (
    <Column>
      <Heading>Call Schedule</Heading>
      <DefaultTextSize defaultSize={'12px'}>
        <Row crossAxisAlignment="start">
          <Column spacing={DAY_SPACING}>
            <RenderWeek week={data.weeks[0]} />
            <RenderWeek week={data.weeks[1]} />
          </Column>
          <Column
            style={{
              marginLeft: `10px`,
            }}
          >
            <Heading>Errors</Heading>
          </Column>
        </Row>
      </DefaultTextSize>
    </Column>
  );
}

function RenderWeek({ week }: { week: Week }) {
  return (
    <Row crossAxisAlignment="start" spacing={DAY_SPACING}>
      {week.days.map(day => (
        <RenderDay day={day} key={day.date} />
      ))}
    </Row>
  );
}

function RenderShift({
  name,
  person,
}: {
  name: string;
  person: string | undefined;
}) {
  return (
    <Column style={{ textAlign: 'center' }}>
      <Text>{name}</Text>
      <ColorPill color="#fcc">
        <Text
          style={{
            textAlign: 'right',
          }}
        >
          {person}
        </Text>
      </ColorPill>
    </Column>
  );
}

function RenderDay({ day }: { day: Day }) {
  const date = isoDateToDate(day.date);
  const [data] = useData();
  return (
    <Column
      style={{
        border: `1px solid black`,
        borderRadius: `5px`,
        padding: `2px 5px`,
        width: `110px`,
        minHeight: `100px`,
        opacity: day.date < data.firstDay || day.date > data.lastDay ? 0.5 : 1,
      }}
    >
      <Text>{datefns.format(date, 'EEEE, M/d')}</Text>
      {Object.entries(day.shifts).map(([name, person]) => (
        <RenderShift name={name} person={person} key={`${day.date}-${name}`} />
      ))}
    </Column>
  );
}

export function ColorPill({
  color,
  children,
}: {
  color: string;
  size?: string;
} & Children): JSX.Element {
  const height = '18px';
  const width = '30px';
  return (
    <Center
      style={{
        backgroundColor: color,
        borderRadius: '8px',
        width,
        height,
        minWidth: width,
        minHeight: height,
        display: 'inline-block',
      }}
    >
      {children}
    </Center>
  );
}
