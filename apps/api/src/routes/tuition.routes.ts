import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import { HttpError } from "../utils/http-error.js";
import {
  buildMonthlyAttendanceReport,
  monthBounds,
} from "../services/monthly-attendance.js";
import { buildMonthlyTuitionReport } from "../services/monthly-tuition.js";

export const tuitionRouter = Router();
tuitionRouter.use("/classes/:classId/tuition", requireAuth);

const classParams = z.object({ classId: z.uuid() });
const rateParams = classParams.extend({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
}).strict();
const updateRateBody = z.object({
  amountVnd: z.number().int().min(0).max(100_000_000),
}).strict();

function validatedMonth(value: string): string {
  try {
    monthBounds(value);
    return value;
  } catch {
    throw new HttpError(400, "Invalid month (YYYY-MM, year 1000-9998).");
  }
}

async function accessibleClass(classId: string, user: NonNullable<Express.Request["authUser"]>) {
  const targetClass = await getPrisma().class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, archivedAt: true },
  });
  if (!targetClass || targetClass.archivedAt !== null) {
    throw new HttpError(404, "Class not found.");
  }
  if (user.role === "TEACHER" && (
    !user.teacherId || targetClass.teacherId !== user.teacherId
  )) {
    throw new HttpError(403, "Access denied.");
  }
  return targetClass;
}

async function effectiveRate(classId: string, month: string) {
  return getPrisma().classTuitionRate.findFirst({
    where: { classId, effectiveMonth: { lte: month } },
    select: { effectiveMonth: true, amountVnd: true },
    orderBy: [{ effectiveMonth: "desc" }, { id: "desc" }],
  });
}

/** GET /api/classes/:classId/tuition/rate?month=YYYY-MM */
tuitionRouter.get("/classes/:classId/tuition/rate", async (req, res, next) => {
  try {
    const params = classParams.safeParse(req.params);
    const query = monthQuery.safeParse(req.query);
    if (!params.success || !query.success) throw new HttpError(400, "Invalid class ID or month.");
    const month = validatedMonth(query.data.month);
    await accessibleClass(params.data.classId, req.authUser!);
    const rate = await effectiveRate(params.data.classId, month);
    res.json({ success: true, data: {
      month, currency: "VND", effectiveMonth: rate?.effectiveMonth ?? null,
      amountVnd: rate?.amountVnd ?? null,
    } });
  } catch (error) { next(error); }
});

/**
 * PUT /api/classes/:classId/tuition/rates/:month
 * ADMIN only. A rate applies from effectiveMonth onward until superseded.
 * Editing a past rate can change historical estimates. There are no invoices yet.
 */
tuitionRouter.put(
  "/classes/:classId/tuition/rates/:month",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const params = rateParams.safeParse(req.params);
      const body = updateRateBody.safeParse(req.body);
      if (!params.success || !body.success) throw new HttpError(400, "Invalid tuition rate input.");
      const month = validatedMonth(params.data.month);
      const targetClass = await accessibleClass(params.data.classId, req.authUser!);
      const saved = await getPrisma().classTuitionRate.upsert({
        where: { classId_effectiveMonth: { classId: targetClass.id, effectiveMonth: month } },
        create: { classId: targetClass.id, effectiveMonth: month, amountVnd: body.data.amountVnd },
        update: { amountVnd: body.data.amountVnd },
        select: { effectiveMonth: true, amountVnd: true },
      });
      res.json({ success: true, data: {
        classId: targetClass.id, currency: "VND", ...saved,
      } });
    } catch (error) { next(error); }
  },
);

/** GET /api/classes/:classId/tuition/monthly?month=YYYY-MM */
tuitionRouter.get("/classes/:classId/tuition/monthly", async (req, res, next) => {
  try {
    const params = classParams.safeParse(req.params);
    const query = monthQuery.safeParse(req.query);
    if (!params.success || !query.success) throw new HttpError(400, "Invalid class ID or month.");
    const month = validatedMonth(query.data.month);
    const classId = params.data.classId;
    const targetClass = await accessibleClass(classId, req.authUser!);
    const bounds = monthBounds(month);
    const prisma = getPrisma();
    const overlappingPeriod = {
      startedAt: { lt: bounds.toExclusive },
      OR: [{ endedAt: null }, { endedAt: { gt: bounds.from } }],
    };

    // Session and enrollment eligibility follow the exact M19.1 rules.
    const sessions = await prisma.classSession.findMany({
      where: { classId, startsAt: { gte: bounds.from, lt: bounds.toExclusive } },
      select: { id: true, startsAt: true, status: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    const completedIds = sessions.filter((session) => session.status === "COMPLETED").map((session) => session.id);
    const [enrollments, rate] = await Promise.all([
      prisma.enrollment.findMany({
        where: { classId, periods: { some: overlappingPeriod } },
        select: {
          id: true,
          status: true,
          student: { select: { id: true, studentCode: true, fullName: true } },
          periods: { where: overlappingPeriod, select: { startedAt: true, endedAt: true } },
          attendance: {
            where: { sessionId: { in: completedIds } },
            select: { sessionId: true, status: true },
          },
        },
      }),
      effectiveRate(classId, month),
    ]);

    const monthly = buildMonthlyAttendanceReport({ month, sessions, enrollments });
    res.json({
      success: true,
      data: {
        class: { id: targetClass.id, name: targetClass.name },
        ...buildMonthlyTuitionReport(monthly, rate),
      },
    });
  } catch (error) { next(error); }
});
