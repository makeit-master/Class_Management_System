import { Router } from "express";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";

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
      enrollments: {
        where: {
          status: "ACTIVE",
        },
      },
    },
  },
  archivedAt: true,
} as const;

// GET /api/classes
classRouter.get("/", async (req, res, next) => {
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

/**
 * M15.5.3 - Teacher options for class creation
 * GET /api/classes/teacher-options
 * Access: ADMIN only
 */
classRouter.get(
  "/teacher-options",
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      const prisma = getPrisma();

      const teachers = await prisma.teacher.findMany({
        select: {
          id: true,
          employeeCode: true,
          subject: true,
          user: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          user: {
            fullName: "asc",
          },
        },
      });

      res.status(200).json({
        success: true,
        data: teachers.map((teacher) => ({
          id: teacher.id,
          fullName: teacher.user.fullName,
          employeeCode: teacher.employeeCode,
          subject: teacher.subject,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * M15.6.1 - Archived Classes List
 * GET /api/classes/archived
 * Access: ADMIN only
 */
classRouter.get("/archived", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid query parameters");
    }

    const { page, limit, search } = parsed.data;
    const prisma = getPrisma();

    const where = {
      archivedAt: { not: null },
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        select: classSelect,
        orderBy: {
          archivedAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.class.count({ where }),
    ]);

    res.status(200).json({
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

    if (currentUser.role === "TEACHER" && !currentUser.teacherId) {
      throw new HttpError(403, "Teacher profile required");
    }

    const classRecord = await getPrisma().class.findFirst({
      where: {
        id: parsedId.data,
        archivedAt: null,

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

classRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    // Step 1: Validate request data.
    const parsed = createClassSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid class information");
    }

    const { name, subject, room, description, teacherId } = parsed.data;

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
      throw new HttpError(404, "Teacher profile not found");
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
});

/**
 * M15.3 - Update Class
 * PATCH /api/classes/:id
 * Access: ADMIN only
 */

// Validate only the fields being updated.
const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),

    subject: z.string().trim().max(120).nullable().optional(),

    room: z.string().trim().max(100).nullable().optional(),

    description: z.string().trim().max(2000).nullable().optional(),

    // Must reference Teacher.id, not User.id.
    teacherId: z.uuid().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

classRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    // Step 1: Validate class ID.
    const parsedId = z.uuid().safeParse(req.params.id);

    if (!parsedId.success) {
      throw new HttpError(400, "Invalid class ID");
    }

    // Step 2: Validate request body.
    const parsedBody = updateClassSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new HttpError(400, "Invalid class update information");
    }

    const prisma = getPrisma();
    const classId = parsedId.data;
    const updateData = parsedBody.data;

    // Step 3: Confirm class exists.
    const existingClass = await prisma.class.findUnique({
      where: {
        id: classId,
      },
      select: {
        id: true,
        archivedAt: true,
      },
    });

    if (!existingClass) {
      throw new HttpError(404, "Class not found");
    }

    if (existingClass.archivedAt !== null) {
      throw new HttpError(409, "Archived classes cannot be updated");
    }

    // Step 4: Validate new teacher assignment.
    if (updateData.teacherId !== undefined) {
      const teacher = await prisma.teacher.findUnique({
        where: {
          id: updateData.teacherId,
        },
        select: {
          id: true,
        },
      });

      if (!teacher) {
        throw new HttpError(404, "Teacher profile not found");
      }
    }

    // Step 5: Update class in PostgreSQL.

    const updateResult = await prisma.class.updateMany({
      where: {
        id: classId,
        archivedAt: null,
      },
      data: updateData,
    });

    if (updateResult.count === 0) {
      throw new HttpError(409, "Class is no longer available for updating");
    }

    const updatedClass = await prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: classSelect,
    });

    // Step 6: Return updated information.
    res.status(200).json({
      success: true,
      data: updatedClass,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * M15.4 - Soft Archive Class
 * PATCH /api/classes/:id/archive
 * Access: ADMIN only
 */
classRouter.patch(
  "/:id/archive",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const parsedId = z.uuid().safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "Invalid class ID");
      }

      const prisma = getPrisma();
      const classId = parsedId.data;

      // Only archive classes that are still active.
      await prisma.class.updateMany({
        where: {
          id: classId,
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      // Find the class whether newly or previously archived.
      const archivedClass = await prisma.class.findUnique({
        where: {
          id: classId,
        },
        select: classSelect,
      });

      if (!archivedClass) {
        throw new HttpError(404, "Class not found");
      }

      res.status(200).json({
        success: true,
        data: archivedClass,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * M15.6.1 - Restore Class
 * PATCH /api/classes/:id/restore
 * Access: ADMIN only
 */
classRouter.patch(
  "/:id/restore",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const parsedId = classIdSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "Invalid class ID");
      }

      const prisma = getPrisma();
      const classId = parsedId.data;

      // Restore only archived classes.
      await prisma.class.updateMany({
        where: {
          id: classId,
          archivedAt: {
            not: null,
          },
        },
        data: {
          archivedAt: null,
        },
      });

      // Supports repeated restore requests.
      const restoredClass = await prisma.class.findUnique({
        where: {
          id: classId,
        },
        select: classSelect,
      });

      if (!restoredClass) {
        throw new HttpError(404, "Class not found");
      }

      res.status(200).json({
        success: true,
        data: restoredClass,
      });
    } catch (error) {
      next(error);
    }
  },
);
