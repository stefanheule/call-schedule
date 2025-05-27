import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import * as diff from 'diff';
import { assertNonNull, deepCopy, deparseIsoDatetime, exceptionToString } from './shared/common/check-type';
import express, { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { isLocal } from './common/error-reporting';
import { setupExpressServer } from './common/express';
import {
  assertCallSchedule,
  assertGetDayHistoryRequest,
  assertGetDiffRequest,
  assertIsoDate,
  assertListCallSchedulesRequest,
  assertLoadCallScheduleRequest,
  assertRestorePreviousVersionRequest,
  assertSaveCallScheduleRequest,
} from './shared/check-type.generated';
import {
  applyActions,
  compareData,
  dateToDayOfWeek,
  findDay,
  processCallSchedule,
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
  CallSchedule,
  getAcademicYearFromIsoDate,
  GetDayHistoryResponse,
  GetDiffResponse,
  ListCallSchedulesResponse,
  LoadCallScheduleResponse,
  RestorePreviousVersionResponse,
  SaveCallScheduleResponse,
  SaveFullCallScheduleResponse,
  StoredCallSchedule,
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
  '24': [STEFAN, "lisazhang0928@hotmail.com", "dibo900@gmail.com", "tovalweiss@gmail.com", "chloe92@gmail.com", "dcarson16@gmail.com"],
  '25': [STEFAN, "dcarson16@gmail.com", "arashamighi@gmail.com", "alexandra.c.jacobs@gmail.com"],
}
const ADMIN_CHIEF_EMAILS: Record<AcademicYear, { from: string, emails: string[] }[]> = {
  '24': [
    { from: '2025-05-09', emails: ['tovalweiss@gmail.com'] },
  ],
  '25': [],
}
const HAS_EDIT_CONFIG_ACCESS = [
  'local',
  STEFAN,
  "lisazhang0928@hotmail.com",
  "dcarson16@gmail.com",
]
const HAS_CREATE_SCHEDULE_ACCESS = [
  'local',
  STEFAN,
  "lisazhang0928@hotmail.com",
  "dcarson16@gmail.com",
]
const PUBLICLY_VISIBLE_YEARS: AcademicYear[] = ['24', '25'];


function getAcademicYearsForUser(user: string): readonly AcademicYear[] {
  if (user === STEFAN || user === 'local') {
    return ALL_ACADEMIC_YEARS;
  }
  return ALL_ACADEMIC_YEARS.filter(year => CHIEF_EMAILS[year].includes(user));
}

function getAdminChiefEmails(): string[] | undefined {
  const today = dateToIsoDate(new Date());
  for (const academicYear of ALL_ACADEMIC_YEARS) {
    const start = assertIsoDate(`20${academicYear}-07-01`);
    const end = assertIsoDate(`20${parseInt(academicYear) + 1}-06-30`);
    if (today >= start && today <= end) {
      const config = ADMIN_CHIEF_EMAILS[academicYear];
      for (const item of config) {
        if (today >= item.from) {
          return item.emails;
        }
      }
    }
  }
  return undefined;
}

export const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: false,
};

const IS_PUBLIC = process.env['CALL_SCHEDULE_PUBLIC'] === 'yes';
console.log(`IS_PUBLIC: ${IS_PUBLIC}`);

function fullTextDiffLastTwo(storage: StoredCallSchedules): string {
  const before = storage.versions[storage.versions.length - 2];
  const after = storage.versions[storage.versions.length - 1];
  return fullTextDiff(before.callSchedule, after.callSchedule).fullDiff;
}

