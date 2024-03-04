module.exports = {
  apps: [
    {
      name: 'pm-server-public',
      script: 'IS_PROD=yes node server/build/server-public.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'pm-server-private',
      script: 'IS_PROD=yes node server/build/server-private.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
