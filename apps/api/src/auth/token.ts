import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

if (new TextEncoder().encode(env.authJwtSecret).length < 32) {
  throw new Error("AUTH_JWT_SECRET must be at least 32 bytes");
}
const secret = new TextEncoder().encode(env.authJwtSecret);
const issuer = "classflow-api";
const audience = "classflow-web";
export type AllowedRole = "ADMIN" | "TEACHER";

export async function issueAccessToken(userId: string, role: AllowedRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, { issuer, audience, algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid token subject");
  return payload.sub;
}
