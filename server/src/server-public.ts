import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { SERVER_PUBLIC_PORT } from './shared/ports';
import { setupExpressServer } from './common/express';

export const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

async function main() {
  await setupExpressServer({
    name: `call-schedule-public`,
    port: SERVER_PUBLIC_PORT,
    routeSetup: async app => {},
  });
}

void main();
