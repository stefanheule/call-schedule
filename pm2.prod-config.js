const path = require('path');

module.exports = {
  apps: [
    {
      name: 'cs-server-public',
      script:
        'IS_PROD=yes CALL_SCHEDULE_PUBLIC=yes node -r tsconfig-paths/register server/build/server-private.js',
      cwd: path.resolve(__dirname, 'server'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        TS_NODE_PROJECT: path.resolve(__dirname, 'server/tsconfig.json'),
        NODE_PATH: path.resolve(__dirname, 'server/build'),
      },
    },
    {
      name: 'cs-server-private',
      script:
        'IS_PROD=yes CALL_SCHEDULE_PUBLIC=no node -r tsconfig-paths/register server/build/server-private.js',
      cwd: path.resolve(__dirname, 'server'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        TS_NODE_PROJECT: path.resolve(__dirname, 'server/tsconfig.json'),
        NODE_PATH: path.resolve(__dirname, 'server/build'),
      },
    },
  ],
};
