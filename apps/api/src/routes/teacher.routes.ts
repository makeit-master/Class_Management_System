import { Router } from "express";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import { HttpError } from "../utils/http-error.js";

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole("ADMIN"));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));
export const teacherFields = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    employeeCode: optionalText(50),
    subject: optionalText(120),
    phone: optionalText(30),
    bio: optionalText(2000),
  })
  .strict();
export const createTeacherSchema = teacherFields.extend({
  password: z
    .string()
    .min(12)
    .max(72)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password must not exceed 72 bytes",
    ),
});
const updateSchema = teacherFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field");
const select = {
  id: true,
  employeeCode: true,
  subject: true,
  phone: true,
  bio: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, fullName: true, email: true, isActive: true } },
  classes: {
    select: { id: true, name: true, archivedAt: true },
    orderBy: { name: "asc" as const },
  },
} as const;
function id(value: unknown) {
  const p = z.uuid().safeParse(value);
  if (!p.success) throw new HttpError(400, "Invalid teacher ID");
  return p.data;
}
function conflict(error: unknown): unknown {
  const e = error as { code?: string };
  if (e.code === "P2002")
    return new HttpError(409, "Email or employee code is already in use");
  if (e.code === "P2025") return new HttpError(404, "Teacher not found");
  return error;
}
teacherRouter.get("/", async (req, res, next) => {
  try {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(12),
        search: z.string().trim().max(100).default(""),
      })
      .safeParse(req.query);
    if (!q.success) throw new HttpError(400, "Invalid query parameters");
    const { page, limit, search } = q.data;
    const text = { contains: search, mode: "insensitive" as const };
    const where = search
      ? {
          OR: [
            { user: { fullName: text } },
            { user: { email: text } },
            { employeeCode: text },
            { subject: text },
          ],
        }
      : {};
    const db = getPrisma();
    const [items, total] = await Promise.all([
      db.teacher.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.teacher.count({ where }),
    ]);
    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (e) {
    next(e);
  }
});
teacherRouter.get("/:id", async (req, res, next) => {
  try {
    const teacher = await getPrisma().teacher.findUnique({
      where: { id: id(req.params.id) },
      select,
    });
    if (!teacher) throw new HttpError(404, "Teacher not found");
    res.json({ success: true, data: teacher });
  } catch (e) {
    next(e);
  }
});
teacherRouter.post("/", async (req, res, next) => {
  try {
    const p = createTeacherSchema.safeParse(req.body);
    if (!p.success)
      throw new HttpError(
        400,
        p.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    const { fullName, email, password, ...profile } = p.data;
    const passwordHash = await hash(password, 12);
    const teacher = await getPrisma().$transaction((tx) =>
      tx.teacher.create({
        data: {
          ...profile,
          user: { create: { fullName, email, passwordHash, role: "TEACHER" } },
        },
        select,
      }),
    );
    res.status(201).json({ success: true, data: teacher });
  } catch (e) {
    next(conflict(e));
  }
});
teacherRouter.patch("/:id", async (req, res, next) => {
  try {
    const teacherId = id(req.params.id);
    const p = updateSchema.safeParse(req.body);
    if (!p.success)
      throw new HttpError(
        400,
        p.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    const { fullName, email, ...profile } = p.data;
    const teacher = await getPrisma().teacher.update({
      where: { id: teacherId },
      data: { ...profile, user: { update: { fullName, email } } },
      select,
    });
    res.json({ success: true, data: teacher });
  } catch (e) {
    next(conflict(e));
  }
});
for (const action of ["deactivate", "reactivate"] as const) {
  teacherRouter.patch(`/:id/${action}`, async (req, res, next) => {
    try {
      const teacherId = id(req.params.id);
      const teacher = await getPrisma().$transaction(async (tx) => {
        const found = await tx.teacher.findUnique({
          where: { id: teacherId },
          select: { userId: true },
        });
        if (!found) throw new HttpError(404, "Teacher not found");
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${found.userId} FOR UPDATE`;
        if (
          action === "deactivate" &&
          (await tx.class.count({ where: { teacherId, archivedAt: null } }))
        )
          throw new HttpError(
            409,
            "Reassign active classes before deactivating this teacher",
          );
        await tx.user.update({
          where: { id: found.userId },
          data: { isActive: action === "reactivate" },
        });
        return tx.teacher.findUniqueOrThrow({
          where: { id: teacherId },
          select,
        });
      });
      res.json({ success: true, data: teacher });
    } catch (e) {
      next(conflict(e));
    }
  });
}