function fullTextDiff(before: CallSchedule, after: CallSchedule): {
  fullDiff: string;
  shortDiff: string;
} {
  if (before === undefined || after === undefined) {
    return {
      fullDiff: 'n/a',
      shortDiff: 'n/a',
    };
  }
  try {
    let nShiftChanges = 0;
    let nAssignmentChanges = 0;
    const people = new Set<string>();
    const days = new Set<string>();
    const shortDiff: string[] = [];
    const diffs: { title: string, diff: string }[] = [];
    // Compare schedule
    {
      const assignedStr = (assigned: string) => assigned !== '' ? `assigned to ${assigned}` : 'unassigned';
      const shortAssignedStr = (assigned: string) => assigned !== '' ? `${assigned}` : 'unassigned';
      const changes: string[] = [];
      for (const [weekIndex, weekBefore] of before.weeks.entries()) {
        const weekAfter = after.weeks[weekIndex];
        for (const [dayIndex, dayBefore] of weekBefore.days.entries()) {
          const dayAfter = weekAfter.days[dayIndex];
          const compareShifts = (a: Record<string, string>, b: Record<string, string>) => {
            const shiftsBefore = Object.keys(a);
            const shiftsAfter = Object.keys(b);
            const shiftsOnlyInBefore = shiftsBefore.filter(s => !shiftsAfter.includes(s));
            const shiftsOnlyInAfter = shiftsAfter.filter(s => !shiftsBefore.includes(s));
            const commonShifts = shiftsBefore.filter(s => shiftsAfter.includes(s));
            const dayStr = `${dayBefore.date} (${dateToDayOfWeek(dayBefore.date)})`;
            for (const shift of shiftsOnlyInBefore) {
              changes.push(`${dayStr}: deleted shift '${shift}' (${assignedStr(a[shift])})`);
              nShiftChanges++;
            }
            for (const shift of shiftsOnlyInAfter) {
              changes.push(`${dayStr}: added shift '${shift}' (${assignedStr(b[shift])})`);
              nShiftChanges++;
            }
            for (const shift of commonShifts) {
              if (a[shift] !== b[shift]) {
                changes.push(`${dayStr}: ${shift}: ${shortAssignedStr(a[shift])} -> ${shortAssignedStr(b[shift])}`);
                nAssignmentChanges++;
                people.add(a[shift]);
                people.add(b[shift]);
                days.add(dayBefore.date);
              }
            }
          }
          compareShifts(dayBefore.shifts, dayAfter.shifts);
          compareShifts(dayBefore.backupShifts, dayAfter.backupShifts);
        }
      }
      if (changes.length > 0) {
        diffs.push({ title: `Schedule changes`, diff: changes.join('\n') });
      }
      if (nShiftChanges > 0) {
        shortDiff.push(`${nShiftChanges} shift changes`);
      }
      if (nAssignmentChanges > 0) {
        const details = [];
        const peopleList = Array.from(people).filter(p => p !== '').sort();
        const daysList = Array.from(days).sort();
        if (peopleList.length <= 4) {
          details.push(` for ${peopleList.join('/')}`);
        }
        if (daysList.length <= 4) {
          details.push(` on ${daysList.join('/')}`);
        } 
        shortDiff.push(`${nAssignmentChanges} assignment changes${details.join('')}`);
      }
    }
    // Compare configs
    const configFields = ['shiftConfigs', 'chiefShiftConfigs', 'callTargets', 'people', 'holidays', 'specialDays', 'vacations', 'rotations'] as const;
    for (const field of configFields) {
      const beforeValue = JSON.stringify(before[field], null, 2);
      const afterValue = JSON.stringify(after[field], null, 2);
      if (beforeValue !== afterValue) {
        shortDiff.push(`${field} changed`)
        const patch = diff.createTwoFilesPatch(
          `${field} (before)`,
          `${field} (after)`,
          beforeValue,
          afterValue,
          '',
          '',
          { context: 6 }
        ).split('\n').slice(4).join('\n');
        diffs.push({ title: `Config (${field}) changes`, diff: patch });
      }
    }
    if (diffs.length === 0) {
      return {
        fullDiff: 'No changes',
        shortDiff: 'No changes',
      };
    }
    return {
      fullDiff: diffs.map(d => `${d.title}
---------------------------------------------------------
${d.diff}`).join('\n\n'),
      shortDiff: shortDiff.join(', '),
    };
  } catch (e) {
    console.log(e);
    return {
      fullDiff: 'Error',
      shortDiff: 'Error',
    };
  }
}

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
          // Pick the first public year that has started
          const options = PUBLICLY_VISIBLE_YEARS.map(year => ({ year, firstDay: assertIsoDate(`20${year}-07-01`) }));
          options.sort((a, b) => a.firstDay.localeCompare(b.firstDay));
          for (const option of options) {
            if (dateToIsoDate(new Date()) >= option.firstDay) {
              res.redirect(`/${option.year}`);
              return;
            }
          }
          res.redirect(`/24`);
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
              result.callSchedule.viewingPreviousVersionFromTs = request.currentTs;
            } else {
              if (storage.versions.length == 0) {
                throw new Error(`No versions found`);
              }
              result = storage.versions[storage.versions.length - 1];
              result.callSchedule.viewingPreviousVersionFromTs = undefined;
            }

            result.callSchedule.isPublic = IS_PUBLIC;
            result.callSchedule.kind = 'call-schedule';

            // This shouldn't be necessary, but somehow it is?!
            // result.callSchedule.lastEditedAt = result.ts;
            
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
            result.callSchedule.name = result.name;

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
              nextSchedule = deepCopy(last);
              const diff = compareData(initial, edited);
              if (diff.kind === 'error') {
                res.status(500).send(`Failed to compare`);
                return;
              }
              console.log(diff.changes);
              console.log(initial.weeks[0].days[1].shifts);
              console.log(edited.weeks[0].days[1].shifts);
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

            await sendEmail({
              options: {
                to: ['stefanheule@gmail.com'],
                subject: `[call/${request.callSchedule.academicYear}] Save new version by ${authedUser}`,
                text: `Name: ${nextVersion.name}\n\n${fullTextDiffLastTwo(newStorage)}`,
              }
            });

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

            await sendEmail({
              options: {
                to: ['stefanheule@gmail.com'],
                subject: `[call/${request.callSchedule.academicYear}] Save new full version by ${authedUser}`,
                text: `Name: ${nextVersion.name}\n\n${fullTextDiffLastTwo(newStorage)}`,
              }
            });

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

            function canRestore(v: StoredCallSchedule): boolean {
              try {
                assertCallSchedule(v.callSchedule);
                processCallSchedule(v.callSchedule);
                validateData(v.callSchedule);
                return true;
              } catch (e) {
                return false;
              }
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.academicYear,
            });
            const chunkSize = 20;
            const schedules: ListCallSchedulesResponse['schedules'] = await Promise.all(
              Array.from({ length: Math.ceil(storage.versions.length / chunkSize) }, (_, i) =>
                Promise.all(
                  storage.versions.slice(i * chunkSize, (i + 1) * chunkSize).map(async (v, index) => {
                    const actualIndex = i * chunkSize + index;
                    return ({
                      name: v.name,
                      shortDiff: fullTextDiff(storage.versions[actualIndex - 1]?.callSchedule, storage.versions[actualIndex]?.callSchedule).shortDiff,
                      lastEditedBy: v.callSchedule.lastEditedBy,
                      shiftCounts: v.shiftCounts,
                      issueCounts: v.issueCounts,
                      backupShiftCounts: v.backupShiftCounts,
                      ts: v.ts,
                      canRestore: await Promise.resolve(canRestore(v)),
                    })
                  })
                )
              )
            ).then(chunks => chunks.flat());
            res.send({
              schedules,
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

      app.post(
        '/api/get-diff',
        async (
          req: Request,
          res: Response<GetDiffResponse | string>,
        ) => {
          try {
            if (IS_PUBLIC) {
              res.status(500).send(`Cannot get diff on public server`);
              return;
            }
            const request = assertGetDiffRequest(req.body);

            const user = extractAuthedUser(req);
            if (!getAcademicYearsForUser(user).includes(request.academicYear)) {
              res.status(403).send(`Forbidden`);
              return;
            }

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.academicYear,
            });
            const before = storage.versions.find(v => v.ts === request.beforeTs);
            const after = storage.versions.find(v => v.ts === request.afterTs);
            if (!before || !after) {
              res.send({ kind: 'not-found' });
              return;
            }
            const diff = fullTextDiff(before.callSchedule, after.callSchedule);
            const result: GetDiffResponse = {
              kind: 'ok',
              diff: `Summary: ${diff.shortDiff}\n\n${diff.fullDiff}`,
            };
            res.send(result);
          } catch (e) {
            console.log(e);
            res.status(500).send(`exception: ${exceptionToString(e)}`);
            return;
          }
        },
      );

      app.post(
        '/api/restore-previous-version',
        async (
          req: Request,
          res: Response<RestorePreviousVersionResponse | string>,
        ) => {
          try {
            if (IS_PUBLIC) {
              res.status(500).send(`Cannot restore version on public server`);
              return;
            }
            const request = assertRestorePreviousVersionRequest(req.body);

            const storage = loadStorage({
              noCheck: true,
              academicYear: request.academicYear,
            });
            const versionToRestore = storage.versions.find(v => v.ts === request.versionToRestore)
            const currentVersionToReplace = storage.versions[storage.versions.length - 1];
            if (currentVersionToReplace.ts !== request.currentVersionToReplace) {
              res.send({ kind: 'not-latest' });
              return;
            }
            if (!versionToRestore) {
              res.send({ kind: 'not-found' });
              return;
            }
            const authedUser = extractAuthedUser(req);
            const newStorage: StoredCallSchedules = {
              versions: [
                ...storage.versions,
                scheduleToStoredSchedule(
                  versionToRestore.callSchedule,
                  `Restored version from ${deparseIsoDatetime(versionToRestore.ts)} [${versionToRestore.name}]`,
                  isLocal() ? '<local>' : authedUser,
                ),
              ],
              academicYear: request.academicYear,
            };

            await sendEmail({
              options: {
                to: ['stefanheule@gmail.com'],
                subject: `[call/${request.academicYear}] Restored previous version by ${authedUser}`,
                text: `Name: ${newStorage.versions[newStorage.versions.length - 1].name}\n\n${fullTextDiffLastTwo(newStorage)}`,
              }
            });

            storeStorage(newStorage);
            res.send({ kind: 'ok', data: newStorage.versions[newStorage.versions.length - 1].callSchedule });
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
                const adminChiefEmails = getAdminChiefEmails();
                const titlePrefix = adminChiefEmails === undefined ? '[ADMIN CHIEF IS NOT CONFIGURED!!] ' : '';
                const emailNotifications = ['stefanheule@gmail.com', ...(adminChiefEmails ?? [])]
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
                    const title = `${titlePrefix}[Manual action required] Approved trades from Amion could not be applied automatically`;
                    const message = `Below are some technical details of how exactly what trades were approved and what errors occurred. Feel free to ignore; these are mostly for Stefan.

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
                    const title = `${titlePrefix}Approved trades from Amion were applied successfully`;
                    const message = `Below are some technical details of how exactly what changes were applied. Feel free to ignore; these are mostly for Stefan.

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
