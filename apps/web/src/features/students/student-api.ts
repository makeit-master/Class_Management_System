import { apiClient } from "../../lib/api-client";

export type StudentGender = "MALE" | "FEMALE" | "OTHER";

export type StudentRecord = {
  id: string;
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: StudentGender | null;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    enrollments: number;
  };
};

export type StudentListResponse = {
  items: StudentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateStudentInput = {
  studentCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: StudentGender | null;
  parentName?: string | null;
  parentPhone?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type UpdateStudentInput = Partial<
  Omit<CreateStudentInput, "studentCode">
>;

export function getStudents(
  token: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {},
): Promise<StudentListResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  return apiClient<StudentListResponse>(`/students?${query.toString()}`, {
    token,
  });
}

export function getStudentById(
  token: string,
  studentId: string,
): Promise<StudentRecord> {
  return apiClient<StudentRecord>(
    `/students/${encodeURIComponent(studentId)}`,
    { token },
  );
}

export function createStudent(
  token: string,
  input: CreateStudentInput,
): Promise<StudentRecord> {
  return apiClient<StudentRecord>("/students", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function updateStudent(
  token: string,
  studentId: string,
  input: UpdateStudentInput,
): Promise<StudentRecord> {
  return apiClient<StudentRecord>(
    `/students/${encodeURIComponent(studentId)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    },
  );
}
