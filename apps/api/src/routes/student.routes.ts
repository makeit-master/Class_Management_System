import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";

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

const createStudentSchema = z
  .object({
    studentCode: z
      .string()
      .trim()
      .regex(/^STU[0-9]{4,}$/, "Student code must follow STU0001 format"),

    fullName: z.string().trim().min(2).max(120),

    email: z.email().max(255).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),

    dateOfBirth: z.iso.date().nullable().optional(),

    gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),

    parentName: z.string().trim().max(120).nullable().optional(),
    parentPhone: z.string().trim().max(20).nullable().optional(),

    address: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

/**
 * M16.2.2 - Update Student Validation
 *
 * studentCode is immutable in this milestone.
 * At least one updatable field is required.
 */
const updateStudentSchema = createStudentSchema
  .omit({ studentCode: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

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

/**
 * M16.2.1 - Create Student
 *
 * POST /api/students
 * Access: ADMIN only
 */
studentRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = createStudentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid student data");
    }

    const input = parsed.data;

    const prisma = getPrisma();

    const student = await prisma.student.create({
      data: {
        studentCode: input.studentCode,
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,

        dateOfBirth: input.dateOfBirth
          ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
          : null,

        gender: input.gender ?? null,
        parentName: input.parentName ?? null,
        parentPhone: input.parentPhone ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      },

      select: studentSelect,
    });

    res.status(201).json({
      success: true,
      data: student,
    });
  } catch (error) {
    // Prisma P2002 = unique constraint violation.
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      next(new HttpError(409, "Student code already exists"));
      return;
    }

    next(error);
  }
});

/**
 * M16.2.2 - Update Student
 *
 * PATCH /api/students/:id
 * Access: ADMIN only
 */
studentRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsedId = studentIdSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      throw new HttpError(400, "Invalid student ID");
    }

    const parsedBody = updateStudentSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid student data");
    }

    const studentId = parsedId.data;
    const input = parsedBody.data;

    const prisma = getPrisma();

    // Only active students are editable.
    // updateMany applies the archive condition atomically.
    const result = await prisma.student.updateMany({
      where: {
        id: studentId,
        archivedAt: null,
      },
      data: {
        ...(input.fullName !== undefined && {
          fullName: input.fullName,
        }),

        ...(input.email !== undefined && {
          email: input.email,
        }),

        ...(input.phone !== undefined && {
          phone: input.phone,
        }),

        ...(input.dateOfBirth !== undefined && {
          dateOfBirth: input.dateOfBirth
            ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
            : null,
        }),

        ...(input.gender !== undefined && {
          gender: input.gender,
        }),

        ...(input.parentName !== undefined && {
          parentName: input.parentName,
        }),

        ...(input.parentPhone !== undefined && {
          parentPhone: input.parentPhone,
        }),

        ...(input.address !== undefined && {
          address: input.address,
        }),

        ...(input.notes !== undefined && {
          notes: input.notes,
        }),
      },
    });

    if (result.count === 0) {
      throw new HttpError(404, "Student not found");
    }

    const updatedStudent = await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: studentSelect,
    });

    res.status(200).json({
      success: true,
      data: updatedStudent,
    });
  } catch (error) {
    next(error);
  }

  /**
   * M16.5.1 - Archive Student
   *
   * PATCH /api/students/:id/archive
   * Access: ADMIN only
   *
   * Soft archive: preserves student and related records.
   */
  studentRouter.patch(
    "/:id/archive",
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        const parsedId = studentIdSchema.safeParse(req.params.id);

        if (!parsedId.success) {
          throw new HttpError(400, "Invalid student ID");
        }

        const studentId = parsedId.data;
        const prisma = getPrisma();

        const existingStudent = await prisma.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            archivedAt: true,
          },
        });

        if (!existingStudent) {
          throw new HttpError(404, "Student not found");
        }

        if (existingStudent.archivedAt !== null) {
          throw new HttpError(409, "Student is already archived");
        }

        // Atomic conditional update.
        const result = await prisma.student.updateMany({
          where: {
            id: studentId,
            archivedAt: null,
          },
          data: {
            archivedAt: new Date(),
          },
        });

        if (result.count === 0) {
          throw new HttpError(409, "Student status changed. Please try again.");
        }

        const archivedStudent = await prisma.student.findUniqueOrThrow({
          where: { id: studentId },
          select: studentSelect,
        });

        res.status(200).json({
          success: true,
          data: archivedStudent,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * M16.5.1 - Restore Student
   *
   * PATCH /api/students/:id/restore
   * Access: ADMIN only
   */
  studentRouter.patch(
    "/:id/restore",
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        const parsedId = studentIdSchema.safeParse(req.params.id);

        if (!parsedId.success) {
          throw new HttpError(400, "Invalid student ID");
        }

        const studentId = parsedId.data;
        const prisma = getPrisma();

        const existingStudent = await prisma.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            archivedAt: true,
          },
        });

        if (!existingStudent) {
          throw new HttpError(404, "Student not found");
        }

        if (existingStudent.archivedAt === null) {
          throw new HttpError(409, "Student is not archived");
        }

        // Only archived records can be restored.
        const result = await prisma.student.updateMany({
          where: {
            id: studentId,
            archivedAt: { not: null },
          },
          data: {
            archivedAt: null,
          },
        });

        if (result.count === 0) {
          throw new HttpError(409, "Student status changed. Please try again.");
        }

        const restoredStudent = await prisma.student.findUniqueOrThrow({
          where: { id: studentId },
          select: studentSelect,
        });

        res.status(200).json({
          success: true,
          data: restoredStudent,
        });
      } catch (error) {
        next(error);
      }
    },
  );
});
