-- M19.3: monthly-effective tuition rates per class (VND, per PRESENT session).
CREATE TABLE "ClassTuitionRate" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "effectiveMonth" VARCHAR(7) NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassTuitionRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassTuitionRate_classId_effectiveMonth_key"
    ON "ClassTuitionRate"("classId", "effectiveMonth");
ALTER TABLE "ClassTuitionRate" ADD CONSTRAINT "ClassTuitionRate_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTuitionRate" ADD CONSTRAINT "ClassTuitionRate_amountVnd_check"
    CHECK ("amountVnd" BETWEEN 0 AND 100000000);
ALTER TABLE "ClassTuitionRate" ADD CONSTRAINT "ClassTuitionRate_month_check"
    CHECK ("effectiveMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
