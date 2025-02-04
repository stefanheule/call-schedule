import { assertNonNull, IsoDate, mapEnum } from '../shared/common/check-type';
import { createContext, useContext, useState } from 'react';
import { Children, Column, ElementSpacer, Row } from '../common/flex';
import {
  CallSchedule,
  CallTarget,
  ChiefShiftAssignment,
  ChiefShiftConfigs,
  EDITOR_TYPES,
  Holidays,
  MaybePerson,
  PeopleConfig,
  RotationSchedule,
  ShiftAssignment,
  ShiftConfigs,
  SpecialDays,
  VacationSchedule,
} from '../shared/types';
import { useData } from './data-context';
import { Button, Dialog } from '@mui/material';
import { Heading, Text } from '../common/text';
import Editor from '@monaco-editor/react';
import { rpcSaveFullCallSchedules } from './rpc';
import { assertCallSchedule } from '../shared/check-type.generated';
import { validateData } from '../shared/validate';
import { processCallSchedule } from '../shared/compute';

export type RegularConfigEditorKind =
  | 'holidays'
  | 'special-days'
  | 'vacations'
  | 'rotations'
  | 'call-targets'
  | 'people'
  | 'shift-configs'
  | 'backup-shift-configs';

export type ConfigEditorConfig =
  | {
      kind: RegularConfigEditorKind;
    }
  | {
      kind: 'shifts' | 'backup-shifts';
      day: IsoDate;
    };

export type ConfigEditorCallback = () => void;

export type ConfigEditorType = {
  requestDialog: (
    callback: ConfigEditorCallback,
    config: ConfigEditorConfig,
  ) => void;
  handleDialogResult: (person: MaybePerson, assignWholeWeek: boolean) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isSubmitting: boolean;
  setIsSubmitting: (submitting: boolean) => void;
  dialogContent: string;
  setDialogContent: (message: string) => void;
  setCopyPasteSnackbar: (v: string) => void;
  config: ConfigEditorConfig;
};

function findRequiredTypes(type: string): string[] {
  const noComments = type
    .split(`\n`)
    .map(x => x.split('//')[0])
    .map(x => x.split('/*')[0])
    .join('\n');
  return (
    noComments
      // Split by type boundaries
      .split(/[ >;:,<\[\]]/)
      // Only keep types (i.e. alphabetic strings starting with an uppercase letter)
      .filter(t => /^[A-Z][A-Za-z]+$/.test(t))
      // Remove built-in types
      .filter(x => !['Record', 'Partial'].includes(x))
  );
}
function getEditorTypeForKind(
  kind: ConfigEditorConfig['kind'],
  data: CallSchedule,
): string {
  // Start with the Result type
  const result: { name: string; definition: string }[] = [
    {
      name: 'Result',
      definition: EDITOR_TYPES[kind],
    },
  ];

  // Then go through the types, and find all dependencies
  const newTypes: string[] = [EDITOR_TYPES[kind]];
  while (newTypes.length > 0) {
    const type = newTypes.pop();
    if (type === undefined) break;
    const requirements = findRequiredTypes(type);
    for (const requirement of requirements) {
      if (!result.find(x => x.name === requirement)) {
        const definition = assertNonNull(
          EDITOR_TYPES[requirement as 'holidays'],
          `Could not find type definition for ${requirement}`,
        );

        // Replace string types with union when possible
        function optionsToUnion(options: string[]): string {
          return options.map(x => `'${x}'`).join(' | ') + `;`;
        }
        if (requirement == 'Person' && kind !== 'people') {
          result.push({
            name: requirement,
            definition: optionsToUnion(Object.keys(data.people)),
          });
        } else if (requirement == 'Chief') {
          result.push({
            name: requirement,
            definition: optionsToUnion(
              Object.keys(data.people).filter(p => data.people[p].year === 'C'),
            ),
          });
        } else if (requirement == 'CallPoolPerson') {
          result.push({
            name: requirement,
            definition: optionsToUnion(
              Object.keys(data.people).filter(
                p => !['C', '1'].includes(data.people[p].year),
              ),
            ),
          });
        } else if (requirement == 'ShiftKind' && kind !== 'shift-configs') {
          result.push({
            name: requirement,
            definition: optionsToUnion(Object.keys(data.shiftConfigs)),
          });
        } else if (
          requirement == 'BackupShiftKind' &&
          kind !== 'backup-shift-configs'
        ) {
          result.push({
            name: requirement,
            definition: optionsToUnion(Object.keys(data.chiefShiftConfigs)),
          });
        }

        // Otherwise, just use the type from the constant, and make sure to also go through its dependencies.
        else {
          result.push({
            name: requirement,
            definition,
          });
          newTypes.push(definition);
        }
      }
    }
  }
  return result
    .reverse()
    .map(item => `type ${item.name} = ${item.definition}`)
    .join('\n');
}

