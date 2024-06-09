import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  CLIENT_PORT,
  SERVER_PRIVATE_PORT,
  SERVER_PUBLIC_PORT,
} from './shared/ports';
import path from 'path';
import { setupExpressServer } from './common/express';
import { isLocal } from './common/error-reporting';
import {
  ChiefShiftKind,
  ListCallSchedulesResponse,
  LoadCallScheduleResponse,
  SaveCallScheduleResponse,
  ShiftKind,
  StoredCallSchedules,
} from './shared/types';
import {
  assertCallSchedule,
  assertLoadCallScheduleRequest,
  assertSaveCallScheduleRequest,
} from './shared/check-type.generated';
import { Request, Response } from 'express';
import { exceptionToString } from 'check-type';
import { scheduleToStoredSchedule } from './shared/compute';
import { loadStorage, storeStorage } from './storage';

export const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

const IS_PUBLIC = process.env['CALL_SCHEDULE_PUBLIC'] === 'yes';
console.log(`IS_PUBLIC: ${IS_PUBLIC}`);

async function main() {
  await setupExpressServer({
    name: IS_PUBLIC ? 'call-schedule-public' : 'call-schedule-private',
    port: IS_PUBLIC ? SERVER_PUBLIC_PORT : SERVER_PRIVATE_PORT,
    routeSetup: async app => {
      app.post(
        '/api/load-call-schedule',
        async (
          req: Request,
          res: Response<LoadCallScheduleResponse | string>,
        ) => {
          try {
            const request = assertLoadCallScheduleRequest(req.body);
            const storage = loadStorage({ noCheck: true });
            let result;
            if (request.ts) {
              result = storage.versions.find(v => v.ts === request.ts);
              if (!result)
                throw new Error(`Cannot find version with ts ${request.ts}`);
            } else {
              if (storage.versions.length == 0) {
                throw new Error(`No versions found`);
              }
              result = storage.versions[storage.versions.length - 1];
            }

            result.callSchedule.isPublic = IS_PUBLIC;
            res.send(assertCallSchedule(result.callSchedule));
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
            if (IS_PUBLIC) {
              res.status(500).send(`Cannot save on public server`);
              return;
            }
            const request = assertSaveCallScheduleRequest(req.body);
            const storage = loadStorage({
              noCheck: true,
            });
            const last =
              storage.versions[storage.versions.length - 1]?.callSchedule;
            let nextSchedule = request.callSchedule;
            if (request.initialCallSchedule && last) {
              const initial = request.initialCallSchedule;
              const edited = request.callSchedule;
              nextSchedule = last;
              nextSchedule.weeks.forEach((week, weekIndex) => {
                week.days.forEach((day, dayIndex) => {
                  // Copy over edited shifts
                  Object.keys(day.shifts).forEach(s => {
                    const shift = s as ShiftKind;
                    const editedPerson =
                      edited.weeks[weekIndex].days[dayIndex].shifts[shift];
                    if (
                      initial.weeks[weekIndex].days[dayIndex].shifts[shift] !==
                      editedPerson
                    ) {
                      day.shifts[shift] = editedPerson;
                    }
                  });

                  // Copy over edited backup shifts
                  Object.keys(day.backupShifts).forEach(s => {
                    const shift = s as ChiefShiftKind;
                    const editedPerson =
                      edited.weeks[weekIndex].days[dayIndex].backupShifts[
                        shift
                      ];
                    if (
                      initial.weeks[weekIndex].days[dayIndex].backupShifts[
                        shift
                      ] !== editedPerson
                    ) {
                      day.backupShifts[shift] = editedPerson;
                    }
                  });
                });
              });
            }
            const nextVersion = scheduleToStoredSchedule(
              nextSchedule,
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
                shiftCounts: v.shiftCounts,
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
