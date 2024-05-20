import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CLIENT_PORT, SERVER_PRIVATE_PORT } from './shared/ports';
import path from 'path';
import { setupExpressServer } from './common/express';
import { isLocal } from './common/error-reporting';
import {
  ListCallSchedulesResponse,
  LoadCallScheduleResponse,
  SaveCallScheduleResponse,
  StoredCallSchedules,
} from './shared/types';
import {
  assertCallSchedule,
  assertLoadCallScheduleRequest,
  assertSaveCallScheduleRequest,
} from './shared/check-type.generated';
import { Request, Response } from 'express';
import { exceptionToString } from 'check-type';
import initialData from './shared/init.json';
import { scheduleToStoredSchedule } from './shared/compute';
import { loadStorage, storeStorage } from './storage';

export const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

async function main() {
  await setupExpressServer({
    name: 'call-schedule-private',
    port: SERVER_PRIVATE_PORT,
    routeSetup: async app => {
      app.post(
        '/api/load-call-schedule',
        async (
          req: Request,
          res: Response<LoadCallScheduleResponse | string>,
        ) => {
          try {
            const request = assertLoadCallScheduleRequest(req.body);
            const storage = loadStorage();
            if (request.ts) {
              const result = storage.versions.find(v => v.ts === request.ts);
              if (!result)
                throw new Error(`Cannot find version with ts ${request.ts}`);
              res.send(result.callSchedule);
            } else {
              if (storage.versions.length == 0) {
                res.send(assertCallSchedule(initialData));
                return;
              }
              res.send(
                storage.versions[storage.versions.length - 1].callSchedule,
              );
            }
            return;
          } catch (e) {
            console.log(e);
            res.status(500).send(`exception: ${exceptionToString(e)}`);
            return;
          }
        },
      );

      app.post(
        '/api/save-call-schedule',
        async (
          req: Request,
          res: Response<SaveCallScheduleResponse | string>,
        ) => {
          try {
            const request = assertSaveCallScheduleRequest(req.body);
            const storage = loadStorage();
            const nextVersion = scheduleToStoredSchedule(
              request.callSchedule,
              request.name,
            );
            const newStorage: StoredCallSchedules = {
              versions: [...storage.versions, nextVersion],
            };
            storeStorage(newStorage);
            res.send({ ts: nextVersion.ts });
          } catch (e) {
            console.log(e);
            res.status(500).send(`exception: ${exceptionToString(e)}`);
            return;
          }
        },
      );

      app.post(
        '/api/list-call-schedules',
        async (
          req: Request,
          res: Response<ListCallSchedulesResponse | string>,
        ) => {
          try {
            const storage = loadStorage();
            res.send({
              schedules: storage.versions.map(v => ({
                name: v.name,
                assignedShifts: v.assignedShifts,
                issueCounts: v.issueCounts,
                ts: v.ts,
              })),
            });
          } catch (e) {
            console.log(e);
            res.status(500).send(`exception: ${exceptionToString(e)}`);
            return;
          }
        },
      );

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
