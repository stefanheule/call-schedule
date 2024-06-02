module.exports = {
  apps: [
    {
      name: 'cs-client',
      script: 'yarn client start',
    },
    {
      name: 'cs-server-private',
      script: 'yarn server start-private',
    },
    {
      name: 'cs-server-public',
      script: 'yarn server start-public',
    },
    {
      name: 'cs-codegen',
      script: 'yarn codegen-watch',
    },
  ],
};
