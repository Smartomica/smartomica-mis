/*
  Warnings:

  - The values [OCR_ONLY,TRANSLATE_ONLY,OCR_AND_TRANSLATE] on the enum `ProcessingMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProcessingMode_new" AS ENUM ('TRANSLATE', 'TRANSLATE_JUR', 'OCR', 'SUMMARISE', 'SUMMARISE_ONCO');
ALTER TABLE "documents" ALTER COLUMN "mode" TYPE "ProcessingMode_new" USING ("mode"::text::"ProcessingMode_new");
ALTER TYPE "ProcessingMode" RENAME TO "ProcessingMode_old";
ALTER TYPE "ProcessingMode_new" RENAME TO "ProcessingMode";
DROP TYPE "public"."ProcessingMode_old";
COMMIT;
