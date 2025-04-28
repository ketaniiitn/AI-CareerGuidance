/*
  Warnings:

  - You are about to drop the column `answer` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `context` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `followUpQuestion` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `question` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `references` on the `Conversation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "answer",
DROP COLUMN "context",
DROP COLUMN "followUpQuestion",
DROP COLUMN "question",
DROP COLUMN "references";

-- CreateTable
CREATE TABLE "ConversationHistory" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "followUpQuestion" TEXT NOT NULL,
    "references" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationHistory_conversationId_key" ON "ConversationHistory"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationHistory" ADD CONSTRAINT "ConversationHistory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
