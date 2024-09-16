import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { assertNonNull, exceptionToString } from 'check-type';
import express, { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { isLocal } from './common/error-reporting';
import { setupExpressServer } from './common/express';
import {
  assertCallSchedule,
  assertLoadCallScheduleRequest,
  assertSaveCallScheduleRequest,
} from './shared/check-type.generated';
import {
  applyActions,
  compareData,
  scheduleToStoredSchedule,
} from './shared/compute';
import {
  CLIENT_PORT,
  SERVER_PRIVATE_PORT,
  SERVER_PUBLIC_PORT,
} from './shared/ports';
import {
  ListCallSchedulesResponse,
  LoadCallScheduleResponse,
  SaveCallScheduleResponse,
  SaveFullCallScheduleResponse,
  StoredCallSchedules,
} from './shared/types';
import { loadStorage, storeStorage } from './storage';
import cookie from 'cookie';
import { validateData } from './shared/validate';
import { assertApplyAmionChangeRequest } from './check-type.generated';
import {
  ApplyAmionChangeResponse,
  parseAmionEmail,
  TERRA_AUTH_ENV_VARIABLE,
} from './parse-amion-email';

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
            result.callSchedule.currentUser = extractAuthedUser(req);
            const checkedSchedule = assertCallSchedule(result.callSchedule);
            validateData(checkedSchedule);
            res.send(checkedSchedule);
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
              const diff = compareData(initial, edited);
              if (diff.kind === 'error') {
                res.status(500).send(`Failed to compare`);
                return;
              }
              applyActions(nextSchedule, diff.changes);
            }
            const authedUser = extractAuthedUser(req);
            const nextVersion = scheduleToStoredSchedule(
              nextSchedule,
              request.name,
              isLocal() ? '<local>' : authedUser,
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
        '/api/save-full-call-schedule',
        async (
          req: Request,
          res: Response<SaveFullCallScheduleResponse | string>,
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
            if (!last) {
              console.log('No last schedule found');
              res.status(500).send(`No last schedule found`);
              return;
            }
            if (last.lastEditedAt !== request.callSchedule.lastEditedAt) {
              console.log(
                'Last edited at does not match: ',
                last.lastEditedAt,
                request.callSchedule.lastEditedAt,
              );
              res.send({ kind: 'was-edited' });
              return;
            }
            const nextSchedule = request.callSchedule;
            const authedUser = extractAuthedUser(req);
            const nextVersion = scheduleToStoredSchedule(
              nextSchedule,
              request.name,
              isLocal() ? '<local>' : authedUser,
            );
            const newStorage: StoredCallSchedules = {
              versions: [...storage.versions, nextVersion],
            };
            storeStorage(newStorage);
            res.send({ kind: 'ok', newData: nextVersion.callSchedule });
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
            const storage = loadStorage({
              noCheck: true,
            });
            res.send({
              schedules: storage.versions.map(v => ({
                name: v.name,
                lastEditedBy: v.callSchedule.lastEditedBy,
                shiftCounts: v.shiftCounts,
                issueCounts: v.issueCounts,
                backupShiftCounts: v.backupShiftCounts,
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

      if (IS_PUBLIC) {
        app.post(
          '/api/apply-amion-change',
          async (
            req: Request,
            res: Response<ApplyAmionChangeResponse | string>,
          ) => {
            try {
              const request = assertApplyAmionChangeRequest(req.body);
              if (
                request.auth !=
                assertNonNull(
                  process.env[TERRA_AUTH_ENV_VARIABLE],
                  `$${TERRA_AUTH_ENV_VARIABLE} not set?`,
                )
              ) {
                res.status(200).send({
                  kind: 'error',
                  message: 'Invalid auth',
                });
                return;
              }

              try {
                const storage = loadStorage({
                  noCheck: true,
                });
                const last = assertNonNull(
                  storage.versions[storage.versions.length - 1]?.callSchedule,
                );
                const parsed = parseAmionEmail(request, last);
                console.log(`Parsed email result:`);
                console.log(parsed);
                if (parsed.kind === 'not-relevant') {
                  res.send({ kind: 'ok' });
                } else if (parsed.kind === 'changes') {
                  const nextSchedule = applyActions(last, parsed.changes);
                  const nextVersion = scheduleToStoredSchedule(
                    nextSchedule,
                    `Amion auto-applied change`,
                    `<system>`,
                  );
                  const newStorage: StoredCallSchedules = {
                    versions: [...storage.versions, nextVersion],
                  };
                  storeStorage(newStorage);
                }
              } catch (e) {
                console.log(e);
                res.send({
                  kind: 'error',
                  message: `${exceptionToString(e)}`,
                });
              }
            } catch (e) {
              console.log(e);
              res.status(500).send(`exception: ${exceptionToString(e)}`);
              return;
            }
          },
        );
      }

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

function extractAuthedUser(req: express.Request) {
  if (isLocal()) {
    return 'local';
  }
  const cookies = cookie.parse(req.headers.cookie || '');
  const data = cookies['_forward_auth'];
  if (data) {
    const parts = data.split('|');
    return parts[parts.length - 1];
  }
  return 'unknown';
}

void main();
