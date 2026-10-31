import type { RequestHandler } from "express";
import { getPrisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { verifyAccessToken } from "../auth/token.js";

export type AuthUser = { id: string; fullName: string; email: string; role: "ADMIN" | "TEACHER"; teacherId: string | null };

declare global {
  namespace Express {
    interface Request { authUser?: AuthUser }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    if (!header || !/^Bearer\s+\S+$/.test(header)) throw new HttpError(401, "Authentication required");
    let userId: string;
    try {
      userId = await verifyAccessToken(header.replace(/^Bearer\s+/i, ""));
    } catch {
      throw new HttpError(401, "Authentication required");
    }
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, teacherProfile: { select: { id: true } } },
    });
    if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) throw new HttpError(401, "Authentication required");
    req.authUser = { id: user.id, fullName: user.fullName, email: user.email, role: user.role, teacherId: user.teacherProfile?.id ?? null };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...allowed: Array<AuthUser["role"]>): RequestHandler {
  return (req, _res, next) => {
    if (!req.authUser) return next(new HttpError(401, "Authentication required"));
    if (!allowed.includes(req.authUser.role)) return next(new HttpError(403, "Forbidden"));
    next();
  };
}

// Use after requireAuth: deny cross-teacher access even if a valid token exists.
export function assertCanManageTeacher(requestUser: AuthUser, teacherId: string): void {
  if (requestUser.role !== "ADMIN" && requestUser.teacherId !== teacherId) {
    throw new HttpError(403, "Forbidden");
  }
}
