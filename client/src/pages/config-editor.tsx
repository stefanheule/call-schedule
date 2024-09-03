import { assertNonNull, mapEnum } from 'check-type';
import { createContext, useContext, useState } from 'react';
import { Children, Column, ElementSpacer, Row } from '../common/flex';
import { CallSchedule, MaybePerson } from '../shared/types';
import { useData } from './data-context';
import { Button, Dialog } from '@mui/material';
import { Heading } from '../common/text';
import Editor from '@monaco-editor/react';

export type ConfigEditorConfig = {
  kind: 'holidays';
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
  config: ConfigEditorConfig;
};

const ConfigEditorContext = createContext<ConfigEditorType | undefined>(
  undefined,
);

export function useConfigEditor(): ConfigEditorType {
  return assertNonNull(useContext(ConfigEditorContext));
}

export const ConfigEditorProvider = ({ children }: Children) => {
  const [isOpen, setIsOpen] = useState(true);
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

export function ConfigEditorDialog() {
  const configEditor = useConfigEditor();
  const [data, setData] = useData();
  const config = configEditor.config;

  const title = mapEnum(config.kind, {
    holidays: 'holidays',
  });

  function getDefaultValue(
    data: CallSchedule,
    config: ConfigEditorConfig,
  ): string {
    switch (config.kind) {
      case 'holidays':
        return `
const result = ${objectToCode(data.callTargets)}`;
    }
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
          }}
          height="70vh"
          defaultLanguage="typescript"
          defaultValue={`  ` + getDefaultValue(data, config)}
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
            onClick={() => configEditor.setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => configEditor.handleDialogResult('', false)}
          >
            Save
          </Button>
        </Row>
      </Column>
    </Dialog>
  );
}
