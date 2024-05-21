module.exports = {
  apps: [
    {
      name: 'cs-client',
      script: 'yarn client start',
    },
    {
      name: 'CALL_SCHEDULE_PUBLIC=no cs-server',
      script: 'yarn server start',
    },
    {
      name: 'cs-codegen',
      script: 'yarn codegen-watch',
    },
  ],
};
