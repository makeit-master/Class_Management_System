import { apiClient } from "../lib/api-client";

export type ClassTeacher = {
  id: string;
  user: {
    fullName: string;
  };
};

export type ClassRecord = {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  room: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  teacher: ClassTeacher;
  _count: {
    enrollments: number;
  };
};

export type ClassListResponse = {
  items: ClassRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateClassInput = {
  name: string;
  teacherId: string;
  subject?: string | null;
  room?: string | null;
  description?: string | null;
};

export type UpdateClassInput = Partial<CreateClassInput>;

export async function getClasses(
  token: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {},
): Promise<ClassListResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  return apiClient<ClassListResponse>(`/classes?${query.toString()}`, {
    token,
  });
}

export async function getClassById(
  token: string,
  classId: string,
): Promise<ClassRecord> {
  return apiClient<ClassRecord>(`/classes/${encodeURIComponent(classId)}`, {
    token,
  });
}

export async function createClass(
  token: string,
  input: CreateClassInput,
): Promise<ClassRecord> {
  return apiClient<ClassRecord>("/classes", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateClass(
  token: string,
  classId: string,
  input: UpdateClassInput,
): Promise<ClassRecord> {
  return apiClient<ClassRecord>(`/classes/${encodeURIComponent(classId)}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export async function archiveClass(
  token: string,
  classId: string,
): Promise<ClassRecord> {
  return apiClient<ClassRecord>(
    `/classes/${encodeURIComponent(classId)}/archive`,
    {
      method: "PATCH",
      token,
    },
  );
}

export type TeacherOption = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  subject: string | null;
};

export async function getTeacherOptions(
  token: string,
): Promise<TeacherOption[]> {
  return apiClient<TeacherOption[]>("/classes/teacher-options", { token });
}
