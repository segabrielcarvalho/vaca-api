-- CreateEnum
CREATE TYPE "RoleEnum" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "GenderEnum" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "AclScopeType" AS ENUM ('school', 'course', 'klass');

-- CreateEnum
CREATE TYPE "AclMembershipPermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('pending', 'graded', 'returned');

-- CreateEnum
CREATE TYPE "OmrTemplateVersionStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "OmrTemplatePdfGenerationStatus" AS ENUM ('queued', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "OmrTemplatePdfGenerationTrigger" AS ENUM ('create_auto', 'manual');

-- CreateEnum
CREATE TYPE "CorrectionSessionStatus" AS ENUM ('running', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CorrectionCaptureStatus" AS ENUM ('queued', 'processing', 'graded', 'needs_review', 'error', 'invalidated');

-- CreateEnum
CREATE TYPE "CorrectionCaptureReviewReason" AS ENUM ('registration_invalid', 'registration_ambiguous', 'answer_ambiguous', 'omr_error', 'manual_review');

-- CreateEnum
CREATE TYPE "CorrectionCaptureQuestionGradingOverride" AS ENUM ('auto', 'correct', 'incorrect', 'annulled');

-- CreateEnum
CREATE TYPE "AuthChannelEnum" AS ENUM ('web_admin', 'expo_mobile');

-- CreateEnum
CREATE TYPE "AuthChallengeTypeEnum" AS ENUM ('invite_email', 'login_email');

-- CreateEnum
CREATE TYPE "AuthAuditEventTypeEnum" AS ENUM ('invite_created', 'invite_sent', 'invite_started', 'invite_verified', 'invite_completed', 'invite_revoked', 'login_email_started', 'login_email_verified', 'login_email_magic_consumed', 'session_created', 'session_refreshed', 'session_revoked', 'logout');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "verifiedEmail" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "lastSession" TIMESTAMP(3),
    "role" "RoleEnum" NOT NULL,
    "gender" "GenderEnum",

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoPath" TEXT,
    "phoneE164" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "notificationPrefsJson" JSONB NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "role" "RoleEnum" NOT NULL DEFAULT 'user',
    "tokenHash" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "userId" TEXT,

    CONSTRAINT "AuthInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "AuthChallengeTypeEnum" NOT NULL,
    "channel" "AuthChannelEnum" NOT NULL,
    "email" TEXT,
    "codeHash" TEXT,
    "tokenHash" TEXT,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "userId" TEXT,
    "inviteId" TEXT,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthDevice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AuthChannelEnum" NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "AuthDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AuthChannelEnum" NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "authDeviceId" TEXT,
    "selectedSchoolId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "rotatedFromSessionId" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "eventType" "AuthAuditEventTypeEnum" NOT NULL,
    "channel" "AuthChannelEnum",
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclPermission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "AclPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclRole" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "scopeType" "AclScopeType" NOT NULL,
    "rank" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AclRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclRolePermission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "AclRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "institutionCode" TEXT NOT NULL,
    "description" TEXT,
    "bannerPath" TEXT,
    "logoFullPath" TEXT,
    "logoMarkPath" TEXT,
    "faviconPath" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerPath" TEXT,
    "logoFullPath" TEXT,
    "logoMarkPath" TEXT,
    "faviconPath" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Klass" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerPath" TEXT,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Klass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "schoolId" TEXT,
    "courseId" TEXT,
    "klassId" TEXT,

    CONSTRAINT "AclMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclMembershipPermissionOverride" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "AclMembershipPermissionEffect" NOT NULL,

    CONSTRAINT "AclMembershipPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentKlass" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "studentId" TEXT NOT NULL,
    "klassId" TEXT NOT NULL,

    CONSTRAINT "StudentKlass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT,
    "templateVersionId" TEXT,
    "klassId" TEXT NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "examId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "text" TEXT,
    "correct" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionExam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "score" DOUBLE PRECISION,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradedByAgentId" TEXT,

    CONSTRAINT "CorrectionExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "courseId" TEXT NOT NULL,
    "createdByAgentId" TEXT,
    "publishedVersionId" TEXT,

    CONSTRAINT "OmrTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrTemplateVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "OmrTemplateVersionStatus" NOT NULL DEFAULT 'draft',
    "layoutJson" JSONB NOT NULL,
    "compiledGeometryJson" JSONB NOT NULL,
    "pdfPath" TEXT,
    "previewImagePath" TEXT,
    "pdfGenerationStatus" "OmrTemplatePdfGenerationStatus" NOT NULL DEFAULT 'queued',
    "pdfGenerationError" TEXT,
    "pdfGenerationUpdatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdByAgentId" TEXT,

    CONSTRAINT "OmrTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrTemplateVersionPdfAsset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "templateVersionId" TEXT NOT NULL,
    "generationIndex" INTEGER NOT NULL,
    "status" "OmrTemplatePdfGenerationStatus" NOT NULL,
    "trigger" "OmrTemplatePdfGenerationTrigger" NOT NULL,
    "pdfPath" TEXT,
    "previewImagePath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "triggeredByAgentId" TEXT,

    CONSTRAINT "OmrTemplateVersionPdfAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "CorrectionSessionStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "startedByAgentId" TEXT,
    "examId" TEXT NOT NULL,
    "totalCaptures" INTEGER NOT NULL DEFAULT 0,
    "processedCaptures" INTEGER NOT NULL DEFAULT 0,
    "gradedCaptures" INTEGER NOT NULL DEFAULT 0,
    "needsReviewCaptures" INTEGER NOT NULL DEFAULT 0,
    "errorCaptures" INTEGER NOT NULL DEFAULT 0,
    "avgProcessingMs" DOUBLE PRECISION,
    "p95ProcessingMs" DOUBLE PRECISION,
    "manualReviewRate" DOUBLE PRECISION,
    "throughputPerMinute" DOUBLE PRECISION,

    CONSTRAINT "CorrectionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionCapture" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT,
    "submittedByAgentId" TEXT,
    "status" "CorrectionCaptureStatus" NOT NULL DEFAULT 'queued',
    "reviewReasons" "CorrectionCaptureReviewReason"[],
    "reviewNotes" TEXT,
    "resolvedByAgentId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "originalImagePath" TEXT NOT NULL,
    "rectifiedImagePath" TEXT,
    "overlayImagePath" TEXT,
    "artifactsPurgedAt" TIMESTAMP(3),
    "engineVersion" TEXT,
    "threshold" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "queueLatencyMs" INTEGER,
    "processingMs" INTEGER,
    "registrationNumber" TEXT,
    "detectionPayload" JSONB,
    "omrPayload" JSONB,
    "errorMessage" TEXT,
    "correctionExamId" TEXT,

    CONSTRAINT "CorrectionCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionCaptureReviewOverride" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "captureId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedAlternatives" INTEGER[],
    "gradingOverride" "CorrectionCaptureQuestionGradingOverride" NOT NULL DEFAULT 'auto',
    "reason" TEXT,
    "note" TEXT,
    "reviewedByAgentId" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionCaptureReviewOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionCaptureReviewAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captureId" TEXT NOT NULL,
    "actorAgentId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "CorrectionCaptureReviewAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionSessionEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "captureId" TEXT,
    "stage" TEXT NOT NULL,
    "durationMs" INTEGER,
    "payload" JSONB,

    CONSTRAINT "CorrectionSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionQuestion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "correctionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selected" INTEGER,
    "isCorrect" BOOLEAN,

    CONSTRAINT "CorrectionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_phoneE164_idx" ON "UserProfile"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "AuthInvite_tokenHash_key" ON "AuthInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthInvite_email_idx" ON "AuthInvite"("email");

-- CreateIndex
CREATE INDEX "AuthInvite_expiresAt_idx" ON "AuthInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthInvite_userId_idx" ON "AuthInvite"("userId");

-- CreateIndex
CREATE INDEX "AuthInvite_invitedByUserId_idx" ON "AuthInvite"("invitedByUserId");

-- CreateIndex
CREATE INDEX "AuthChallenge_type_expiresAt_idx" ON "AuthChallenge"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_channel_expiresAt_idx" ON "AuthChallenge"("channel", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_email_idx" ON "AuthChallenge"("email");

-- CreateIndex
CREATE INDEX "AuthChallenge_userId_idx" ON "AuthChallenge"("userId");

-- CreateIndex
CREATE INDEX "AuthChallenge_inviteId_idx" ON "AuthChallenge"("inviteId");

-- CreateIndex
CREATE INDEX "AuthDevice_userId_deviceId_idx" ON "AuthDevice"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthDevice_userId_channel_deviceId_key" ON "AuthDevice"("userId", "channel", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_authDeviceId_idx" ON "AuthSession"("authDeviceId");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_userId_createdAt_idx" ON "AuthAuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_eventType_createdAt_idx" ON "AuthAuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_registrationNumber_key" ON "Student"("schoolId", "registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AclPermission_code_key" ON "AclPermission"("code");

-- CreateIndex
CREATE INDEX "AclPermission_code_idx" ON "AclPermission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AclRole_code_key" ON "AclRole"("code");

-- CreateIndex
CREATE INDEX "AclRole_scopeType_rank_idx" ON "AclRole"("scopeType", "rank");

-- CreateIndex
CREATE INDEX "AclRolePermission_roleId_idx" ON "AclRolePermission"("roleId");

-- CreateIndex
CREATE INDEX "AclRolePermission_permissionId_idx" ON "AclRolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AclRolePermission_roleId_permissionId_key" ON "AclRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "School_institutionCode_key" ON "School"("institutionCode");

-- CreateIndex
CREATE INDEX "Course_schoolId_idx" ON "Course"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_schoolId_name_key" ON "Course"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Klass_courseId_idx" ON "Klass"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Klass_courseId_name_key" ON "Klass"("courseId", "name");

-- CreateIndex
CREATE INDEX "AclMembership_agentId_idx" ON "AclMembership"("agentId");

-- CreateIndex
CREATE INDEX "AclMembership_roleId_idx" ON "AclMembership"("roleId");

-- CreateIndex
CREATE INDEX "AclMembership_schoolId_idx" ON "AclMembership"("schoolId");

-- CreateIndex
CREATE INDEX "AclMembership_courseId_idx" ON "AclMembership"("courseId");

-- CreateIndex
CREATE INDEX "AclMembership_klassId_idx" ON "AclMembership"("klassId");

-- CreateIndex
CREATE UNIQUE INDEX "AclMembership_schoolId_agentId_key" ON "AclMembership"("schoolId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AclMembership_courseId_agentId_key" ON "AclMembership"("courseId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AclMembership_klassId_agentId_key" ON "AclMembership"("klassId", "agentId");

-- CreateIndex
CREATE INDEX "AclMembershipPermissionOverride_membershipId_idx" ON "AclMembershipPermissionOverride"("membershipId");

-- CreateIndex
CREATE INDEX "AclMembershipPermissionOverride_permissionId_idx" ON "AclMembershipPermissionOverride"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AclMembershipPermissionOverride_membershipId_permissionId_key" ON "AclMembershipPermissionOverride"("membershipId", "permissionId");

-- CreateIndex
CREATE INDEX "StudentKlass_klassId_idx" ON "StudentKlass"("klassId");

-- CreateIndex
CREATE INDEX "StudentKlass_studentId_idx" ON "StudentKlass"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentKlass_studentId_klassId_startedAt_key" ON "StudentKlass"("studentId", "klassId", "startedAt");

-- CreateIndex
CREATE INDEX "Exam_klassId_idx" ON "Exam"("klassId");

-- CreateIndex
CREATE INDEX "Exam_templateVersionId_idx" ON "Exam"("templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_klassId_title_key" ON "Exam"("klassId", "title");

-- CreateIndex
CREATE INDEX "Question_examId_idx" ON "Question"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_examId_number_key" ON "Question"("examId", "number");

-- CreateIndex
CREATE INDEX "CorrectionExam_examId_idx" ON "CorrectionExam"("examId");

-- CreateIndex
CREATE INDEX "CorrectionExam_studentId_idx" ON "CorrectionExam"("studentId");

-- CreateIndex
CREATE INDEX "CorrectionExam_gradedByAgentId_idx" ON "CorrectionExam"("gradedByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionExam_examId_studentId_attempt_key" ON "CorrectionExam"("examId", "studentId", "attempt");

-- CreateIndex
CREATE INDEX "OmrTemplate_courseId_idx" ON "OmrTemplate"("courseId");

-- CreateIndex
CREATE INDEX "OmrTemplate_createdByAgentId_idx" ON "OmrTemplate"("createdByAgentId");

-- CreateIndex
CREATE INDEX "OmrTemplate_publishedVersionId_idx" ON "OmrTemplate"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OmrTemplate_courseId_name_key" ON "OmrTemplate"("courseId", "name");

-- CreateIndex
CREATE INDEX "OmrTemplateVersion_templateId_status_idx" ON "OmrTemplateVersion"("templateId", "status");

-- CreateIndex
CREATE INDEX "OmrTemplateVersion_createdByAgentId_idx" ON "OmrTemplateVersion"("createdByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "OmrTemplateVersion_templateId_version_key" ON "OmrTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "OmrTemplateVersionPdfAsset_templateVersionId_createdAt_idx" ON "OmrTemplateVersionPdfAsset"("templateVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "OmrTemplateVersionPdfAsset_triggeredByAgentId_idx" ON "OmrTemplateVersionPdfAsset"("triggeredByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "OmrTemplateVersionPdfAsset_templateVersionId_generationInde_key" ON "OmrTemplateVersionPdfAsset"("templateVersionId", "generationIndex");

-- CreateIndex
CREATE INDEX "CorrectionSession_examId_idx" ON "CorrectionSession"("examId");

-- CreateIndex
CREATE INDEX "CorrectionSession_status_idx" ON "CorrectionSession"("status");

-- CreateIndex
CREATE INDEX "CorrectionSession_startedByAgentId_idx" ON "CorrectionSession"("startedByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionCapture_correctionExamId_key" ON "CorrectionCapture"("correctionExamId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_sessionId_idx" ON "CorrectionCapture"("sessionId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_examId_idx" ON "CorrectionCapture"("examId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_studentId_idx" ON "CorrectionCapture"("studentId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_submittedByAgentId_idx" ON "CorrectionCapture"("submittedByAgentId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_resolvedByAgentId_idx" ON "CorrectionCapture"("resolvedByAgentId");

-- CreateIndex
CREATE INDEX "CorrectionCapture_status_idx" ON "CorrectionCapture"("status");

-- CreateIndex
CREATE INDEX "CorrectionCaptureReviewOverride_captureId_idx" ON "CorrectionCaptureReviewOverride"("captureId");

-- CreateIndex
CREATE INDEX "CorrectionCaptureReviewOverride_questionId_idx" ON "CorrectionCaptureReviewOverride"("questionId");

-- CreateIndex
CREATE INDEX "CorrectionCaptureReviewOverride_reviewedByAgentId_idx" ON "CorrectionCaptureReviewOverride"("reviewedByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionCaptureReviewOverride_captureId_questionId_key" ON "CorrectionCaptureReviewOverride"("captureId", "questionId");

-- CreateIndex
CREATE INDEX "CorrectionCaptureReviewAuditLog_captureId_createdAt_idx" ON "CorrectionCaptureReviewAuditLog"("captureId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrectionCaptureReviewAuditLog_actorAgentId_idx" ON "CorrectionCaptureReviewAuditLog"("actorAgentId");

-- CreateIndex
CREATE INDEX "CorrectionSessionEvent_sessionId_createdAt_idx" ON "CorrectionSessionEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrectionSessionEvent_captureId_idx" ON "CorrectionSessionEvent"("captureId");

-- CreateIndex
CREATE INDEX "CorrectionQuestion_correctionId_idx" ON "CorrectionQuestion"("correctionId");

-- CreateIndex
CREATE INDEX "CorrectionQuestion_questionId_idx" ON "CorrectionQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionQuestion_correctionId_questionId_key" ON "CorrectionQuestion"("correctionId", "questionId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthInvite" ADD CONSTRAINT "AuthInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthInvite" ADD CONSTRAINT "AuthInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AuthInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthDevice" ADD CONSTRAINT "AuthDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_authDeviceId_fkey" FOREIGN KEY ("authDeviceId") REFERENCES "AuthDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_rotatedFromSessionId_fkey" FOREIGN KEY ("rotatedFromSessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclRolePermission" ADD CONSTRAINT "AclRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AclRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclRolePermission" ADD CONSTRAINT "AclRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AclPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Klass" ADD CONSTRAINT "Klass_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembership" ADD CONSTRAINT "AclMembership_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembership" ADD CONSTRAINT "AclMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AclRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembership" ADD CONSTRAINT "AclMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembership" ADD CONSTRAINT "AclMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembership" ADD CONSTRAINT "AclMembership_klassId_fkey" FOREIGN KEY ("klassId") REFERENCES "Klass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembershipPermissionOverride" ADD CONSTRAINT "AclMembershipPermissionOverride_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "AclMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AclMembershipPermissionOverride" ADD CONSTRAINT "AclMembershipPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AclPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentKlass" ADD CONSTRAINT "StudentKlass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentKlass" ADD CONSTRAINT "StudentKlass_klassId_fkey" FOREIGN KEY ("klassId") REFERENCES "Klass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "OmrTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_klassId_fkey" FOREIGN KEY ("klassId") REFERENCES "Klass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionExam" ADD CONSTRAINT "CorrectionExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionExam" ADD CONSTRAINT "CorrectionExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionExam" ADD CONSTRAINT "CorrectionExam_gradedByAgentId_fkey" FOREIGN KEY ("gradedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplate" ADD CONSTRAINT "OmrTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplate" ADD CONSTRAINT "OmrTemplate_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplate" ADD CONSTRAINT "OmrTemplate_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "OmrTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplateVersion" ADD CONSTRAINT "OmrTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OmrTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplateVersion" ADD CONSTRAINT "OmrTemplateVersion_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplateVersionPdfAsset" ADD CONSTRAINT "OmrTemplateVersionPdfAsset_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "OmrTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrTemplateVersionPdfAsset" ADD CONSTRAINT "OmrTemplateVersionPdfAsset_triggeredByAgentId_fkey" FOREIGN KEY ("triggeredByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionSession" ADD CONSTRAINT "CorrectionSession_startedByAgentId_fkey" FOREIGN KEY ("startedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionSession" ADD CONSTRAINT "CorrectionSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CorrectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_submittedByAgentId_fkey" FOREIGN KEY ("submittedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_resolvedByAgentId_fkey" FOREIGN KEY ("resolvedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCapture" ADD CONSTRAINT "CorrectionCapture_correctionExamId_fkey" FOREIGN KEY ("correctionExamId") REFERENCES "CorrectionExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCaptureReviewOverride" ADD CONSTRAINT "CorrectionCaptureReviewOverride_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "CorrectionCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCaptureReviewOverride" ADD CONSTRAINT "CorrectionCaptureReviewOverride_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCaptureReviewOverride" ADD CONSTRAINT "CorrectionCaptureReviewOverride_reviewedByAgentId_fkey" FOREIGN KEY ("reviewedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCaptureReviewAuditLog" ADD CONSTRAINT "CorrectionCaptureReviewAuditLog_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "CorrectionCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionCaptureReviewAuditLog" ADD CONSTRAINT "CorrectionCaptureReviewAuditLog_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionSessionEvent" ADD CONSTRAINT "CorrectionSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CorrectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionSessionEvent" ADD CONSTRAINT "CorrectionSessionEvent_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "CorrectionCapture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionQuestion" ADD CONSTRAINT "CorrectionQuestion_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "CorrectionExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionQuestion" ADD CONSTRAINT "CorrectionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
