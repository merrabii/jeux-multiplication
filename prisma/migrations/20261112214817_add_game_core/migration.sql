-- AlterTable
ALTER TABLE "child_profiles" ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diamonds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tableList" INTEGER[],
    "difficulty" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "targetPercent" INTEGER,
    "starsEarned" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "a" INTEGER NOT NULL,
    "b" INTEGER NOT NULL,
    "offeredChoices" INTEGER[],
    "givenAnswer" INTEGER,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_progress" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "table" INTEGER NOT NULL,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "practiceSessions" INTEGER NOT NULL DEFAULT 0,
    "challengesPassed" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multiplication_mastery" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "a" INTEGER NOT NULL,
    "b" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "multiplication_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_badges" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "starsEarned" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_sessions_childProfileId_createdAt_idx" ON "learning_sessions"("childProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "question_attempts_childProfileId_a_b_idx" ON "question_attempts"("childProfileId", "a", "b");

-- CreateIndex
CREATE INDEX "question_attempts_sessionId_idx" ON "question_attempts"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "child_progress_childProfileId_table_key" ON "child_progress"("childProfileId", "table");

-- CreateIndex
CREATE UNIQUE INDEX "multiplication_mastery_childProfileId_a_b_key" ON "multiplication_mastery"("childProfileId", "a", "b");

-- CreateIndex
CREATE UNIQUE INDEX "child_badges_childProfileId_badgeKey_key" ON "child_badges"("childProfileId", "badgeKey");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_childProfileId_day_key" ON "daily_activity"("childProfileId", "day");

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_progress" ADD CONSTRAINT "child_progress_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multiplication_mastery" ADD CONSTRAINT "multiplication_mastery_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_badges" ADD CONSTRAINT "child_badges_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
