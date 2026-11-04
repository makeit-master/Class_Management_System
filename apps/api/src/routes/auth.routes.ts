import { Router } from "express";
import { compare } from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { getPrisma } from "../lib/prisma.js";
import { issueAccessToken } from "../auth/token.js";
import { requireAuth } from "../middleware/require-auth.js";

import { registrationRouter } from "./registration.routes.js";

export const authRouter = Router();
authRouter.use(registrationRouter);

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(1024),
  })
  .strict();

// Prevent excessive login attempts.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts",
    },
  },
});

// Avoid significantly different bcrypt timing
// for existing and non-existing accounts.
const dummyHash =
  "$2b$12$p/bMz6zLmxEy7hfxj9YmSOJALTmfJs8Z4oDwObbqfcrw9zzzvqO62";

// POST /api/auth/login
authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid email or password format",
        },
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await getPrisma().user.findUnique({
      where: { email },
      include: {
        teacherProfile: {
          select: { id: true },
        },
      },
    });

    const validPassword = await compare(
      password,
      user?.passwordHash || dummyHash,
    );

    if (
      !user ||
      !user.isActive ||
      user.registrationStatus !== "APPROVED" ||
      !user.passwordHash ||
      !validPassword ||
      (user.role !== "TEACHER" && user.role !== "ADMIN")
    ) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
      return;
    }

    const token = await issueAccessToken(user.id, user.role);

    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: 900,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          teacherId: user.teacherProfile?.id ?? null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  res.json({
    success: true,
    data: {
      user: req.authUser,
    },
  });
});
