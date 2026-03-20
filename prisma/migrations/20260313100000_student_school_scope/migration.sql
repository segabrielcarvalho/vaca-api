ALTER TABLE "Student"
ADD COLUMN "schoolId" TEXT;

DO $$
DECLARE
  conflicting_students TEXT[];
BEGIN
  SELECT ARRAY_AGG(source_map."studentId" ORDER BY source_map."studentId")
  INTO conflicting_students
  FROM (
    SELECT mapped."studentId"
    FROM (
      SELECT
        "studentId",
        "schoolId"
      FROM (
        SELECT
          sk."studentId" AS "studentId",
          c."schoolId" AS "schoolId"
        FROM "StudentKlass" sk
        INNER JOIN "Klass" k ON k."id" = sk."klassId"
        INNER JOIN "Course" c ON c."id" = k."courseId"

        UNION ALL

        SELECT
          ce."studentId" AS "studentId",
          c."schoolId" AS "schoolId"
        FROM "CorrectionExam" ce
        INNER JOIN "Exam" e ON e."id" = ce."examId"
        INNER JOIN "Klass" k ON k."id" = e."klassId"
        INNER JOIN "Course" c ON c."id" = k."courseId"

        UNION ALL

        SELECT
          cc."studentId" AS "studentId",
          c."schoolId" AS "schoolId"
        FROM "CorrectionCapture" cc
        INNER JOIN "Exam" e ON e."id" = cc."examId"
        INNER JOIN "Klass" k ON k."id" = e."klassId"
        INNER JOIN "Course" c ON c."id" = k."courseId"
        WHERE cc."studentId" IS NOT NULL
      ) raw_map
    ) mapped
    GROUP BY mapped."studentId"
    HAVING COUNT(DISTINCT mapped."schoolId") > 1
  ) source_map;

  IF conflicting_students IS NOT NULL THEN
    RAISE EXCEPTION
      'Nao foi possivel migrar Student.schoolId. Alunos com vinculos em mais de uma escola: %',
      conflicting_students;
  END IF;
END $$;

UPDATE "Student" AS s
SET "schoolId" = source_map."schoolId"
FROM (
  SELECT
    mapped."studentId",
    MIN(mapped."schoolId") AS "schoolId"
  FROM (
    SELECT
      sk."studentId" AS "studentId",
      c."schoolId" AS "schoolId"
    FROM "StudentKlass" sk
    INNER JOIN "Klass" k ON k."id" = sk."klassId"
    INNER JOIN "Course" c ON c."id" = k."courseId"

    UNION ALL

    SELECT
      ce."studentId" AS "studentId",
      c."schoolId" AS "schoolId"
    FROM "CorrectionExam" ce
    INNER JOIN "Exam" e ON e."id" = ce."examId"
    INNER JOIN "Klass" k ON k."id" = e."klassId"
    INNER JOIN "Course" c ON c."id" = k."courseId"

    UNION ALL

    SELECT
      cc."studentId" AS "studentId",
      c."schoolId" AS "schoolId"
    FROM "CorrectionCapture" cc
    INNER JOIN "Exam" e ON e."id" = cc."examId"
    INNER JOIN "Klass" k ON k."id" = e."klassId"
    INNER JOIN "Course" c ON c."id" = k."courseId"
    WHERE cc."studentId" IS NOT NULL
  ) mapped
  GROUP BY mapped."studentId"
) AS source_map
WHERE s."id" = source_map."studentId";

DO $$
DECLARE
  missing_students TEXT[];
BEGIN
  SELECT ARRAY_AGG("id" ORDER BY "id")
  INTO missing_students
  FROM "Student"
  WHERE "schoolId" IS NULL;

  IF missing_students IS NOT NULL THEN
    RAISE EXCEPTION
      'Nao foi possivel migrar Student.schoolId. Alunos sem escola derivavel: %',
      missing_students;
  END IF;
END $$;

ALTER TABLE "Student"
ALTER COLUMN "schoolId" SET NOT NULL;

ALTER TABLE "Student"
ADD CONSTRAINT "Student_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

DROP INDEX "Student_registrationNumber_key";

CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

CREATE UNIQUE INDEX "Student_schoolId_registrationNumber_key"
ON "Student"("schoolId", "registrationNumber");
