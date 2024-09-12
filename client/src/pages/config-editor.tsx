import { assertNonNull, IsoDate, mapEnum } from 'check-type';
import { createContext, useContext, useState } from 'react';
import { Children, Column, ElementSpacer, Row } from '../common/flex';
import { CallSchedule, EDITOR_TYPES, MaybePerson } from '../shared/types';
import { useData } from './data-context';
import { Button, Dialog, IconButton, Snackbar } from '@mui/material';
import { Heading } from '../common/text';
import Editor from '@monaco-editor/react';
import CloseIcon from '@mui/icons-material/Close';
import { rpcSaveFullCallSchedules } from './rpc';
import {
  assertCallTarget,
  assertChiefShiftAssignment,
  assertChiefShiftConfigs,
  assertHolidays,
  assertPeopleConfig,
  assertRotationSchedule,
  assertShiftAssignment,
  assertShiftConfigs,
  assertSpecialDays,
  assertVacationSchedule,
} from '../shared/check-type.generated';

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
  snackbar: string;
  setSnackbar: (message: string) => void;
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
        if (requirement == 'Person') {
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
        } else if (requirement == 'ShiftKind') {
          result.push({
            name: requirement,
            definition: optionsToUnion(Object.keys(data.shiftConfigs)),
          });
        } else if (requirement == 'BackupShiftKind') {
          result.push({
            name: requirement,
            definition: optionsToUnion(Object.keys(data.chiefShiftConfigs)),
          });
        } else {
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
  const [snackbar, setSnackbar] = useState('');
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
        snackbar,
        setSnackbar,
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
    const fn = new Function(`${newValue}; return result;`) as () => unknown;
    const value = fn();
    switch (config.kind) {
      case 'holidays':
        return {
          ...data,
          holidays: assertHolidays(value),
        };
      case 'special-days':
        return {
          ...data,
          specialDays: assertSpecialDays(value),
        };
      case 'vacations':
        return {
          ...data,
          vacations: assertVacationSchedule(value),
        };
      case 'rotations':
        return {
          ...data,
          rotations: assertRotationSchedule(value),
        };
      case 'call-targets':
        return {
          ...data,
          callTargets: assertCallTarget(value),
        };
      case 'people':
        return {
          ...data,
          people: assertPeopleConfig(value),
        };
      case 'shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              day.shifts = assertShiftAssignment(value);
              return data;
            }
          }
        }
        throw new Error(`Cannot find shifts for day ${config.day}`);
      case 'backup-shifts':
        for (const week of data.weeks) {
          for (const day of week.days) {
            if (day.date === config.day) {
              day.shifts = assertChiefShiftAssignment(value);
              return data;
            }
          }
        }
        throw new Error(`Cannot find backup shifts for day ${config.day}`);
      case 'shift-configs':
        return {
          ...data,
          shiftConfigs: assertShiftConfigs(value),
        };
      case 'backup-shift-configs':
        return {
          ...data,
          chiefShiftConfigs: assertChiefShiftConfigs(value),
        };
    }
  }

  function resetStateBeforeClose() {
    configEditor.setIsOpen(false);
    configEditor.setIsSubmitting(false);
    configEditor.setSnackbar('');
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
      <Snackbar
        open={configEditor.snackbar != ''}
        onClose={() => configEditor.setSnackbar('')}
        message={configEditor.snackbar}
        autoHideDuration={5000}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            sx={{ p: 0.5 }}
            onClick={() => configEditor.setSnackbar('')}
          >
            <CloseIcon />
          </IconButton>
        }
      />
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
              configEditor.setIsSubmitting(true);

              try {
                const newData = updateData(
                  data,
                  configEditor.config,
                  currentValue,
                );
                const result = await rpcSaveFullCallSchedules({
                  callSchedule: newData,
                  name: 'Config editor',
                });

                switch (result.kind) {
                  case 'was-edited':
                    configEditor.setSnackbar(
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
                configEditor.setSnackbar(
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