const ConfigEditorContext = createContext<ConfigEditorType | undefined>(
  undefined,
);

export function useConfigEditor(): ConfigEditorType {
  return assertNonNull(useContext(ConfigEditorContext));
}

export const ConfigEditorProvider = ({
  children,
  setCopyPasteSnackbar,
}: {
  setCopyPasteSnackbar: (v: string) => void;
} & Children) => {
  const [dialogContent, setDialogContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [onResult, setOnResult] = useState(() => () => {});
  const [config, setConfig] = useState<ConfigEditorConfig>({
    kind: 'holidays',
  });

  const requestDialog = (
    callback: ConfigEditorCallback,
    config: ConfigEditorConfig,
  ) => {
    setIsOpen(true);
    setOnResult(() => callback);
    setConfig(config);
  };

  const handleDialogResult = () => {
    setIsOpen(false);
    onResult();
  };

  return (
    <ConfigEditorContext.Provider
      value={{
        requestDialog,
        handleDialogResult,
        isOpen,
        setIsOpen,
        isSubmitting,
        setIsSubmitting,
        dialogContent,
        setDialogContent,
        setCopyPasteSnackbar,
        config,
      }}
    >
      {children}
    </ConfigEditorContext.Provider>
  );
};

function objectToCode(obj: unknown, level: number = 0): string {
  const SINGLE_LINE_THRESHOLD = 50;
  const indentation = ' '.repeat(level * 2);
  if (typeof obj === 'string') {
    return `"${obj}"`;
  }
  if (Array.isArray(obj)) {
    const short = `[${obj.map(objectToCode).join(', ')}]`;
    if (short.length < SINGLE_LINE_THRESHOLD && !short.includes('\n'))
      return short;
    return `[\n${obj
      .map(value => `${indentation}  ${objectToCode(value, level + 1)}`)
      .join(',\n')}\n${indentation}]`;
  }
  if (typeof obj === 'object' && obj !== null) {
    if (Object.keys(obj).length === 0) return '{}';
    const entries = Object.entries(obj).map(([key, value]) => {
      // Check if the key is a valid identifier
      const isValidIdentifier = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(key);
      const formattedKey = isValidIdentifier ? key : `"${key}"`;
      return `${formattedKey}: ${objectToCode(value, level + 1)}`;
    });
    const short = `{ ${entries.join(', ')} }`;
    if (short.length < SINGLE_LINE_THRESHOLD && !short.includes('\n'))
      return short;
    return `{\n${entries
      .map(entry => `${indentation}  ${entry}`)
      .join(',\n')}\n${indentation}}`;
  }
  if (obj === null) {
    return 'null';
  }
  if (typeof obj === 'undefined') {
    return 'undefined';
  }
  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }
  return String(obj);
}

export function configEditorTitle(kind: ConfigEditorConfig['kind']): string {
  return mapEnum(kind, {
    holidays: 'Holidays',
    'special-days': 'Special days',
    vacations: 'Vacations',
    rotations: 'rotations',
    'call-targets': 'Call targets',
    people: 'People',
    shifts: 'Shifts',
    'backup-shifts': 'Backup shifts',
    'shift-configs': 'Shift configs',
    'backup-shift-configs': 'Backup shift configs',
  });
}

