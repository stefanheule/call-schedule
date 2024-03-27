const fs = require('fs');

const ignorePatterns = fs
  .readFileSync('.gitignore', 'utf8')
  .split(/[\n\r]/)
  .filter(line => line.length > 0 && !line.startsWith('#'));

module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  ignorePatterns: [
    // By default, eslint does not lint dot files. This negative ignore pattern changes that.
    '!.*',
    // Generated files
    '**/schema.json',
    'client/vite.config.ts',
  ].concat(ignorePatterns),
  extends: ['plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'unused-imports'],
  rules: {
    // Stronger check.
    'no-implicit-coercion': 'warn',
    // Make all errors warnings instead. Our infra disallows warnings,
    // so we'll have to fix warnings too, but this distinguishes things
    // that break the app (e.g. compiler errors) from syntactic inconsistencies
    // that can be safely ignored until opening a PR.
    'prettier/prettier': 'warn',
  },
  overrides: ['client', 'server'].map(directory => {
    return {
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        // React hooks must be used correctly.
        'plugin:react-hooks/recommended',
      ],
      files: [`${directory}/**/*.{ts,tsx}`],
      parserOptions: {
        tsconfigRootDir: `${__dirname}/${directory}`,
        project: ['./tsconfig.json'],
        ecmaFeatures: {
          jsx: true, // Allows for the parsing of JSX
        },
      },
      rules: {
        // Extend exhaustive deps checking to our custom hooks.
        'react-hooks/exhaustive-deps': [
          'warn',
          {
            additionalHooks: 'useAsync',
          },
        ],
        '@typescript-eslint/strict-boolean-expressions': 'off',
        // Switch statements must be exhaustive
        '@typescript-eslint/switch-exhaustiveness-check': 'warn',
        // This disallows logging of arbitrary values with template expressions, which is unreasonable.
        '@typescript-eslint/restrict-template-expressions': 'off',
        // Sometimes during development it's useful to mark a function async even if it doesn't (yet) call await.
        '@typescript-eslint/require-await': 'off',
        // Sometimes you do want an empty function.
        '@typescript-eslint/no-empty-function': 'off',
        // no-unused-vars doesn't provide a fix, but unused-imports does, so we use that.
        '@typescript-eslint/no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'warn',
        'unused-imports/no-unused-vars': [
          'warn',
          {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            // Allow unused arguments.
            argsIgnorePattern: '.*',
          },
        ],
        // If we suppress ts errors and state a reason, that's fine.
        '@typescript-eslint/ban-ts-comment': [
          'warn',
          { 'ts-expect-error': 'allow-with-description' },
        ],
        'no-throw-literal': 'off',
        '@typescript-eslint/no-throw-literal': ['error'],
        '@typescript-eslint/no-misused-promises': 'off',
      },
    };
  }),
};
