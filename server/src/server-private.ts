import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CLIENT_PORT, SERVER_PRIVATE_PORT } from './shared/ports';
import path from 'path';
import { setupExpressServer } from './common/express';
import { isLocal } from './common/error-reporting';

export const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

async function main() {
  await setupExpressServer({
    name: 'call-schedule-private',
    port: SERVER_PRIVATE_PORT,
    routeSetup: async app => {
      if (!isLocal()) {
        app.use(express.static(path.join(__dirname, '../../client/build')));
        app.get('*', (req, res) => {
          res.sendFile(
            path.resolve(__dirname, '../../client/build/index.html'),
          );
        });
      } else {
        app.use(
          '/*',
          createProxyMiddleware({
            // 127.0.0.1 instead of localhost is important,
            // because expo only listens on the IPv4 port.
            target: `http://127.0.0.1:${CLIENT_PORT}`,
            changeOrigin: true,
            ws: true,
          }),
        );
      }
    },
  });
}

void main();
