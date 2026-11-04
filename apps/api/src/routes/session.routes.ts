import { Router, type Response } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";

export const sessionRouter = Router();

// ============================================================
// SHARED HELPERS
// ============================================================

const uuidSchema = z.uuid();

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),

  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

const createSessionSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    scheduleId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    {
      message: "startsAt must be earlier than endsAt.",
      path: ["endsAt"],
    },
  );

const updateSessionSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }).optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    scheduleId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

const attendanceRecordSchema = z
  .object({
    enrollmentId: z.uuid(),
    status: z.enum(["PRESENT", "ABSENT"]),
  })
  .strict();

const markAttendanceSchema = z
  .object({
    records: z
      .array(attendanceRecordSchema)
      .min(1, "At least one attendance record is required.")
      .max(200, "Maximum 200 attendance records per request."),
  })
  .strict()
  .refine(
    (data) => {
      const ids = data.records.map((record) => record.enrollmentId);

      return new Set(ids).size === ids.length;
    },
    {
      message: "Duplicate enrollmentId is not allowed.",
      path: ["records"],
    },
  );

// ============================================================
// GET /api/classes/:classId/sessions
// List sessions belonging to a class.
// ADMIN: all classes.
// TEACHER: assigned classes only.
// ============================================================

sessionRouter.get(
  "/classes/:classId/sessions",
  requireAuth,
  async (req, res, next) => {
    try {
      const idResult = uuidSchema.safeParse(req.params.classId);

      if (!idResult.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid class ID.");
        return;
      }

      const queryResult = listQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid session query parameters.",
          z.flattenError(queryResult.error),
        );
        return;
      }

      const { page, limit, status, from, to } = queryResult.data;

      if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
        sendError(
          res,
          400,
          "INVALID_TIME_RANGE",
          "from must be earlier than or equal to to.",
        );
        return;
      }

      const prisma = getPrisma();
      const currentUser = req.authUser!;

      if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
        sendError(res, 403, "FORBIDDEN", "Access denied.");
        return;
      }

      const targetClass = await prisma.class.findUnique({
        where: {
          id: idResult.data,
        },
        select: {
          id: true,
          teacherId: true,
          archivedAt: true,
        },
      });

      if (!targetClass || targetClass.archivedAt !== null) {
        sendError(res, 404, "CLASS_NOT_FOUND", "Class not found.");
        return;
      }

      if (
        currentUser.role === "TEACHER" &&
        targetClass.teacherId !== currentUser.teacherId
      ) {
        sendError(res, 403, "FORBIDDEN", "Access denied.");
        return;
      }

      const where = {
        classId: targetClass.id,

        ...(status ? { status } : {}),

        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.classSession.findMany({
          where,

          orderBy: [{ startsAt: "asc" }, { id: "asc" }],

          skip: (page - 1) * limit,
          take: limit,

          select: {
            id: true,
            classId: true,
            scheduleId: true,
            startsAt: true,
            endsAt: true,
            status: true,

            _count: {
              select: {
                attendance: true,
              },
            },
          },
        }),

        prisma.classSession.count({
          where,
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          items: items.map(({ _count, ...session }) => ({
            ...session,
            attendanceCount: _count.attendance,
          })),

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
  },
);

// ============================================================
// GET /api/sessions/:id
// Get session details.
// ADMIN: all sessions.
// TEACHER: sessions of assigned classes only.
// ============================================================

sessionRouter.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const idResult = uuidSchema.safeParse(req.params.id);

    if (!idResult.success) {
      sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
      return;
    }

    const prisma = getPrisma();
    const currentUser = req.authUser!;

    const session = await prisma.classSession.findUnique({
      where: {
        id: idResult.data,
      },

      select: {
        id: true,
        classId: true,
        scheduleId: true,
        startsAt: true,
        endsAt: true,
        status: true,

        class: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            archivedAt: true,
          },
        },

        _count: {
          select: {
            attendance: true,
          },
        },
      },
    });

    if (!session || session.class.archivedAt !== null) {
      sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
      return;
    }

    if (
      currentUser.role === "TEACHER" &&
      session.class.teacherId !== currentUser.teacherId
    ) {
      sendError(res, 403, "FORBIDDEN", "Access denied.");
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: session.id,
        classId: session.classId,
        scheduleId: session.scheduleId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,

        attendanceCount: session._count.attendance,

        class: {
          id: session.class.id,
          name: session.class.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/classes/:classId/sessions
// Create a scheduled session.
// ADMIN only.
// ============================================================

sessionRouter.post(
  "/classes/:classId/sessions",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const idResult = uuidSchema.safeParse(req.params.classId);

      if (!idResult.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid class ID.");
        return;
      }

      const bodyResult = createSessionSchema.safeParse(req.body);

      if (!bodyResult.success) {
        sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid session data.",
          z.flattenError(bodyResult.error),
        );
        return;
      }

      const prisma = getPrisma();
      const classId = idResult.data;

      const { startsAt, endsAt, scheduleId } = bodyResult.data;

      const startDate = new Date(startsAt);
      const endDate = new Date(endsAt);

      // 1. Validate target class.

      const targetClass = await prisma.class.findUnique({
        where: {
          id: classId,
        },

        select: {
          id: true,
          archivedAt: true,
        },
      });

      if (!targetClass || targetClass.archivedAt !== null) {
        sendError(res, 404, "CLASS_NOT_FOUND", "Class not found.");
        return;
      }

      // 2. Validate optional schedule ownership.

      if (scheduleId) {
        const schedule = await prisma.schedule.findUnique({
          where: {
            id: scheduleId,
          },

          select: {
            classId: true,
          },
        });

        if (!schedule || schedule.classId !== classId) {
          sendError(
            res,
            400,
            "INVALID_SCHEDULE",
            "Schedule does not belong to this class.",
          );
          return;
        }
      }

      // 3. Check overlapping non-cancelled sessions.

      const overlappingSession = await prisma.classSession.findFirst({
        where: {
          classId,

          status: {
            not: "CANCELLED",
          },

          startsAt: {
            lt: endDate,
          },

          endsAt: {
            gt: startDate,
          },
        },

        select: {
          id: true,
        },
      });

      if (overlappingSession) {
        sendError(
          res,
          409,
          "SESSION_CONFLICT",
          "Session time overlaps an existing session.",
        );
        return;
      }

      // 4. Create session.

      const createdSession = await prisma.classSession.create({
        data: {
          classId,
          scheduleId: scheduleId ?? null,
          startsAt: startDate,
          endsAt: endDate,
          status: "SCHEDULED",
        },

        select: {
          id: true,
          classId: true,
          scheduleId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      });

      res.status(201).json({
        success: true,
        data: createdSession,
      });
    } catch (error) {
      // Handle unique constraint violations.

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        sendError(
          res,
          409,
          "SESSION_CONFLICT",
          "A session already exists at this start time.",
        );
        return;
      }

      next(error);
    }
  },
);

