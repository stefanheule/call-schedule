import { assertNonNull, IsoDate } from 'check-type';
import { createContext, useContext, useState } from 'react';
import { Children, Column, Row } from '../common/flex';
import {
  ChiefShiftKind,
  MaybeCallPoolPerson,
  MaybeChief,
  MaybePerson,
  ShiftKind,
  Year,
  YEAR_ORDER,
  yearToString,
} from '../shared/types';
import { useData, useProcessedData } from './data-context';
import { inferShift, yearToColor } from '../shared/compute';
import {
  ERROR_COLOR,
  getYearToPeople,
  LightTooltip,
  RenderPerson,
  WARNING_COLOR,
} from './schedule';
import { Button, Dialog } from '@mui/material';
import { Heading, Text } from '../common/text';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';

export type PersonPickerConfig =
  | {
      kind: 'regular';
      currentPersonId: MaybeCallPoolPerson;
      shift: ShiftKind;
      day: IsoDate;
      shiftName: string;
    }
  | {
      kind: 'backup';
      currentPersonId: MaybeChief;
      shift: ChiefShiftKind;
      day: IsoDate;
      shiftName: string;
    };

export type PersonPickerType = {
  requestDialog: (
    callback: (person: MaybePerson, assignWholeWeek: boolean) => void,
    config: PersonPickerConfig,
  ) => void;
  handleDialogResult: (person: MaybePerson, assignWholeWeek: boolean) => void;
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
  const [onResult, setOnResult] = useState(
    () => (_: MaybePerson, _2: boolean) => {},
  );
  const [config, setConfig] = useState<PersonPickerConfig>({
    kind: 'regular',
    currentPersonId: '',
    shift: 'day_nwhsch',
    day: '2024-05-23' as IsoDate,
    shiftName: '',
  });

  const requestDialog = (
    callback: (person: MaybePerson, assignWholeWeek: boolean) => void,
    config: PersonPickerConfig,
  ) => {
    setIsOpen(true);
    setOnResult(() => callback);
    setConfig(config);
  };

  const handleDialogResult = (
    person: MaybePerson,
    assignWholeWeek: boolean,
  ) => {
    setIsOpen(false);
    onResult(person, assignWholeWeek);
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

export function PersonPickerDialog() {
  const personPicker = usePersonPicker();
  const [data] = useData();
  const processed = useProcessedData();
  const config = personPicker.config;
  const inference =
    config.kind == 'backup'
      ? undefined
      : inferShift(data, processed, config.day, config.shift);
  // const initialRating = rate(data, processed);
  const isBackup = config.kind == 'backup';

  const yearToPeople = getYearToPeople(
    data,
    isBackup ? ['C'] : ['2', '3', 'S', 'R', 'M'],
  );
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
          {config.shiftName} on {config.day}
        </Heading>
        <Row crossAxisAlignment="start">
          {(isBackup && config.shift == 'backup_weekday'
            ? [false, true]
            : [false]
          ).map(assignWholeWeek => (
            <Row
              crossAxisAlignment="start"
              key={assignWholeWeek ? 'yes' : 'no'}
            >
              {Object.entries(yearToPeople)
                .sort(
                  (a, b) =>
                    YEAR_ORDER.indexOf(a[0] as Year) -
                    YEAR_ORDER.indexOf(b[0] as Year),
                )
                .map(([year, people]) =>
                  people.length == 0 ? null : (
                    <Column
                      key={year}
                      style={{
                        marginRight: '20px',
                        width: `${assignWholeWeek ? 160 : 110}px`,
                      }}
                      crossAxisAlignment="end"
                    >
                      <Text
                        style={{
                          fontWeight: 'bold',
                          color: yearToColor(year, true),
                        }}
                      >
                        {yearToString(year as Year)}
                        {assignWholeWeek ? ' (whole week)' : ''}
                      </Text>
                      <Column spacing="3px" crossAxisAlignment="end">
                        {people.map(person => {
                          const unavailable = inference
                            ? inference.unavailablePeople[person.id]
                            : undefined;

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
                                personPicker.config.currentPersonId ===
                                person.id
                              }
                              onClick={() =>
                                personPicker.handleDialogResult(
                                  person.id,
                                  assignWholeWeek,
                                )
                              }
                            />
                          );
                          // const rating =
                          //   inference?.best?.ratings?.[person.id]?.rating;
                          return (
                            <Row key={person.id} spacing={'2px'}>
                              {/* {rating && (
                            <Text
                              style={{
                                color: '#ccc',
                                fontSize: '12px',
                              }}
                            >
                              {ratingToString(
                                ratingMinus(rating, initialRating),
                              )}
                            </Text>
                          )} */}
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
          ))}
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
            onClick={() => personPicker.handleDialogResult('', false)}
          >
            Clear assigned person
          </Button>
          {config.kind == 'regular' && (
            <Button
              variant="contained"
              size="small"
              style={{
                width: buttonWidth,
              }}
              disabled={!inference?.best}
              onClick={() => {
                personPicker.handleDialogResult(
                  inference?.best?.person ?? '',
                  false,
                );
              }}
            >
              {inference?.best && `Auto-assign (${inference?.best.person})`}
              {!inference?.best && `Nobody available`}
            </Button>
          )}
        </Row>
      </Column>
    </Dialog>
  );
}
