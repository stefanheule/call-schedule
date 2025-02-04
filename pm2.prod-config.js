module.exports = {
  apps: [
    {
      name: 'cs-server-public',
      script:
        'IS_PROD=yes CALL_SCHEDULE_PUBLIC=yes node -r tsconfig-paths/register build/server-private.js',
      cwd: './server',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        TS_NODE_PROJECT: './tsconfig.json',
      },
    },
    {
      name: 'cs-server-private',
      script:
        'IS_PROD=yes CALL_SCHEDULE_PUBLIC=no node -r tsconfig-paths/register build/server-private.js',
      cwd: './server',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        TS_NODE_PROJECT: './tsconfig.json',
      },
    },
  ],
};
