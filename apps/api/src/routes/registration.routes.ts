import { Router, type RequestHandler } from "express";
import { hash, compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { getPrisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import { HttpError } from "../utils/http-error.js";
import {
  profileSchema,
  registrationSchema,
} from "../auth/registration-validation.js";
import {
  registrationSession,
  registrationSubject,
} from "../auth/registration-session.js";
import { issueAccessToken } from "../auth/token.js";
export const registrationRouter = Router();
const limit = rateLimit({ windowMs: 900000, limit: 20 });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const safe = {
  id: true,
  fullName: true,
  email: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
  address: true,
  registrationStatus: true,
  profileCompletedAt: true,
  emailVerifiedAt: true,
  termsAcceptedAt: true,
} as const;
declare global {
  namespace Express {
    interface Request {
      registrationId?: string;
    }
  }
}
const guard: RequestHandler = async (req, _res, next) => {
  try {
    req.registrationId = await registrationSubject(req.header("authorization"));
    next();
  } catch {
    next(new HttpError(401, "Registration session expired"));
  }
};
registrationRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
registrationRouter.post("/register", limit, async (req, res, next) => {
  try {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          message: "Check the highlighted fields",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
      });
      return;
    }
    const {
      email,
      password,
      confirmPassword: _confirm,
      acceptTerms: _terms,
      dateOfBirth,
      ...profile
    } = parsed.data;
    if (Buffer.byteLength(password) > 72) {
      res.status(400).json({
        success: false,
        error: {
          message: "Check the highlighted fields",
          fields: { password: ["Use at most 72 UTF-8 bytes"] },
        },
      });
      return;
    }
    const passwordHash = await hash(password, 12);
    const generic = {
      success: true,
      data: {
        message:
          "If registration is available, check your email. Otherwise sign in or contact your administrator.",
      },
    };
    if (
      await getPrisma().user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      })
    ) {
      res.status(202).json(generic);
      return;
    }
    const webhook = process.env.REGISTRATION_EMAIL_WEBHOOK;
    if (
      !webhook?.startsWith("https://") ||
      !process.env.REGISTRATION_PUBLIC_URL
    )
      throw new HttpError(503, "Email registration is not configured");
    const token = randomBytes(32).toString("hex");
    try {
      await getPrisma().user.create({
        data: {
          ...profile,
          email,
          passwordHash,
          dateOfBirth: new Date(dateOfBirth),
          role: "STUDENT",
          isActive: false,
          registrationStatus: "PENDING",
          termsAcceptedAt: new Date(),
          profileCompletedAt: new Date(),
          verificationHash: sha(token),
          verificationExpiresAt: new Date(Date.now() + 86400000),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        res.status(202).json(generic);
        return;
      }
      throw new HttpError(503, "Registration unavailable");
    }
    const sent = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REGISTRATION_EMAIL_WEBHOOK_SECRET ?? ""}`,
      },
      body: JSON.stringify({
        email,
        verificationUrl: `${process.env.REGISTRATION_PUBLIC_URL}/#verify=${token}`,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!sent?.ok)
      throw new HttpError(
        503,
        "Email delivery failed. Contact your administrator.",
      );
    res.status(202).json(generic);
  } catch (e) {
    next(
      e instanceof HttpError
        ? e
        : new HttpError(503, "Registration service unavailable"),
    );
  }
});
registrationRouter.post("/verify-email", limit, async (req, res, next) => {
  try {
    const token = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.body.token);
    const user = await getPrisma().user.findUnique({
      where: { verificationHash: sha(token) },
    });
    if (!user) throw new HttpError(400, "Invalid verification link");
    const result = await getPrisma().user.updateMany({
      where: {
        id: user.id,
        verificationHash: sha(token),
        verificationExpiresAt: { gt: new Date() },
      },
      data: {
        emailVerifiedAt: new Date(),
        verificationHash: null,
        verificationExpiresAt: null,
      },
    });
    if (!result.count) throw new HttpError(400, "Expired verification link");
    res.json({
      success: true,
      data: { registrationToken: await registrationSession(user.id) },
    });
  } catch (e) {
    next(
      e instanceof z.ZodError
        ? new HttpError(400, "Invalid verification link")
        : e instanceof HttpError
          ? e
          : new HttpError(503, "Registration service unavailable"),
    );
  }
});
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
registrationRouter.post("/google", limit, async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new HttpError(503, "Google sign-in is not configured");
    let payload;
    try {
      ({ payload } = await jwtVerify(
        z.string().max(10000).parse(req.body.credential),
        keys,
        {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: process.env.GOOGLE_CLIENT_ID,
          algorithms: ["RS256"],
        },
      ));
    } catch {
      throw new HttpError(401, "Google verification failed");
    }
    if (
      !payload.sub ||
      payload.email_verified !== true ||
      typeof payload.email !== "string"
    )
      throw new HttpError(401, "Google verification failed");
    let user = await getPrisma().user.findUnique({
      where: { googleSubject: payload.sub },
    });
    if (!user) {
      const email = z.email().parse(payload.email).toLowerCase();
      if (
        await getPrisma().user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })
      )
        throw new HttpError(
          409,
          "Unable to link account. Use your existing sign-in method and contact your administrator.",
        );
      try {
        user = await getPrisma().user.create({
          data: {
            email,
            fullName:
              typeof payload.name === "string"
                ? payload.name.slice(0, 120)
                : "",
            googleSubject: payload.sub,
            emailVerifiedAt: new Date(),
            role: "STUDENT",
            isActive: false,
            registrationStatus: "PENDING",
          },
        });
      } catch {
        throw new HttpError(409, "Unable to register. Try signing in again.");
      }
    }
    if (
      user.registrationStatus === "APPROVED" &&
      user.isActive &&
      (user.role === "ADMIN" || user.role === "TEACHER")
    ) {
      res.json({
        success: true,
        data: { accessToken: await issueAccessToken(user.id, user.role) },
      });
      return;
    }
    res.json({
      success: true,
      data: { registrationToken: await registrationSession(user.id) },
    });
  } catch (e) {
    next(
      e instanceof HttpError
        ? e
        : new HttpError(503, "Registration service unavailable"),
    );
  }
});
registrationRouter.get("/registration", guard, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await getPrisma().user.findUnique({
        where: { id: req.registrationId! },
        select: safe,
      }),
    });
  } catch (e) {
    next(
      e instanceof HttpError
        ? e
        : new HttpError(503, "Registration service unavailable"),
    );
  }
});
registrationRouter.post(
  "/complete-profile",
  limit,
  guard,
  async (req, res, next) => {
    try {
      const p = profileSchema.safeParse(req.body);
      if (!p.success) {
        res.status(400).json({
          success: false,
          error: {
            message: "Check the highlighted fields",
            fields: z.flattenError(p.error).fieldErrors,
          },
        });
        return;
      }
      const { acceptTerms: _terms, dateOfBirth, ...profile } = p.data;
      const result = await getPrisma().user.updateMany({
        where: {
          id: req.registrationId!,
          registrationStatus: "PENDING",
          profileCompletedAt: null,
          googleSubject: { not: null },
        },
        data: {
          ...profile,
          dateOfBirth: new Date(dateOfBirth),
          termsAcceptedAt: new Date(),
          profileCompletedAt: new Date(),
        },
      });
      if (!result.count)
        throw new HttpError(409, "Profile cannot be changed in this state");
      res.json({ success: true, data: { message: "Profile submitted" } });
    } catch (e) {
      next(
        e instanceof HttpError
          ? e
          : new HttpError(503, "Registration service unavailable"),
      );
    }
  },
);
registrationRouter.get(
  "/registrations",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      res.json({
        success: true,
        data: await getPrisma().user.findMany({
          where: { registrationStatus: "PENDING" },
          select: safe,
          take: 100,
          orderBy: { createdAt: "asc" },
        }),
      });
    } catch (e) {
      next(
        e instanceof HttpError
          ? e
          : new HttpError(503, "Registration service unavailable"),
      );
    }
  },
);
registrationRouter.post(
  "/registrations/:id/review",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const input = z
        .discriminatedUnion("decision", [
          z
            .object({
              decision: z.literal("APPROVED"),
              role: z.literal("TEACHER"),
            })
            .strict(),
          z.object({ decision: z.literal("REJECTED") }).strict(),
        ])
        .parse(req.body);
      await getPrisma().$transaction(async (tx) => {
        const id = String(req.params.id);
        const approved = input.decision === "APPROVED";
        const result = await tx.user.updateMany({
          where: {
            id,
            registrationStatus: "PENDING",
            ...(approved
              ? {
                  profileCompletedAt: { not: null },
                  emailVerifiedAt: { not: null },
                  termsAcceptedAt: { not: null },
                  dateOfBirth: { not: null },
                  gender: { not: null },
                  phone: { not: null },
                }
              : {}),
          },
          data: {
            registrationStatus: input.decision,
            isActive: approved,
            ...(approved ? { role: "TEACHER" } : {}),
          },
        });
        if (!result.count)
          throw new HttpError(
            409,
            "Registration incomplete or already reviewed",
          );
        if (approved)
          await tx.teacher.upsert({
            where: { userId: id },
            create: { userId: id },
            update: {},
          });
        await tx.registrationReview.create({
          data: {
            userId: id,
            reviewerId: req.authUser!.id,
            decision: input.decision,
            assignedRole: approved ? "TEACHER" : null,
          },
        });
      });
      res.json({ success: true, data: { message: "Review recorded" } });
    } catch (e) {
      next(
        e instanceof z.ZodError
          ? new HttpError(400, "Only Teacher access can be assigned")
          : e instanceof HttpError
            ? e
            : new HttpError(503, "Registration service unavailable"),
      );
    }
  },
);

registrationRouter.post(
  "/registration-login",
  limit,
  async (req, res, next) => {
    try {
      const p = z
        .object({
          email: z.string().trim().toLowerCase().pipe(z.email()),
          password: z.string().min(1).max(1024),
        })
        .parse(req.body);
      const user = await getPrisma().user.findUnique({
        where: { email: p.email },
      });
      const valid = await compare(
        p.password,
        user?.passwordHash ??
          "$2b$12$p/bMz6zLmxEy7hfxj9YmSOJALTmfJs8Z4oDwObbqfcrw9zzzvqO62",
      );
      if (!user || !user.passwordHash || !valid)
        throw new HttpError(401, "Invalid email or password");
      res.json({
        success: true,
        data: { registrationToken: await registrationSession(user.id) },
      });
    } catch (e) {
      next(
        e instanceof z.ZodError
          ? new HttpError(400, "Invalid email or password")
          : e instanceof HttpError
            ? e
            : new HttpError(503, "Registration service unavailable"),
      );
    }
  },
);
