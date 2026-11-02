import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/require-auth.js";

export const sessionRouter = Router();

const uuidSchema = z.uuid();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

// GET /api/classes/:classId/sessions
sessionRouter.get(
  "/classes/:classId/sessions",
  requireAuth,
  async (req, res, next) => {
    try {
      const prisma = getPrisma();

      const idResult = uuidSchema.safeParse(req.params.classId);

      if (!idResult.success) {
        res.status(400).json({
          success: false,
          message: "Invalid class ID.",
        });
        return;
      }

      const queryResult = listQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          message: "Invalid session query parameters.",
        });
        return;
      }

      const { page, limit, status, from, to } = queryResult.data;

      if (from && to && new Date(from) > new Date(to)) {
        res.status(400).json({
          success: false,
          message: "from must be earlier than or equal to to.",
        });
        return;
      }

      const targetClass = await prisma.class.findUnique({
        where: { id: idResult.data },
        select: {
          id: true,
          teacherId: true,
          archivedAt: true,
        },
      });

      if (!targetClass || targetClass.archivedAt !== null) {
        res.status(404).json({
          success: false,
          message: "Class not found.",
        });
        return;
      }

      const currentUser = req.authUser!;

      if (
        currentUser.role === "TEACHER" &&
        targetClass.teacherId !== currentUser.teacherId
      ) {
        res.status(403).json({
          success: false,
          message: "Access denied.",
        });
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
              select: { attendance: true },
            },
          },
        }),
        prisma.classSession.count({ where }),
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

// GET /api/sessions/:id
sessionRouter.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const prisma = getPrisma();

    const idResult = uuidSchema.safeParse(req.params.id);

    if (!idResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid session ID.",
      });
      return;
    }

    const session = await prisma.classSession.findUnique({
      where: { id: idResult.data },
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
          select: { attendance: true },
        },
      },
    });

    if (!session || session.class.archivedAt !== null) {
      res.status(404).json({
        success: false,
        message: "Session not found.",
      });
      return;
    }

    const currentUser = req.authUser!;

    if (
      currentUser.role === "TEACHER" &&
      session.class.teacherId !== currentUser.teacherId
    ) {
      res.status(403).json({
        success: false,
        message: "Access denied.",
      });
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
