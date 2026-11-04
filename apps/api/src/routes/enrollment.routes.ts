import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";

export const enrollmentRouter = Router();

// All enrollment endpoints require authentication.
enrollmentRouter.use(requireAuth);

// ============================================================
// VALIDATION
// ============================================================

const listEnrollmentQuerySchema = z.object({
  classId: z.uuid(),

  status: z.enum(["ACTIVE", "DROPPED"]).default("ACTIVE"),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// M17.2 - Enroll Student Validation
const createEnrollmentSchema = z
  .object({
    studentId: z.uuid(),
    classId: z.uuid(),
  })
  .strict();

const enrollmentIdSchema = z.uuid();
// ============================================================
// GET /api/enrollments
//
// ADMIN:
//   Can view enrollments for any active class.
//
// TEACHER:
//   Can only view enrollments in their own active classes.
//
// STUDENT:
//   Not allowed.
//
// Query:
//   classId - required
//   status  - ACTIVE | DROPPED
//   page    - default 1
//   limit   - default 20
// ============================================================

enrollmentRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listEnrollmentQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid enrollment query parameters");
    }

    const currentUser = req.authUser!;

    if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
      throw new HttpError(
        403,
        "You do not have permission to view enrollments",
      );
    }

    if (currentUser.role === "TEACHER" && !currentUser.teacherId) {
      throw new HttpError(403, "Teacher profile required");
    }

    const { classId, status, page, limit } = parsed.data;

    const prisma = getPrisma();

    // ========================================================
    // VERIFY CLASS EXISTS AND IS ACTIVE
    // ========================================================

    const targetClass = await prisma.class.findFirst({
      where: {
        id: classId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        teacherId: true,
      },
    });

    if (!targetClass) {
      throw new HttpError(404, "Class not found");
    }

    // ========================================================
    // CHECK TEACHER OWNERSHIP
    // ========================================================

    if (
      currentUser.role === "TEACHER" &&
      targetClass.teacherId !== currentUser.teacherId
    ) {
      throw new HttpError(403, "You cannot view enrollments of this class");
    }

    // ========================================================
    // BUILD FILTER
    // ========================================================

    const where = {
      classId,
      status,
    };

    // ========================================================
    // FETCH ENROLLMENTS
    // ========================================================

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,

        select: {
          id: true,
          status: true,
          enrolledAt: true,

          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              email: true,
              phone: true,
              archivedAt: true,
            },
          },
        },

        orderBy: [{ enrolledAt: "desc" }, { id: "desc" }],

        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.enrollment.count({
        where,
      }),
    ]);

    // ========================================================
    // RESPONSE
    // ========================================================

    res.status(200).json({
      success: true,

      data: {
        class: {
          id: targetClass.id,
          name: targetClass.name,
          subject: targetClass.subject,
        },

        items: enrollments,

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

/**
 * M17.2 - Enroll Student
 *
 * POST /api/enrollments
 * Access: ADMIN only
 *
 * Create a new enrollment or reactivate a DROPPED one.
 */
enrollmentRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    // =====================================================
    // 1. VALIDATE REQUEST
    // =====================================================

    const parsed = createEnrollmentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid enrollment data");
    }

    const { studentId, classId } = parsed.data;
    const prisma = getPrisma();

    // =====================================================
    // 2. ENROLL WITH TRANSACTION
    // =====================================================

    const result = await prisma.$transaction(async (tx) => {
      const [student, targetClass] = await Promise.all([
        tx.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            archivedAt: true,
          },
        }),

        tx.class.findUnique({
          where: { id: classId },
          select: {
            id: true,
            archivedAt: true,
          },
        }),
      ]);

      // =================================================
      // 3. VERIFY STUDENT
      // =================================================

      if (!student) {
        throw new HttpError(404, "Student not found");
      }

      if (student.archivedAt !== null) {
        throw new HttpError(409, "Cannot enroll an archived student");
      }

      // =================================================
      // 4. VERIFY CLASS
      // =================================================

      if (!targetClass) {
        throw new HttpError(404, "Class not found");
      }

      if (targetClass.archivedAt !== null) {
        throw new HttpError(409, "Cannot enroll into an archived class");
      }

      // =================================================
      // 5. CHECK EXISTING ENROLLMENT
      // =================================================

      const existing = await tx.enrollment.findUnique({
        where: {
          studentId_classId: {
            studentId,
            classId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existing) {
        // Reject duplicate active enrollment.
        if (existing.status === "ACTIVE") {
          throw new HttpError(409, "Student is already enrolled in this class");
        }

        // Re-activate the original enrollment without changing its ID/enrolledAt.
        const updated = await tx.enrollment.updateMany({
          where: { id: existing.id, status: "DROPPED" },
          data: { status: "ACTIVE" },
        });

        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "Enrollment status changed. Please try again.",
          );
        }

        // Record the new period in the same transaction.
        // The migration's partial unique index allows only one open period.
        await tx.enrollmentPeriod.create({
          data: {
            enrollmentId: existing.id,
            startedAt: new Date(),
            endedAt: null,
          },
        });

        const enrollment = await tx.enrollment.findUniqueOrThrow({
          where: { id: existing.id },
          select: {
            id: true,
            studentId: true,
            classId: true,
            status: true,
            enrolledAt: true,
          },
        });

        return { httpStatus: 200, reactivated: true, enrollment };
      }

      // New enrollment: create its first participation period atomically.
      const enrolledAt = new Date();
      const enrollment = await tx.enrollment.create({
        data: {
          studentId,
          classId,
          status: "ACTIVE",
          enrolledAt,
        },
        select: {
          id: true,
          studentId: true,
          classId: true,
          status: true,
          enrolledAt: true,
        },
      });

      await tx.enrollmentPeriod.create({
        data: {
          enrollmentId: enrollment.id,
          startedAt: enrolledAt,
          endedAt: null,
        },
      });

      return { httpStatus: 201, reactivated: false, enrollment };
    });

    // =====================================================
    // 7. RESPONSE
    // =====================================================

    res.status(result.httpStatus).json({
      success: true,
      data: {
        enrollment: result.enrollment,
        reactivated: result.reactivated,
      },
    });
  } catch (error) {
    // Unique constraint violation.
    // Handles concurrent requests attempting
    // to create the same enrollment.
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      next(new HttpError(409, "Student is already enrolled in this class"));
      return;
    }

    next(error);
  }
});
/**
 * M17.3 - Drop Student from Class
 *
 * PATCH /api/enrollments/:id/drop
 * Access: ADMIN only
 *
 * Soft drop:
 * - ACTIVE -> DROPPED
 * - Preserve enrollment ID
 * - Preserve attendance and grade history
 */

