module.exports = {
  apps: [
    {
      name: 'cs-client',
      script: 'yarn client start',
    },
    {
      name: 'cs-server',
      script: 'yarn server start',
    },
    {
      name: 'cs-codegen',
      script: 'yarn codegen-watch',
    },
  ],
};