// ============================================================
// PATCH /api/sessions/:id
// Update session time or schedule.
// ADMIN only.
// Only SCHEDULED sessions without attendance.
// ============================================================

sessionRouter.patch(
  "/sessions/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const idResult = uuidSchema.safeParse(req.params.id);

      const bodyResult = updateSessionSchema.safeParse(req.body);

      if (!idResult.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
        return;
      }

      if (!bodyResult.success) {
        sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid session update data.",
          z.flattenError(bodyResult.error),
        );
        return;
      }

      const prisma = getPrisma();
      const sessionId = idResult.data;
      const changes = bodyResult.data;

      // 1. Find existing session.

      const existing = await prisma.classSession.findUnique({
        where: {
          id: sessionId,
        },

        select: {
          id: true,
          classId: true,
          startsAt: true,
          endsAt: true,
          status: true,

          class: {
            select: {
              archivedAt: true,
            },
          },

          _count: {
            select: {
              attendance: true,
            },
          },
        },
      });

      if (!existing || existing.class.archivedAt !== null) {
        sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
        return;
      }

      // 2. Validate session status.

      if (existing.status !== "SCHEDULED") {
        sendError(
          res,
          409,
          "INVALID_SESSION_STATUS",
          "Only scheduled sessions can be updated.",
        );
        return;
      }

      // 3. Protect attendance records.

      if (existing._count.attendance > 0) {
        sendError(
          res,
          409,
          "SESSION_HAS_ATTENDANCE",
          "Cannot update a session with attendance.",
        );
        return;
      }

      // 4. Resolve final start/end time.

      const startsAt =
        changes.startsAt !== undefined
          ? new Date(changes.startsAt)
          : existing.startsAt;

      const endsAt =
        changes.endsAt !== undefined
          ? new Date(changes.endsAt)
          : existing.endsAt;

      if (startsAt.getTime() >= endsAt.getTime()) {
        sendError(
          res,
          400,
          "INVALID_TIME_RANGE",
          "startsAt must be earlier than endsAt.",
        );
        return;
      }

      // 5. Validate schedule ownership.

      if (changes.scheduleId) {
        const schedule = await prisma.schedule.findUnique({
          where: {
            id: changes.scheduleId,
          },

          select: {
            classId: true,
          },
        });

        if (!schedule || schedule.classId !== existing.classId) {
          sendError(
            res,
            400,
            "INVALID_SCHEDULE",
            "Schedule does not belong to this class.",
          );
          return;
        }
      }

      // 6. Check overlap, excluding current session.

      const overlappingSession = await prisma.classSession.findFirst({
        where: {
          classId: existing.classId,

          id: {
            not: sessionId,
          },

          status: {
            not: "CANCELLED",
          },

          startsAt: {
            lt: endsAt,
          },

          endsAt: {
            gt: startsAt,
          },
        },

        select: {
          id: true,
        },
      });

      if (overlappingSession) {
        sendError(
          res,
          409,
          "SESSION_CONFLICT",
          "Session time overlaps another session.",
        );
        return;
      }

      // 7. Conditional update.
      // Recheck status and attendance at write time.

      const result = await prisma.classSession.updateMany({
        where: {
          id: sessionId,
          status: "SCHEDULED",

          attendance: {
            none: {},
          },
        },

        data: {
          startsAt,
          endsAt,

          ...(changes.scheduleId !== undefined
            ? {
                scheduleId: changes.scheduleId,
              }
            : {}),
        },
      });

      if (result.count !== 1) {
        sendError(
          res,
          409,
          "SESSION_STATE_CONFLICT",
          "Session status or attendance has changed.",
        );
        return;
      }

      // 8. Return updated session.

      const updated = await prisma.classSession.findUniqueOrThrow({
        where: {
          id: sessionId,
        },

        select: {
          id: true,
          classId: true,
          scheduleId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        sendError(
          res,
          409,
          "SESSION_CONFLICT",
          "A session already uses this start time.",
        );
        return;
      }

      next(error);
    }
  },
);

