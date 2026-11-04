import { apiClient } from "../../lib/api-client";

import type {
  CompleteSessionData,
  SessionAttendanceData,
  SessionListData,
  SessionListParams,
  UpdateAttendanceData,
  UpdateAttendancePayload,
} from "./attendance.types";

export function getClassSessions(
  token: string,
  classId: string,
  params: SessionListParams = {},
): Promise<SessionListData> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.status !== undefined) query.set("status", params.status);
  if (params.from !== undefined) query.set("from", params.from);
  if (params.to !== undefined) query.set("to", params.to);

  return apiClient<SessionListData>(
    `/classes/${encodeURIComponent(classId)}/sessions?${query.toString()}`,
    { token },
  );
}

export function getSessionAttendance(
  token: string,
  sessionId: string,
): Promise<SessionAttendanceData> {
  return apiClient<SessionAttendanceData>(
    `/sessions/${encodeURIComponent(sessionId)}/attendance`,
    { token },
  );
}

export function updateSessionAttendance(
  token: string,
  sessionId: string,
  payload: UpdateAttendancePayload,
): Promise<UpdateAttendanceData> {
  return apiClient<UpdateAttendanceData>(
    `/sessions/${encodeURIComponent(sessionId)}/attendance`,
    {
      method: "PUT",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function completeSession(
  token: string,
  sessionId: string,
): Promise<CompleteSessionData> {
  return apiClient<CompleteSessionData>(
    `/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "PATCH", token },
  );
}
