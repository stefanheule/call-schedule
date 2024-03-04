module.exports = {
  apps: [
    {
      name: 'pm-client',
      script: 'yarn client start',
    },
    {
      name: 'pm-server',
      script: 'yarn server start',
    },
    {
      name: 'pm-codegen',
      script: 'yarn codegen-watch',
    },
  ],
};
