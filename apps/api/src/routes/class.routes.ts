
import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import {
  requireAuth,
  requireRole,
} from "../middleware/require-auth.js";

export const classRouter = Router();

// All class endpoints require authentication.
classRouter.use(requireAuth);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

const classIdSchema = z.uuid();

// Shared selection for class responses.
const classSelect = {
  id: true,
  name: true,
  description: true,
  subject: true,
  room: true,
  teacherId: true,
  createdAt: true,
  updatedAt: true,
  teacher: {
    select: {
      id: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  },
  _count: {
    select: {
      enrollments: true,
    },
  },
} as const;

// GET /api/classes
classRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid query parameters");
    }

    const currentUser = req.authUser!;

    if (
      currentUser.role === "TEACHER" &&
      !currentUser.teacherId
    ) {
      throw new HttpError(403, "Teacher profile required");
    }

    const { page, limit, search } = parsed.data;

    const where = {
      ...(currentUser.role === "TEACHER"
        ? { teacherId: currentUser.teacherId! }
        : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const prisma = getPrisma();

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        select: classSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.class.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: classes,
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

// GET /api/classes/:id
classRouter.get("/:id", async (req, res, next) => {
  try {
    const parsedId = classIdSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      throw new HttpError(400, "Invalid class ID");
    }

    const currentUser = req.authUser!;

    if (
      currentUser.role === "TEACHER" &&
      !currentUser.teacherId
    ) {
      throw new HttpError(403, "Teacher profile required");
    }

    const classRecord = await getPrisma().class.findFirst({
      where: {
        id: parsedId.data,
        ...(currentUser.role === "TEACHER"
          ? { teacherId: currentUser.teacherId! }
          : {}),
      },
      select: classSelect,
    });

    if (!classRecord) {
      throw new HttpError(404, "Class not found");
    }

    res.json({
      success: true,
      data: classRecord,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * M15.2 - Create Class
 * POST /api/classes
 * Access: ADMIN only
 */

const createClassSchema = z
  .object({
    name: z.string().trim().min(1).max(120),

    subject: z.string().trim().max(120).nullable().optional(),

    room: z.string().trim().max(100).nullable().optional(),

    description: z.string().trim().max(2000).nullable().optional(),

    // Must reference Teacher.id, not User.id.
    teacherId: z.uuid(),
  })
  .strict();

classRouter.post(
  "/",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      // Step 1: Validate request data.
      const parsed = createClassSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new HttpError(
          400,
          "Invalid class information",
        );
      }

      const {
        name,
        subject,
        room,
        description,
        teacherId,
      } = parsed.data;

      const prisma = getPrisma();

      // Step 2: Verify teacher profile exists.
      const teacher = await prisma.teacher.findUnique({
        where: {
          id: teacherId,
        },
        select: {
          id: true,
        },
      });

      if (!teacher) {
        throw new HttpError(
          404,
          "Teacher profile not found",
        );
      }

      // Step 3: Create class in PostgreSQL.
      const createdClass = await prisma.class.create({
        data: {
          name,
          subject: subject ?? null,
          room: room ?? null,
          description: description ?? null,
          teacherId: teacher.id,
        },
        select: classSelect,
      });

      // Step 4: Return the new class.
      res.status(201).json({
        success: true,
        data: createdClass,
      });
    } catch (error) {
      next(error);
    }
  },
);
