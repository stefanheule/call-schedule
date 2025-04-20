import fs from 'fs';
import { isLocal } from './common/error-reporting';
import { AcademicYear, DEFAULT_ACADEMIC_YEAR, getAcademicYear, StoredCallSchedules } from './shared/types';
import { assertStoredCallSchedules } from './shared/check-type.generated';

function getStorageLocation(academicYear?: AcademicYear): string {
  academicYear = getAcademicYear(academicYear);
  const suffix = academicYear === DEFAULT_ACADEMIC_YEAR ? '' : `-${academicYear}`;
  return isLocal()
    ? `${__dirname}/../../data/storage/storage${suffix}.json`
    : `/home/stefan/www-live/call-schedule-data/storage/storage${suffix}.json`;
}

export function storeStorage(storage: StoredCallSchedules): void {
  fs.writeFileSync(getStorageLocation(getAcademicYear(storage.academicYear)), JSON.stringify(storage, null, 2));
}

export function loadStorage(config?: {
  noCheck?: boolean;
  academicYear: AcademicYear | undefined;
}): StoredCallSchedules {
  if (!fs.existsSync(getStorageLocation(config?.academicYear))) {
    return {
      versions: [],
    };
  }
  const result = JSON.parse(
    fs.readFileSync(getStorageLocation(config?.academicYear), 'utf8'),
  ) as unknown;
  if (config?.noCheck) {
    return result as StoredCallSchedules;
  }
  return assertStoredCallSchedules(result);
}
