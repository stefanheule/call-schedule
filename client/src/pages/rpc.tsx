import {
  assertGetDayHistoryResponse,
  assertListCallSchedulesResponse,
  assertLoadCallScheduleResponse,
  assertRestorePreviousVersionResponse,
  assertSaveCallScheduleResponse,
  assertSaveFullCallScheduleResponse,
} from '../shared/check-type.generated';
import { axiosPost } from '../shared/common/axios';
import {
  GetDayHistoryRequest,
  GetDayHistoryResponse,
  ListCallSchedulesRequest,
  ListCallSchedulesResponse,
  LoadCallScheduleRequest,
  LoadCallScheduleResponse,
  RestorePreviousVersionRequest,
  RestorePreviousVersionResponse,
  SaveCallScheduleRequest,
  SaveCallScheduleResponse,
  SaveFullCallScheduleResponse,
} from '../shared/types';

const AXIOS_PROPS = {
  isLocal: true,
  isFrontend: true,
};

export async function rpcLoadCallSchedules(
  request: LoadCallScheduleRequest,
): Promise<LoadCallScheduleResponse> {
  const data = (
    await axiosPost('/api/load-call-schedule', request, AXIOS_PROPS)
  ).data;
  return assertLoadCallScheduleResponse(data);
}

export async function rpcSaveCallSchedules(
  request: SaveCallScheduleRequest,
): Promise<SaveCallScheduleResponse> {
  const data = (
    await axiosPost('/api/save-call-schedule', request, AXIOS_PROPS)
  ).data;
  return assertSaveCallScheduleResponse(data);
}

export async function rpcSaveFullCallSchedules(
  request: SaveCallScheduleRequest,
): Promise<SaveFullCallScheduleResponse> {
  const data = (
    await axiosPost('/api/save-full-call-schedule', request, AXIOS_PROPS)
  ).data;
  return assertSaveFullCallScheduleResponse(data);
}

export async function rpcListCallSchedules(
  request: ListCallSchedulesRequest,
): Promise<ListCallSchedulesResponse> {
  const data = (
    await axiosPost('/api/list-call-schedules', request, AXIOS_PROPS)
  ).data;
  return assertListCallSchedulesResponse(data);
}

export async function rpcGetDayHistory(
  request: GetDayHistoryRequest,
): Promise<GetDayHistoryResponse> {
  const data = (await axiosPost('/api/get-day-history', request, AXIOS_PROPS)).data;
  return assertGetDayHistoryResponse(data);
}

export async function rpcRestorePreviousVersion(
  request: RestorePreviousVersionRequest,
): Promise<RestorePreviousVersionResponse> {
  const data = (await axiosPost('/api/restore-previous-version', request, AXIOS_PROPS)).data;
  return assertRestorePreviousVersionResponse(data);
}