// ============================================================
// PATCH /api/sessions/:id/cancel
// Cancel a scheduled session.
// ADMIN only.
// Cannot cancel a session with attendance.
// ============================================================

sessionRouter.patch(
  "/sessions/:id/cancel",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const idResult = uuidSchema.safeParse(req.params.id);

      if (!idResult.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
        return;
      }

      const prisma = getPrisma();
      const sessionId = idResult.data;

      // 1. Find existing session.

      const existing = await prisma.classSession.findUnique({
        where: {
          id: sessionId,
        },

        select: {
          id: true,
          status: true,

          class: {
            select: {
              archivedAt: true,
            },
          },

          _count: {
            select: {
              attendance: true,
            },
          },
        },
      });

      if (!existing || existing.class.archivedAt !== null) {
        sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
        return;
      }

      // 2. Validate current status.

      if (existing.status !== "SCHEDULED") {
        sendError(
          res,
          409,
          "INVALID_SESSION_STATUS",
          "Only scheduled sessions can be cancelled.",
        );
        return;
      }

      // 3. Protect attendance records.

      if (existing._count.attendance > 0) {
        sendError(
          res,
          409,
          "SESSION_HAS_ATTENDANCE",
          "Cannot cancel a session with attendance.",
        );
        return;
      }

      // 4. Conditional cancel.
      // Recheck status and attendance at write time.

      const result = await prisma.classSession.updateMany({
        where: {
          id: sessionId,
          status: "SCHEDULED",

          attendance: {
            none: {},
          },
        },

        data: {
          status: "CANCELLED",
        },
      });

      if (result.count !== 1) {
        sendError(
          res,
          409,
          "SESSION_STATE_CONFLICT",
          "Session status or attendance has changed.",
        );
        return;
      }

      // 5. Return cancelled session.

      const cancelled = await prisma.classSession.findUniqueOrThrow({
        where: {
          id: sessionId,
        },

        select: {
          id: true,
          classId: true,
          scheduleId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      });

      res.status(200).json({
        success: true,
        data: cancelled,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * M18.3.2 - GET Session Attendance
 *
 * GET /api/sessions/:id/attendance
 *
 * ADMIN: All active classes
 * TEACHER: Assigned classes only
 */
sessionRouter.get(
  "/sessions/:id/attendance",
  requireAuth,
  async (req, res, next) => {
    try {
      // 1. Validate session ID.
      const parsedId = uuidSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
        return;
      }

      const prisma = getPrisma();
      const currentUser = req.authUser!;

      // 2. Find session and its class.
      const session = await prisma.classSession.findUnique({
        where: {
          id: parsedId.data,
        },
        select: {
          id: true,
          classId: true,
          startsAt: true,
          endsAt: true,
          status: true,
          class: {
            select: {
              id: true,
              name: true,
              teacherId: true,
              archivedAt: true,
            },
          },
        },
      });

      if (!session || session.class.archivedAt !== null) {
        sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
        return;
      }

      // 3. Verify teacher ownership.
      if (
        currentUser.role === "TEACHER" &&
        session.class.teacherId !== currentUser.teacherId
      ) {
        sendError(res, 403, "FORBIDDEN", "Access denied.");
        return;
      }

      // 4. Find enrollments eligible at session start.
      // Historical participation is determined by
      // EnrollmentPeriod, not current Enrollment.status.
      const enrollments = await prisma.enrollment.findMany({
        where: {
          classId: session.classId,
          periods: {
            some: {
              startedAt: {
                lte: session.startsAt,
              },
              OR: [
                {
                  endedAt: null,
                },
                {
                  endedAt: {
                    gt: session.startsAt,
                  },
                },
              ],
            },
          },
        },
        select: {
          id: true,
          studentId: true,
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
            },
          },
          attendance: {
            where: {
              sessionId: session.id,
            },
            select: {
              status: true,
              note: true,
              markedAt: true,
            },
          },
        },
        orderBy: {
          student: {
            fullName: "asc",
          },
        },
      });

      // 5. Build attendance list.
      const students = enrollments.map((enrollment) => {
        const attendance = enrollment.attendance[0];

        return {
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          studentCode: enrollment.student.studentCode,
          fullName: enrollment.student.fullName,
          attendanceStatus: attendance?.status ?? null,
          note: attendance?.note ?? null,
          markedAt: attendance?.markedAt ?? null,
        };
      });

      // 6. Calculate summary.
      const summary = {
        present: students.filter(
          (student) => student.attendanceStatus === "PRESENT",
        ).length,

        absent: students.filter(
          (student) => student.attendanceStatus === "ABSENT",
        ).length,

        unmarked: students.filter(
          (student) => student.attendanceStatus === null,
        ).length,
      };

      // 7. Response.
      res.status(200).json({
        success: true,
        data: {
          session: {
            id: session.id,
            classId: session.classId,
            className: session.class.name,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            status: session.status,
          },
          students,
          summary,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * M18.3.3 - Mark / Update Attendance
 *
 * PUT /api/sessions/:id/attendance
 * ADMIN: All active classes
 * TEACHER: Assigned classes only
 */
sessionRouter.put(
  "/sessions/:id/attendance",
  requireAuth,
  async (req, res, next) => {
    try {
      const parsedId = uuidSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
        return;
      }

      const parsedBody = markAttendanceSchema.safeParse(req.body);

      if (!parsedBody.success) {
        sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Invalid attendance data.",
          z.flattenError(parsedBody.error),
        );
        return;
      }

      const currentUser = req.authUser!;

      if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
        sendError(res, 403, "FORBIDDEN", "Access denied.");
        return;
      }

      const prisma = getPrisma();
      const sessionId = parsedId.data;
      const records = parsedBody.data.records;

      const enrollmentIds = records.map((record) => record.enrollmentId);

      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Load session and check class.
          const session = await tx.classSession.findUnique({
            where: { id: sessionId },
            select: {
              id: true,
              classId: true,
              startsAt: true,
              status: true,
              class: {
                select: {
                  teacherId: true,
                  archivedAt: true,
                },
              },
            },
          });

          if (!session || session.class.archivedAt !== null) {
            return { kind: "NOT_FOUND" } as const;
          }

          // 2. Check teacher ownership.
          if (
            currentUser.role === "TEACHER" &&
            session.class.teacherId !== currentUser.teacherId
          ) {
            return { kind: "FORBIDDEN" } as const;
          }

          // 3. Only scheduled sessions can be marked.
          if (session.status !== "SCHEDULED") {
            return { kind: "INVALID_STATUS" } as const;
          }

          // 4. Check EnrollmentPeriod eligibility.
          const eligibleEnrollments = await tx.enrollment.findMany({
            where: {
              id: { in: enrollmentIds },
              classId: session.classId,
              periods: {
                some: {
                  startedAt: {
                    lte: session.startsAt,
                  },
                  OR: [
                    { endedAt: null },
                    {
                      endedAt: {
                        gt: session.startsAt,
                      },
                    },
                  ],
                },
              },
            },
            select: { id: true },
          });

          if (eligibleEnrollments.length !== records.length) {
            return { kind: "INVALID_ENROLLMENTS" } as const;
          }

          // 5. Insert or update attendance atomically.
          const markedAt = new Date();

          for (const record of records) {
            await tx.attendance.upsert({
              where: {
                enrollmentId_sessionId: {
                  enrollmentId: record.enrollmentId,
                  sessionId,
                },
              },
              create: {
                enrollmentId: record.enrollmentId,
                sessionId,
                status: record.status,
                markedAt,
              },
              update: {
                status: record.status,
                markedAt,
              },
            });
          }

          return {
            kind: "SUCCESS",
            markedAt,
          } as const;
        },
        {
          isolationLevel: "Serializable",
        },
      );

      // 6. Handle business errors.
      switch (result.kind) {
        case "NOT_FOUND":
          sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
          return;

        case "FORBIDDEN":
          sendError(res, 403, "FORBIDDEN", "Access denied.");
          return;

        case "INVALID_STATUS":
          sendError(
            res,
            409,
            "INVALID_SESSION_STATUS",
            "Only scheduled sessions can be marked.",
          );
          return;

        case "INVALID_ENROLLMENTS":
          sendError(
            res,
            400,
            "INVALID_ENROLLMENTS",
            "One or more students are not eligible for this session.",
          );
          return;
      }

      // 7. Success.
      res.status(200).json({
        success: true,
        data: {
          sessionId,
          updatedCount: records.length,
          markedAt: result.markedAt,
          records,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        sendError(
          res,
          409,
          "ATTENDANCE_CONFLICT",
          "Attendance changed concurrently. Please retry.",
        );
        return;
      }

      next(error);
    }
  },
);

/**
 * M18.3.4 - Complete Session
 *
 * PATCH /api/sessions/:id/complete
 *
 * ADMIN: All classes
 * TEACHER: Assigned classes only
 */
sessionRouter.patch(
  "/sessions/:id/complete",
  requireAuth,
  async (req, res, next) => {
    try {
      const parsedId = uuidSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid session ID.");
        return;
      }

      const currentUser = req.authUser!;

      if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
        sendError(res, 403, "FORBIDDEN", "Access denied.");
        return;
      }

      const prisma = getPrisma();
      const sessionId = parsedId.data;

      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Find session.
          const session = await tx.classSession.findUnique({
            where: { id: sessionId },
            select: {
              id: true,
              classId: true,
              startsAt: true,
              status: true,
              class: {
                select: {
                  teacherId: true,
                  archivedAt: true,
                },
              },
            },
          });

          if (!session || session.class.archivedAt !== null) {
            return { kind: "NOT_FOUND" } as const;
          }

          // 2. Check permissions.
          if (
            currentUser.role === "TEACHER" &&
            session.class.teacherId !== currentUser.teacherId
          ) {
            return { kind: "FORBIDDEN" } as const;
          }

          // 3. Only SCHEDULED sessions can be completed.
          if (session.status !== "SCHEDULED") {
            return { kind: "INVALID_STATUS" } as const;
          }

          // 4. Find students eligible at session start.
          const enrollments = await tx.enrollment.findMany({
            where: {
              classId: session.classId,
              periods: {
                some: {
                  startedAt: {
                    lte: session.startsAt,
                  },
                  OR: [
                    { endedAt: null },
                    {
                      endedAt: {
                        gt: session.startsAt,
                      },
                    },
                  ],
                },
              },
            },
            select: {
              id: true,
              attendance: {
                where: {
                  sessionId,
                },
                select: {
                  status: true,
                },
              },
            },
          });

          // 5. Do not complete an empty class.
          if (enrollments.length === 0) {
            return { kind: "NO_STUDENTS" } as const;
          }

          // 6. Count marked and unmarked students.
          let present = 0;
          let absent = 0;
          let unmarked = 0;

          for (const enrollment of enrollments) {
            const attendance = enrollment.attendance[0];

            if (!attendance) {
              unmarked++;
            } else if (attendance.status === "PRESENT") {
              present++;
            } else if (attendance.status === "ABSENT") {
              absent++;
            }
          }

          if (unmarked > 0) {
            return {
              kind: "UNMARKED_STUDENTS",
              unmarked,
            } as const;
          }

          // 7. Complete session conditionally.
          const updated = await tx.classSession.updateMany({
            where: {
              id: sessionId,
              status: "SCHEDULED",
            },
            data: {
              status: "COMPLETED",
            },
          });

          if (updated.count !== 1) {
            return { kind: "SESSION_CHANGED" } as const;
          }

          return {
            kind: "SUCCESS",
            sessionId,
            classId: session.classId,
            status: "COMPLETED",
            summary: {
              present,
              absent,
              unmarked: 0,
            },
          } as const;
        },
        {
          isolationLevel: "Serializable",
        },
      );

      // 8. Handle business errors.
      switch (result.kind) {
        case "NOT_FOUND":
          sendError(res, 404, "SESSION_NOT_FOUND", "Session not found.");
          return;

        case "FORBIDDEN":
          sendError(res, 403, "FORBIDDEN", "Access denied.");
          return;

        case "INVALID_STATUS":
          sendError(
            res,
            409,
            "INVALID_SESSION_STATUS",
            "Only scheduled sessions can be completed.",
          );
          return;

        case "NO_STUDENTS":
          sendError(
            res,
            409,
            "NO_ELIGIBLE_STUDENTS",
            "Cannot complete a session without eligible students.",
          );
          return;

        case "UNMARKED_STUDENTS":
          sendError(
            res,
            409,
            "ATTENDANCE_INCOMPLETE",
            `${result.unmarked} student(s) have not been marked.`,
          );
          return;

        case "SESSION_CHANGED":
          sendError(
            res,
            409,
            "SESSION_STATE_CONFLICT",
            "Session status has changed.",
          );
          return;
      }

      // 9. Success response.
      res.status(200).json({
        success: true,
        data: {
          sessionId: result.sessionId,
          classId: result.classId,
          status: result.status,
          summary: result.summary,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034"
      ) {
        sendError(
          res,
          409,
          "SESSION_STATE_CONFLICT",
          "Concurrent update detected. Please retry.",
        );
        return;
      }

      next(error);
    }
  },
);
