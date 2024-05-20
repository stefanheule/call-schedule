import {
  assertListCallSchedulesResponse,
  assertLoadCallScheduleResponse,
  assertSaveCallScheduleResponse,
} from '../shared/check-type.generated';
import { axiosPost } from '../shared/common/axios';
import {
  ListCallSchedulesRequest,
  ListCallSchedulesResponse,
  LoadCallScheduleRequest,
  LoadCallScheduleResponse,
  SaveCallScheduleRequest,
  SaveCallScheduleResponse,
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

export async function rpcListCallSchedules(
  request: ListCallSchedulesRequest,
): Promise<ListCallSchedulesResponse> {
  const data = (
    await axiosPost('/api/list-call-schedules', request, AXIOS_PROPS)
  ).data;
  return assertListCallSchedulesResponse(data);
}
