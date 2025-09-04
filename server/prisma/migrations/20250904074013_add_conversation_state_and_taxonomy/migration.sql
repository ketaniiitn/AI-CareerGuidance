-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "avgRank" DOUBLE PRECISION,
ADD COLUMN     "degrees" TEXT,
ADD COLUMN     "exams" TEXT,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "stream" TEXT,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "targetStream" TEXT,
    "interests" TEXT,
    "rejectedStreams" TEXT,
    "userStrengths" TEXT,
    "profileType" TEXT,
    "sessionSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_conversationId_key" ON "ConversationState"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
