import fs from 'fs';
import path from 'path';
import { isLocal } from './common/error-reporting';
import { StoredCallSchedules } from './shared/types';
import { assertStoredCallSchedules } from './shared/check-type.generated';

export const STORAGE_LOCATION_LOCAL = path.resolve(
  `${__dirname}/../../data/storage/storage.json`,
);
export const STORAGE_LOCATION_REMOTE =
  '/home/stefan/www-live/call-schedule-data/storage/storage.json';
export const STORAGE_LOCATION = isLocal()
  ? STORAGE_LOCATION_LOCAL
  : STORAGE_LOCATION_REMOTE;

export function storeStorage(storage: StoredCallSchedules): void {
  fs.writeFileSync(STORAGE_LOCATION, JSON.stringify(storage, null, 2));
}

export function loadStorage(): StoredCallSchedules {
  if (!fs.existsSync(STORAGE_LOCATION)) {
    return {
      versions: [],
    };
  }
  return assertStoredCallSchedules(
    JSON.parse(fs.readFileSync(STORAGE_LOCATION, 'utf8')),
  );
}
