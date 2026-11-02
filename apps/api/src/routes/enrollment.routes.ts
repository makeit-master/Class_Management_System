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
        // Already enrolled in this class.
        if (existing.status === "ACTIVE") {
          throw new HttpError(409, "Student is already enrolled in this class");
        }

        // ===============================================
        // 6A. REACTIVATE DROPPED ENROLLMENT
        // ===============================================

        const updated = await tx.enrollment.updateMany({
          where: {
            id: existing.id,
            status: "DROPPED",
          },
          data: {
            status: "ACTIVE",
          },
        });

        if (updated.count === 0) {
          throw new HttpError(
            409,
            "Enrollment status changed. Please try again.",
          );
        }

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

        return {
          httpStatus: 200,
          reactivated: true,
          enrollment,
        };
      }

      // =================================================
      // 6B. CREATE NEW ENROLLMENT
      // =================================================

      const enrollment = await tx.enrollment.create({
        data: {
          studentId,
          classId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          studentId: true,
          classId: true,
          status: true,
          enrolledAt: true,
        },
      });

      return {
        httpStatus: 201,
        reactivated: false,
        enrollment,
      };
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
      // ============================================
      // 1. VALIDATE ENROLLMENT ID
      // ============================================

      const parsedId = enrollmentIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "Invalid enrollment ID");
      }

      const enrollmentId = parsedId.data;
      const prisma = getPrisma();

      // ============================================
      // 2. FIND EXISTING ENROLLMENT
      // ============================================

      const existingEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: enrollmentId,
        },
        select: {
          id: true,
          status: true,
          studentId: true,
          classId: true,
        },
      });

      if (!existingEnrollment) {
        throw new HttpError(404, "Enrollment not found");
      }

      // ============================================
      // 3. VERIFY CURRENT STATUS
      // ============================================

      if (existingEnrollment.status === "DROPPED") {
        throw new HttpError(409, "Student has already dropped this class");
      }

      // ============================================
      // 4. ATOMIC STATUS UPDATE
      // ============================================

      const result = await prisma.enrollment.updateMany({
        where: {
          id: enrollmentId,
          status: "ACTIVE",
        },
        data: {
          status: "DROPPED",
        },
      });

      if (result.count === 0) {
        throw new HttpError(
          409,
          "Enrollment status changed. Please try again.",
        );
      }

      // ============================================
      // 5. FETCH UPDATED ENROLLMENT
      // ============================================

      const updatedEnrollment = await prisma.enrollment.findUniqueOrThrow({
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

      // ============================================
      // 6. RESPONSE
      // ============================================

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
