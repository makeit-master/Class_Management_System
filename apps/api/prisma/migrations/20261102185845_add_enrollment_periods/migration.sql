-- CreateTable
CREATE TABLE "EnrollmentPeriod" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "EnrollmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentPeriod_enrollmentId_startedAt_idx" ON "EnrollmentPeriod"("enrollmentId", "startedAt");

-- AddForeignKey
ALTER TABLE "EnrollmentPeriod" ADD CONSTRAINT "EnrollmentPeriod_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
