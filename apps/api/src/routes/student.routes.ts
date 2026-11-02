import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { requireAuth } from "../middleware/require-auth.js";

export const studentRouter = Router();

// All student endpoints require authentication.
studentRouter.use(requireAuth);

// ============================================================
// VALIDATION
// ============================================================

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

const studentIdSchema = z.uuid();

// ============================================================
// SHARED RESPONSE SELECTION
// ============================================================

const studentSelect = {
  id: true,
  studentCode: true,
  fullName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  parentName: true,
  parentPhone: true,
  address: true,
  notes: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,

  _count: {
    select: {
      enrollments: {
        where: {
          status: "ACTIVE" as const,
          class: {
            archivedAt: null,
          },
        },
      },
    },
  },
} as const;

// ============================================================
// GET /api/students
// ADMIN: all active students
// TEACHER: students enrolled in their active classes
// ============================================================

studentRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid query parameters");
    }

    const currentUser = req.authUser!;

    if (currentUser.role === "TEACHER" && !currentUser.teacherId) {
      throw new HttpError(403, "Teacher profile required");
    }

    const { page, limit, search } = parsed.data;

    const where = {
      archivedAt: null,

      ...(currentUser.role === "TEACHER"
        ? {
            enrollments: {
              some: {
                status: "ACTIVE" as const,
                class: {
                  teacherId: currentUser.teacherId!,
                  archivedAt: null,
                },
              },
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                studentCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const prisma = getPrisma();

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: studentSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.student.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: students,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/students/:id
// ADMIN: any active student
// TEACHER: only students in their active classes
// ============================================================

studentRouter.get("/:id", async (req, res, next) => {
  try {
    const parsedId = studentIdSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      throw new HttpError(400, "Invalid student ID");
    }

    const currentUser = req.authUser!;

    if (currentUser.role === "TEACHER" && !currentUser.teacherId) {
      throw new HttpError(403, "Teacher profile required");
    }

    const prisma = getPrisma();

    const where = {
      id: parsedId.data,
      archivedAt: null,

      ...(currentUser.role === "TEACHER"
        ? {
            enrollments: {
              some: {
                status: "ACTIVE" as const,
                class: {
                  teacherId: currentUser.teacherId!,
                  archivedAt: null,
                },
              },
            },
          }
        : {}),
    };

    const student = await prisma.student.findFirst({
      where,
      select: {
        ...studentSelect,

        enrollments: {
          where: {
            status: "ACTIVE",
            class: {
              archivedAt: null,

              ...(currentUser.role === "TEACHER"
                ? { teacherId: currentUser.teacherId! }
                : {}),
            },
          },

          select: {
            id: true,
            status: true,
            enrolledAt: true,

            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                room: true,
                teacher: {
                  select: {
                    user: {
                      select: {
                        fullName: true,
                      },
                    },
                  },
                },
              },
            },
          },

          orderBy: {
            enrolledAt: "desc",
          },
        },
      },
    });

    if (!student) {
      throw new HttpError(404, "Student not found");
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
});
