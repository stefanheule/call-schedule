module.exports = {
  apps: [
    {
      name: 'cs-server-public',
      script: 'IS_PROD=yes node server/build/server-public.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'cs-server-private',
      script: 'IS_PROD=yes node server/build/server-private.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
