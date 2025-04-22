import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { assertNonNull, exceptionToString } from './shared/common/check-type';
import express, { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { isLocal } from './common/error-reporting';
import { setupExpressServer } from './common/express';
import {
  assertCallSchedule,
  assertGetDayHistoryRequest,
  assertListCallSchedulesRequest,
  assertLoadCallScheduleRequest,
  assertSaveCallScheduleRequest,
} from './shared/check-type.generated';
import {
  applyActions,
  compareData,
  findDay,
  scheduleToStoredSchedule,
} from './shared/compute';
import {
  CLIENT_PORT,
  SERVER_PRIVATE_PORT,
  SERVER_PUBLIC_PORT,
} from './shared/ports';
import {
  AcademicYear,
  Action,
  ALL_ACADEMIC_YEARS,
  getAcademicYearFromIsoDate,
  GetDayHistoryResponse,
  ListCallSchedulesResponse,
  LoadCallScheduleResponse,
  SaveCallScheduleResponse,
  SaveFullCallScheduleResponse,
  StoredCallSchedules,
} from './shared/types';
import { loadStorage, storeStorage } from './storage';
import * as cookie from 'cookie';
import { validateData } from './shared/validate';
import { assertApplyAmionChangeRequest } from './check-type.generated';
import {
  ApplyAmionChangeResponse,
  parseAmionEmails,
  summarizeEmailParseResults,
  TERRA_AUTH_ENV_VARIABLE,
} from './parse-amion-email';
import { sendPushoverMessage } from './common/notifications';
import deepEqual from 'deep-equal';
import { sendEmail } from './common/email-rpc';
import { dateToIsoDate } from './shared/optimized';

// NEWYEAR: add chiefs here
const STEFAN = 'stefanheule@gmail.com';
const CHIEF_EMAILS: Record<AcademicYear, string[]> = {
  '24': [STEFAN, "lisazhang0928@hotmail.com", "dibo900@gmail.com", "tovalweiss@gmail.com", "chloe92@gmail.com"],
  '25': [STEFAN, "dcarson16@gmail.com", "arashamighi@gmail.com", "alexandra.c.jacobs@gmail.com"],
}
const HAS_EDIT_CONFIG_ACCESS = [
  'local',
  STEFAN,
  "lisazhang0928@hotmail.com",
  // "dcarson16@gmail.com",
]
const HAS_CREATE_SCHEDULE_ACCESS = [
  'local',
  STEFAN,
  "lisazhang0928@hotmail.com",
  // "dcarson16@gmail.com",
]
const MAIN_PUBLIC_VERSION: AcademicYear = '24';
const PUBLICLY_VISIBLE_YEARS: AcademicYear[] = ['24'];


function getAcademicYearsForUser(user: string): readonly AcademicYear[] {
  if (user === STEFAN || user === 'local') {
    return ALL_ACADEMIC_YEARS;
  }
  return ALL_ACADEMIC_YEARS.filter(year => CHIEF_EMAILS[year].includes(user));
}

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
      app.get('/', async (req, res) => {

        if (!IS_PUBLIC) {
          const user = extractAuthedUser(req);
          if (user === STEFAN || user === 'local') {
            res.redirect('/25');
            return;
          }
          const years = getAcademicYearsForUser(user);
          if (years.length === 0) {
            res.status(403).send(`Forbidden`);
            return;
          }
          res.redirect(`/${years[years.length - 1]}`);
        } else {
          res.redirect(`/${MAIN_PUBLIC_VERSION}`);
        }
        return;
      });

      app.post(
        '/api/load-call-schedule',
        async (
          req: Request,
          res: Response<LoadCallScheduleResponse | string>,
        ) => {
          try {
            const request = assertLoadCallScheduleRequest(req.body);
            const storage = loadStorage({ noCheck: true, academicYear: request.academicYear });

            if (IS_PUBLIC && !PUBLICLY_VISIBLE_YEARS.includes(request.academicYear)) {
              const result: LoadCallScheduleResponse = {
                kind: 'not-available',
              }
              res.status(200).send(result);
              return;
            }

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
            
            const user = extractAuthedUser(req);
            if (!IS_PUBLIC) {
              if (!getAcademicYearsForUser(user).includes(request.academicYear)) {
                res.status(403).send(`Forbidden`);
                return;
              }
            }

            result.callSchedule.currentUser = user;

            result.callSchedule.isPubliclyVisible = PUBLICLY_VISIBLE_YEARS.includes(request.academicYear);
            result.callSchedule.menuItems = IS_PUBLIC ? PUBLICLY_VISIBLE_YEARS.map(year => ({ year })) : getAcademicYearsForUser(user).map(year => ({ year }));

            result.callSchedule.academicYear = request.academicYear;
            result.callSchedule.hasEditConfigAccess = HAS_EDIT_CONFIG_ACCESS.includes(user);
            result.callSchedule.hasCreateScheduleAccess = HAS_CREATE_SCHEDULE_ACCESS.includes(user);

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

            const user = extractAuthedUser(req);
            if (!getAcademicYearsForUser(user).includes(request.callSchedule.academicYear ?? 'foo' as unknown as AcademicYear)) {
              res.status(403).send(`Forbidden`);
              return;
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.callSchedule.academicYear,
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
              academicYear: request.callSchedule.academicYear,
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

            const user = extractAuthedUser(req);
            if (!getAcademicYearsForUser(user).includes(request.callSchedule.academicYear ?? 'foo' as unknown as AcademicYear)) {
              res.status(403).send(`Forbidden`);
              return;
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.callSchedule.academicYear,
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
              academicYear: request.callSchedule.academicYear,
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
            const request = assertListCallSchedulesRequest(req.body);

            const user = extractAuthedUser(req);
            if (!getAcademicYearsForUser(user).includes(request.academicYear)) {
              res.status(403).send(`Forbidden`);
              return;
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.academicYear,
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

      app.post(
        '/api/get-day-history',
        async (
          req: Request,
          res: Response<GetDayHistoryResponse | string>,
        ) => {
          try {
            if (IS_PUBLIC) {
              res.status(500).send(`Cannot get history on public server`);
              return;
            }
            const request = assertGetDayHistoryRequest(req.body);

            const user = extractAuthedUser(req);
            if (!getAcademicYearsForUser(user).includes(request.academicYear)) {
              res.status(403).send(`Forbidden`);
              return;
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.academicYear,
            });
            const versions = [];
            for (const version of storage.versions) {
              let skip = false;
              try {
                assertCallSchedule(version.callSchedule);
              } catch (e) {
                skip = true;
              }
              if (skip) {
                continue;
              }
              versions.push(version);
            }
            if (versions.length === 0) {
              const result: GetDayHistoryResponse = { 
                items: [],
              };
              res.send(result);
              return;
            }
            const result: GetDayHistoryResponse = {
              items: [{
                ts: versions[0].ts,
                changeName: versions[0].name,
                day: assertNonNull(findDay(versions[0].callSchedule, request.day)),
                isCurrent: versions.length === 1,
                isInitial: true,
              }],
            };
            for (const version of versions.slice(1)) {
              let skip = false;
              try {
                assertCallSchedule(version.callSchedule);
              } catch (e) {
                skip = true;
              }
              if (skip) {
                continue;
              }
              const day = assertNonNull(findDay(version.callSchedule, request.day));
              if (deepEqual(day, result.items[result.items.length - 1].day)) {
                continue;
              }
              result.items.push({
                ts: version.ts,
                changeName: version.name,
                day,
                isCurrent: false,
                isInitial: false,
              });
            }
            result.items[result.items.length - 1].isCurrent = true;
            result.items.reverse();
            res.send(result);
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
                const emailNotifications = ['stefanheule@gmail.com', ...(dateToIsoDate(new Date()) <= '2025-06-30' ? ['tovalweiss@gmail.com'] : [])]
                const storage = loadStorage({
                  noCheck: true,
                  academicYear: getAcademicYearFromIsoDate(dateToIsoDate(new Date())),
                });
                const last = assertNonNull(
                  storage.versions[storage.versions.length - 1]?.callSchedule,
                );
                const parsed = parseAmionEmails(request.emails, last);
                console.log(`Parsed email result:`);
                const summary = summarizeEmailParseResults(parsed);
                console.log(summary);
                const hasError =
                  parsed.filter(
                    x =>
                      x.kind == 'error' ||
                      (x.kind == 'changes' &&
                        x.changes.filter(y => y.kind == 'error').length > 0),
                  ).length > 0;
                if (hasError) {
                  res.send({
                    kind: 'error',
                    message: `Parsing failed with at least 1 error.\n\n${summary}`,
                  });
                  if (request.initialTry && parsed.filter(x => x.kind !== 'ignored' && !x.isPending).length > 0) {
                    const title = `[Manual action required] Approved trades from Amion could not be applied automatically`;
                    const message = `Below are some technical details of how exactly what trades were approved and what errors occurred. Feel free to ignore.

---

${summary}`;
                    await sendPushoverMessage({
                      title,
                      message,
                    });
                    await sendEmail({
                      options: {
                        to: emailNotifications,
                        subject: title,
                        text: message,
                      }
                    });
                  }
                  return;
                } else {
                  let nextSchedule = last;
                  const actions: Action[] = [];
                  for (const item of parsed) {
                    switch (item.kind) {
                      case 'error':
                        throw new Error(`Should not have errors here`);
                        break;
                      case 'changes':
                        if (!item.isPending) {
                          for (const change of item.changes) {
                            switch (change.kind) {
                              case 'error':
                                throw new Error(`Should not have errors here`);
                              case 'action':
                                actions.push(change.action);
                                break;
                              case 'ignored':
                                break;
                            }
                          }
                        }
                        break;
                      case 'ignored':
                        break;
                    }
                  }
                  if (actions.length > 0) {
                    nextSchedule = applyActions(nextSchedule, actions);
                    const nextVersion = scheduleToStoredSchedule(
                      nextSchedule,
                      `Amion auto-applied change`,
                      `<system>`,
                    );
                    const newStorage: StoredCallSchedules = {
                      versions: [...storage.versions, nextVersion],
                      academicYear: nextVersion.callSchedule.academicYear,
                    };
                    storeStorage(newStorage);
                  }
                  const hasChanges =
                    parsed.filter(x => x.kind == 'changes' && !x.isPending).length > 0;
                  const shouldNotify = hasChanges;
                  if (shouldNotify) {
                    const title = `Approved trades from Amion were applied successfully`;
                    const message = `Below are some technical details of how exactly what changes were applied. Feel free to ignore.

---

${summary}`;
                    await sendPushoverMessage({
                      title,
                      message,
                    });
                    await sendEmail({
                      options: {
                        to: emailNotifications,
                        subject: title,
                        text: message,
                      }
                    });
                  }
                  res.send({ kind: 'ok' });
                  return;
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
          '/',
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
