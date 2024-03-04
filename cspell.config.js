const vscode = require('./.vscode/settings.json');
const fs = require('fs');

const ignorePatterns = fs
  .readFileSync('.gitignore', 'utf8')
  .split(/[\n\r]/)
  .filter(line => line.length > 0 && !line.startsWith('#'));

module.exports = {
  words: vscode['cSpell.words'],
  ignorePaths: ignorePatterns.concat(['**/*.svg']),
};
