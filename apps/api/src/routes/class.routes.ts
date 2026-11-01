
import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { requireAuth } from "../middleware/require-auth.js";

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
