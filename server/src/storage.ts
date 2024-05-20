import fs from 'fs';
import path from 'path';
import { isLocal } from './common/error-reporting';
import { StoredCallSchedules } from './shared/types';
import { assertStoredCallSchedules } from './shared/check-type.generated';

export let STORAGE_LOCATION = 'storage.json';
if (isLocal()) {
  STORAGE_LOCATION = path.resolve(`${__dirname}/../../storage.json`);
}

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
