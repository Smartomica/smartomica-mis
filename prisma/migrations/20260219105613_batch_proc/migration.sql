-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "processing_jobs" ADD COLUMN     "batchId" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "document_batches" (
    "id" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ProcessingMode" NOT NULL,
    "combinedResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_batches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "document_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "document_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
