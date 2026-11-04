import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
const key = new TextEncoder().encode(env.authJwtSecret);
export const registrationSession = (id: string) =>
  new SignJWT({ purpose: "registration" })
    .setSubject(id)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("classflow-api")
    .setAudience("registration")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(key);
export async function registrationSubject(header = "") {
  const { payload } = await jwtVerify(header.replace(/^Bearer /, ""), key, {
    algorithms: ["HS256"],
    issuer: "classflow-api",
    audience: "registration",
  });
  if (!payload.sub || payload.purpose !== "registration") throw Error();
  return payload.sub;
}
