import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { globalSetup } from './common/error-reporting';

// eslint-disable-next-line unused-imports/no-unused-imports
import * as datefns from 'date-fns';
import { RepoConfig } from './common/scripts/deploy-util';

async function main() {
  await globalSetup();
  console.log('test');
}

void main();
