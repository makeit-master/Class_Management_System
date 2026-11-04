ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Lock the account row for assignment and deactivation to serialize concurrent writes.
CREATE FUNCTION enforce_active_class_teacher() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active BOOLEAN;
BEGIN
  IF NEW."archivedAt" IS NULL THEN
    SELECT u."isActive" INTO active FROM "User" u JOIN "Teacher" t ON t."userId" = u.id
      WHERE t.id = NEW."teacherId" FOR UPDATE OF u;
    IF active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Only active teachers can be assigned to active classes' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER active_class_teacher BEFORE INSERT OR UPDATE OF "teacherId", "archivedAt" ON "Class"
FOR EACH ROW EXECUTE FUNCTION enforce_active_class_teacher();

CREATE FUNCTION prevent_assigned_teacher_deactivation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."isActive" = false AND EXISTS (
    SELECT 1 FROM "Teacher" t JOIN "Class" c ON c."teacherId" = t.id
    WHERE t."userId" = NEW.id AND c."archivedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Reassign active classes before deactivating this teacher' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER teacher_deactivation BEFORE UPDATE OF "isActive" ON "User"
FOR EACH ROW EXECUTE FUNCTION prevent_assigned_teacher_deactivation();