export function ConfigEditorDialog() {
  const configEditor = useConfigEditor();
  const [data, setData] = useData();
  const config = configEditor.config;
  const [currentValue, setCurrentValue] = useState<undefined | string>(
    undefined,
  );

  const title = configEditorTitle(config.kind).toLowerCase();

  function getDefaultValue(
    data: CallSchedule,
    config: ConfigEditorConfig,
  ): string {
    return `${getEditorTypeForKind(config.kind, data)}
const result: Result = ${objectToCode(getDefaultObject(data, config))}`;
  }

  function getDefaultObject(
    data: CallSchedule,
    config: ConfigEditorConfig,
  ): unknown {
    switch (config.kind) {
      case 'holidays':
        return data.holidays;
      case 'special-days':
        return data.specialDays;
      case 'vacations':
        return data.vacations;
      case 'rotations':
        return data.rotations;
      case 'call-targets':
        return data.callTargets;
      case 'people':
        return data.people;
      case 'shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              return day.shifts;
            }
          }
        }
        throw new Error(`Cannot find shifts for day ${config.day}`);
      case 'backup-shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              return day.backupShifts;
            }
          }
        }
        throw new Error(`Cannot find chief shifts for day ${config.day}`);
      case 'shift-configs':
        return data.shiftConfigs;
      case 'backup-shift-configs':
        return data.chiefShiftConfigs;
    }
  }

  function updateData(
    data: CallSchedule,
    config: ConfigEditorConfig,
    newValue: string,
  ): CallSchedule {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      `const result = ${
        newValue.split(`const result: Result = `)[1]
      }; return result;`,
    ) as () => unknown;
    const value = fn();

    // NOTE: we don't assertX but do value as X below, because we will still run a full
    // check later on, and this way we can run validate first, which has better error messages.
    switch (config.kind) {
      case 'holidays':
        return {
          ...data,
          holidays: value as Holidays,
        };
      case 'special-days':
        return {
          ...data,
          specialDays: value as SpecialDays,
        };
      case 'vacations':
        return {
          ...data,
          vacations: value as VacationSchedule,
        };
      case 'rotations':
        return {
          ...data,
          rotations: value as RotationSchedule,
        };
      case 'call-targets':
        return {
          ...data,
          callTargets: value as CallTarget,
        };
      case 'people':
        return {
          ...data,
          people: value as PeopleConfig,
        };
      case 'shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              day.shifts = value as ShiftAssignment;
              return data;
            }
          }
        }
        throw new Error(`Cannot find shifts for day ${config.day}`);
      case 'backup-shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              day.shifts = value as ChiefShiftAssignment;
              return data;
            }
          }
        }
        throw new Error(`Cannot find backup shifts for day ${config.day}`);
      case 'shift-configs':
        return {
          ...data,
          shiftConfigs: value as ShiftConfigs,
        };
      case 'backup-shift-configs':
        return {
          ...data,
          chiefShiftConfigs: value as ChiefShiftConfigs,
        };
    }
  }

  function resetStateBeforeClose() {
    configEditor.setIsOpen(false);
    configEditor.setIsSubmitting(false);
    configEditor.setDialogContent('');
  }

  return (
    <Dialog
      open={configEditor.isOpen}
      fullScreen
      maxWidth="xl"
      // transitionDuration={{
      //   enter: 0,
      //   exit: 0,
      // }}
      onClose={() => configEditor.setIsOpen(false)}
    >
      <Dialog open={configEditor.dialogContent != ''}>
        <Column
          style={{
            padding: '20px',
          }}
        >
          <Text>{configEditor.dialogContent}</Text>
          <Button onClick={() => configEditor.setDialogContent('')}>
            Close
          </Button>
        </Column>
      </Dialog>
      <Column style={{ padding: '20px', maxWidth: '800px' }} spacing="10px">
        <Heading>Edit {title}</Heading>
        <Editor
          // onMount={async editor => {
          //   while (editor.getValue().startsWith('  ')) {
          //     await assertNonNull(editor.getAction('editor.action.formatDocument')).run();
          //     console.log('formatted');
          //     await sleep(100);
          //   }
          // }}
          options={{
            tabSize: 2,
            readOnly: configEditor.isSubmitting,
          }}
          height="70vh"
          defaultLanguage="typescript"
          defaultValue={getDefaultValue(data, config)}
          onChange={value => {
            if (value !== undefined) {
              setCurrentValue(value);
            }
          }}
        />
        <ElementSpacer />
        <Row
          style={{ marginTop: '10px' }}
          mainAxisAlignment="end"
          spacing="10px"
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              resetStateBeforeClose();
            }}
            disabled={configEditor.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={async () => {
              if (currentValue === undefined) {
                resetStateBeforeClose();
                configEditor.setCopyPasteSnackbar(
                  'No changes, so no need to save.',
                );
                return;
              }

              let newData: CallSchedule;
              try {
                newData = updateData(data, configEditor.config, currentValue);
                validateData(newData);
                assertCallSchedule(newData);
                processCallSchedule(newData);
              } catch (e) {
                console.log(e);
                configEditor.setDialogContent(
                  `The updated data is not valid: ${e}`,
                );
                return;
              }

              configEditor.setIsSubmitting(true);

              try {
                const result = await rpcSaveFullCallSchedules({
                  callSchedule: newData,
                  name: 'Config editor',
                });

                switch (result.kind) {
                  case 'was-edited':
                    configEditor.setDialogContent(
                      'Data was edited recently. Please remember your changes, and refresh the page.',
                    );
                    configEditor.setIsSubmitting(false);
                    return;
                  case 'ok':
                    setData(result.newData);
                    break;
                }

                resetStateBeforeClose();
                configEditor.setCopyPasteSnackbar('Changes saved.');
                configEditor.handleDialogResult('', false);
              } catch (e) {
                console.log(e);
                configEditor.setDialogContent(
                  'Some unexpected error occurred. Please try again. If this persists, please contact Stefan.',
                );
                configEditor.setIsSubmitting(false);
              }
            }}
            disabled={configEditor.isSubmitting}
          >
            {configEditor.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </Row>
      </Column>
    </Dialog>
  );
}