enrollmentRouter.patch(
  "/:id/drop",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const parsedId = enrollmentIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "Invalid enrollment ID");
      }

      const prisma = getPrisma();
      const enrollmentId = parsedId.data;

      const updatedEnrollment = await prisma.$transaction(async (tx) => {
        // 1. Verify enrollment existence.
        const existingEnrollment = await tx.enrollment.findUnique({
          where: { id: enrollmentId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!existingEnrollment) {
          throw new HttpError(404, "Enrollment not found");
        }

        if (existingEnrollment.status === "DROPPED") {
          throw new HttpError(409, "Student has already dropped this class");
        }

        // 2. Change ACTIVE -> DROPPED.
        const droppedAt = new Date();
        const result = await tx.enrollment.updateMany({
          where: {
            id: enrollmentId,
            status: "ACTIVE",
          },
          data: {
            status: "DROPPED",
          },
        });

        if (result.count !== 1) {
          throw new HttpError(
            409,
            "Enrollment status changed. Please try again.",
          );
        }

        // 3. Close the currently open period.
        const closed = await tx.enrollmentPeriod.updateMany({
          where: {
            enrollmentId,
            endedAt: null,
            startedAt: { lte: droppedAt },
          },
          data: {
            endedAt: droppedAt,
          },
        });

        if (closed.count !== 1) {
          throw new HttpError(
            409,
            "Enrollment must have exactly one open period.",
          );
        }

        // 4. Fetch the updated enrollment.
        return tx.enrollment.findUniqueOrThrow({
          where: {
            id: enrollmentId,
          },
          select: {
            id: true,
            studentId: true,
            classId: true,
            status: true,
            enrolledAt: true,
          },
        });
      });

      res.status(200).json({
        success: true,
        data: {
          enrollment: updatedEnrollment,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
