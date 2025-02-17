// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

import { includeIgnoreFile } from "@eslint/compat";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");

function configForTsProject(directory) {
  /** @type {import('typescript-eslint').InfiniteDepthConfigWithExtends} */
  const config = {
    ...includeIgnoreFile(gitignorePath),
    extends: [eslint.configs.recommended, tseslint.configs.recommendedTypeChecked],
    files: [`${directory}/**/*.{ts,tsx}`],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: `${import.meta.dirname}/${directory}`,
      },
    },
    plugins: {
      'unused-imports': unusedImportsPlugin,
      // @ts-ignore
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks: 'useAsync',
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      // Switch statements must be exhaustive
      '@typescript-eslint/switch-exhaustiveness-check': ['warn', {
        considerDefaultExhaustiveForUnions: true,
      }],
      // This disallows logging of arbitrary values with template expressions, which is unreasonable.
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Sometimes during development it's useful to mark a function async even if it doesn't (yet) call await.
      '@typescript-eslint/require-await': 'off',
      // Sometimes you do want an empty function.
      '@typescript-eslint/no-empty-function': 'off',
      // no-unused-vars doesn't provide a fix, but unused-imports does, so we use that.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      "unused-imports/no-unused-vars": [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          // Allow unused arguments.
          argsIgnorePattern: '.*',
          caughtErrorsIgnorePattern: '.*',
        },
      ],
      // If we suppress ts errors and state a reason, that's fine.
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-misused-promises': 'off',
    }
  }
  return config;
}

export default tseslint.config(
  configForTsProject('server'),
  configForTsProject('client'),
  {
    ...includeIgnoreFile(gitignorePath),
    extends: [tseslint.configs.disableTypeChecked],
    files: ['**/*.{js,mjs,cjs}'],
  },
);

