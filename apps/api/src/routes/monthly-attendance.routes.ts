import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/require-auth.js";
import { HttpError } from "../utils/http-error.js";
import {
  buildMonthlyAttendanceReport,
  monthBounds,
} from "../services/monthly-attendance.js";

export const monthlyAttendanceRouter = Router();

const paramsSchema = z.object({ classId: z.uuid() });
const querySchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
  .strict();

/**
 * GET /api/classes/:classId/attendance/monthly?month=YYYY-MM
 *
 * ADMIN: view any non-archived class.
 * TEACHER: view their assigned, non-archived classes only.
 *
 * Reporting timezone: Asia/Ho_Chi_Minh (UTC+07:00).
 * Only COMPLETED sessions count toward attendance totals.
 * Include historically DROPPED enrollments when their periods overlap month.
 * No mutations and no tuition calculation.
 */
monthlyAttendanceRouter.get(
  "/classes/:classId/attendance/monthly",
  requireAuth,
  async (req, res, next) => {
    try {
      const params = paramsSchema.safeParse(req.params);
      const query = querySchema.safeParse(req.query);
      if (!params.success || !query.success) {
        throw new HttpError(400, "Invalid class ID or month (YYYY-MM).");
      }
      const { classId } = params.data;
      const { month } = query.data;
      let bounds: ReturnType<typeof monthBounds>;
      try {
        bounds = monthBounds(month);
      } catch {
        throw new HttpError(400, "Invalid report month.");
      }

      const currentUser = req.authUser!;
      if (currentUser.role === "TEACHER" && !currentUser.teacherId) {
        throw new HttpError(403, "Teacher profile required.");
      }
      const prisma = getPrisma();
      const targetClass = await prisma.class.findUnique({
        where: { id: classId },
        select: { id: true, name: true, teacherId: true, archivedAt: true },
      });
      if (!targetClass || targetClass.archivedAt !== null) {
        throw new HttpError(404, "Class not found.");
      }
      if (
        currentUser.role === "TEACHER" &&
        targetClass.teacherId !== currentUser.teacherId
      ) {
        throw new HttpError(403, "Access denied.");
      }

      // A completed session can have participants who are currently DROPPED.
      // Read historical periods rather than Enrollment.status.
      const sessions = await prisma.classSession.findMany({
        where: {
          classId,
          startsAt: { gte: bounds.from, lt: bounds.toExclusive },
        },
        select: { id: true, startsAt: true, status: true },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
      const completedSessionIds = sessions
        .filter((session) => session.status === "COMPLETED")
        .map((session) => session.id);

      const overlappingPeriod = {
        startedAt: { lt: bounds.toExclusive },
        OR: [{ endedAt: null }, { endedAt: { gt: bounds.from } }],
      };
      const enrollments = await prisma.enrollment.findMany({
        where: {
          classId,
          periods: { some: overlappingPeriod },
        },
        select: {
          id: true,
          status: true,
          student: {
            select: { id: true, studentCode: true, fullName: true },
          },
          periods: {
            where: overlappingPeriod,
            select: { startedAt: true, endedAt: true },
          },
          attendance: {
            where: { sessionId: { in: completedSessionIds } },
            select: { sessionId: true, status: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: {
          class: { id: targetClass.id, name: targetClass.name },
          ...buildMonthlyAttendanceReport({ month, sessions, enrollments }),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
