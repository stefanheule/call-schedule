import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { SERVER_PUBLIC_PORT } from './shared/ports';
import { setupExpressServer } from './common/express';
import { axiosPost } from './shared/common/axios';
import { exceptionToString } from 'check-type';
import { isLocal } from './common/error-reporting';

const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

async function main() {
  await setupExpressServer({
    name: `purplemoon-public`,
    port: SERVER_PUBLIC_PORT,
    routeSetup: async app => {
      setInterval(async () => {
        try {
          if (!isLocal()) {
            await axiosPost(
              `http://10.0.0.2:1880/heartbeat`,
              {
                id: `purplemoon-public`,
                autoconfig: {
                  alert_if_missing_for: '5m',
                },
              },
              { ...AXIOS_PROPS, noLog: true },
            );
          }
        } catch (e) {
          console.log(`Failed to send heartbeat: ${exceptionToString(e)}`);
        }
      }, 1000 * 60);
    },
  });
}

void main();
