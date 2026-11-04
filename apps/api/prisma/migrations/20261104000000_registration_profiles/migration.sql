-- Additive migration: legacy users remain approved; no existing profile is overwritten.
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ProfileGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
ALTER TABLE "User"
 ADD COLUMN "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'APPROVED',
 ADD COLUMN "dateOfBirth" DATE,
 ADD COLUMN "gender" "ProfileGender",
 ADD COLUMN "phone" TEXT,
 ADD COLUMN "address" TEXT,
 ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
 ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
 ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "googleSubject" TEXT,
 ADD COLUMN "verificationHash" TEXT,
 ADD COLUMN "verificationExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
CREATE UNIQUE INDEX "User_verificationHash_key" ON "User"("verificationHash");
CREATE TABLE "RegistrationReview" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
 "reviewerId" TEXT NOT NULL REFERENCES "User"("id"),
 "decision" "RegistrationStatus" NOT NULL, "assignedRole" "UserRole", "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
