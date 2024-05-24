import { ISO_DATE_DATEFNS_FORMAT, IsoDate } from 'check-type';
import * as datefns from 'date-fns';

const _dateToIsoDateCache: Record<number, IsoDate> = {};

export function dateToIsoDate(value: Date): IsoDate {
  const key = value.getTime();
  if (key in _dateToIsoDateCache) {
    return _dateToIsoDateCache[key];
  }
  const result = datefns.format(value, ISO_DATE_DATEFNS_FORMAT) as IsoDate;
  _dateToIsoDateCache[key] = result;
  return result;
}

const _isoDateToDateCache: Record<IsoDate, number> = {};
export function isoDateToDate(value: IsoDate): Date {
  const key = value;
  if (key in _isoDateToDateCache) {
    return new Date(_isoDateToDateCache[key]);
  }
  const result = datefns.parse(value, ISO_DATE_DATEFNS_FORMAT, new Date());
  if (!datefns.isValid(result)) {
    throw new Error(`Value is not an IsoDate: '${value}'`);
  }
  _isoDateToDateCache[key] = result.getTime();
  return result;
}
