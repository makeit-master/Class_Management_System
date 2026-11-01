-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Class_archivedAt_idx" ON "Class"("archivedAt");
