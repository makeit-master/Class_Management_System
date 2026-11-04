import { z } from "zod";
export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(value + "T00:00:00.000Z");
        return (
          !Number.isNaN(date.valueOf()) &&
          date.toISOString().slice(0, 10) === value &&
          date <= new Date()
        );
      }, "Enter a valid birth date that is not in the future"),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[ .()-]/g, ""))
      .refine(
        (v) => /^(?:0|\+84)(?:[35789]\d{8}|2\d{9})$/.test(v),
        "Enter a valid Vietnamese phone number",
      )
      .transform((v) => (v.startsWith("0") ? "+84" + v.slice(1) : v)),
    address: z.string().trim().max(500).optional(),
    acceptTerms: z.literal(true, {
      error: "Accept the Terms of Service and Privacy Policy",
    }),
  })
  .strict();
export const registrationSchema = profileSchema
  .extend({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(12).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });
