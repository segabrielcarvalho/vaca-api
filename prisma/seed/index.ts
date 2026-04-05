import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
   AclScopeType,
   CorrectionCaptureQuestionGradingOverride,
   CorrectionCaptureReviewReason,
   CorrectionCaptureStatus,
   CorrectionSessionStatus,
   CorrectionStatus,
   Prisma,
   PrismaClient,
   RoleEnum,
} from '../../.prisma/client';
import { ACL_PERMISSION_CODES, ACL_ROLES } from './constants';

const DEMO_REVIEW = {
   course: {
      name: 'Correção Assistida',
      description: 'Curso demo para validação do fluxo de correção.',
   },
   exam: {
      title: 'VA Reviewer Demo',
      description: 'Avaliação demo para o fluxo de captura e revisão.',
   },
   capture: {
      imageUrl: 'https://placehold.co/1200x1600/png?text=VACA+Reviewer+Capture',
      reviewNotes:
         'Captura demo preparada para revisão manual durante a análise das lojas.',
      errorMessage:
         'Captura demo direcionada para revisão manual por marcações ambíguas.',
   },
   scenarios: [
      {
         key: 'apple',
         school: {
            institutionCode: 'VACAREVIEW',
            name: 'VACA Reviewer School Apple',
            description: 'Instituição demo usada para a revisão da App Store.',
         },
         reviewer: {
            email: 'reviewer@vaca.app',
            name: 'AppleStore Reviewer',
            phoneE164: '+5511000000000',
         },
         student: {
            email: 'student.demo@vaca.app',
            name: 'Student Demo Apple',
            phoneE164: '+5511888888888',
            registrationNumber: '2212144',
         },
         klass: {
            name: 'Turma Reviewer',
            description: 'Turma demo do cenário Apple Store.',
         },
      },
      {
         key: 'play',
         school: {
            institutionCode: 'VACAREVIEWPLAY',
            name: 'VACA Reviewer School Play',
            description: 'Instituição demo usada para a revisão da Play Store.',
         },
         reviewer: {
            email: 'reviewer.play@vaca.app',
            name: 'PlayStore Reviewer',
            phoneE164: '+5511000000001',
         },
         student: {
            email: 'student.demo.play@vaca.app',
            name: 'Student Demo Play',
            phoneE164: '+5511888888889',
            registrationNumber: '2212145',
         },
         klass: {
            name: 'Turma Reviewer Play Store',
            description: 'Turma demo do cenário Play Store.',
         },
      },
   ],
} as const;

const DEMO_REVIEW_QUESTION_DEFINITIONS = [
   { number: 1, correct: 1, value: 1 },
   { number: 2, correct: 3, value: 1 },
   { number: 3, correct: 2, value: 1 },
   { number: 4, correct: 4, value: 1 },
   { number: 5, correct: 1, value: 1 },
   { number: 6, correct: 5, value: 1 },
   { number: 7, correct: 2, value: 1 },
   { number: 8, correct: 4, value: 1 },
   { number: 9, correct: 3, value: 1 },
   { number: 10, correct: 1, value: 1 },
] as const;

function parseLogLevels(env: NodeJS.ProcessEnv): Prisma.LogLevel[] {
   const levels: Prisma.LogLevel[] = [];
   if (env.PRISMA_LOG_ERROR === 'true') levels.push('error');
   if (env.PRISMA_LOG_WARN === 'true') levels.push('warn');
   if (env.PRISMA_LOG_INFO === 'true') levels.push('info');
   if (env.PRISMA_LOG_QUERY === 'true') levels.push('query');
   return levels;
}

async function main(prisma: PrismaClient) {
   try {
      await seedAclCatalog(prisma);
      await createPlatformAdmin(prisma);
      await seedReviewerDemo(prisma);

      console.log('Seed finished');
   } catch (e) {
      console.error(e);
      throw e;
   }
}

async function createPlatformAdmin(prisma: PrismaClient) {
   try {
      const email = 'admin@vaca.local';
      const name = 'Admin User';

      await prisma.school.upsert({
         where: { institutionCode: 'VACA' },
         update: {
            name: 'VACA Platform',
            description: 'Instituicao padrao da plataforma para o admin global.',
            isActive: true,
         },
         create: {
            institutionCode: 'VACA',
            name: 'VACA Platform',
            description: 'Instituicao padrao da plataforma para o admin global.',
            isActive: true,
         },
      });

      const user = await prisma.user.upsert({
         where: { email },
         update: {
            role: RoleEnum.admin,
            verifiedEmail: true,
            isActive: true,
            isTest: false,
         },
         create: {
            email,
            role: RoleEnum.admin,
            verifiedEmail: true,
            isActive: true,
            isTest: false,
         },
      });

      await prisma.userProfile.upsert({
         where: { userId: user.id },
         update: {
            name,
            phoneE164: '+5500000000000',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: { email: true, push: true },
            onboardingCompletedAt: new Date(),
         },
         create: {
            userId: user.id,
            name,
            phoneE164: '+5500000000000',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: { email: true, push: true },
            onboardingCompletedAt: new Date(),
         },
      });

      await prisma.agent.upsert({
         where: { userId: user.id },
         update: {},
         create: {
            userId: user.id,
         },
      });
   } catch (e: any) {
      console.warn(e.message);
   }
}

async function seedReviewerDemo(prisma: PrismaClient) {
   const klassEditorRole = await prisma.aclRole.findUnique({
      where: { code: 'klass_editor' },
      select: { id: true },
   });

   if (!klassEditorRole) {
      throw new Error('Role ACL klass_editor nao encontrada no seed.');
   }

   for (const scenario of DEMO_REVIEW.scenarios) {
      const school = await prisma.school.upsert({
         where: { institutionCode: scenario.school.institutionCode },
         update: {
            name: scenario.school.name,
            description: scenario.school.description,
            isActive: true,
         },
         create: {
            name: scenario.school.name,
            description: scenario.school.description,
            institutionCode: scenario.school.institutionCode,
            isActive: true,
         },
      });

      const course = await prisma.course.upsert({
         where: {
            schoolId_name: {
               schoolId: school.id,
               name: DEMO_REVIEW.course.name,
            },
         },
         update: {
            description: DEMO_REVIEW.course.description,
            isActive: true,
         },
         create: {
            schoolId: school.id,
            name: DEMO_REVIEW.course.name,
            description: DEMO_REVIEW.course.description,
            isActive: true,
         },
      });

      await seedReviewerScenario(prisma, {
         schoolId: school.id,
         courseId: course.id,
         institutionCode: scenario.school.institutionCode,
         klassRoleId: klassEditorRole.id,
         scenario,
      });
   }
}

async function seedReviewerScenario(
   prisma: PrismaClient,
   input: {
      schoolId: string;
      courseId: string;
      institutionCode: string;
      klassRoleId: string;
      scenario: (typeof DEMO_REVIEW.scenarios)[number];
   },
) {
   const reviewer = await upsertDemoUser(prisma, {
      email: input.scenario.reviewer.email,
      name: input.scenario.reviewer.name,
      phoneE164: input.scenario.reviewer.phoneE164,
      role: RoleEnum.user,
      createAgent: true,
   });

   const student = await upsertDemoUser(prisma, {
      email: input.scenario.student.email,
      name: input.scenario.student.name,
      phoneE164: input.scenario.student.phoneE164,
      role: RoleEnum.user,
      createStudent: {
         schoolId: input.schoolId,
         registrationNumber: input.scenario.student.registrationNumber,
      },
   });

   const klass = await prisma.klass.upsert({
      where: {
         courseId_name: {
            courseId: input.courseId,
            name: input.scenario.klass.name,
         },
      },
      update: {
         description: input.scenario.klass.description,
         isActive: true,
      },
      create: {
         courseId: input.courseId,
         name: input.scenario.klass.name,
         description: input.scenario.klass.description,
         isActive: true,
      },
   });

   await prisma.aclMembership.deleteMany({
      where: {
         agentId: reviewer.agentId,
         OR: [
            { schoolId: input.schoolId },
            { Course: { schoolId: input.schoolId } },
            { Klass: { Course: { schoolId: input.schoolId } } },
         ],
      },
   });

   await prisma.aclMembership.upsert({
      where: {
         klassId_agentId: {
            klassId: klass.id,
            agentId: reviewer.agentId,
         },
      },
      update: {
         roleId: input.klassRoleId,
      },
      create: {
         klassId: klass.id,
         agentId: reviewer.agentId,
         roleId: input.klassRoleId,
      },
   });

   const enrollment = await prisma.studentKlass.findFirst({
      where: {
         studentId: student.studentId,
         klassId: klass.id,
         endedAt: null,
      },
      select: { id: true },
   });

   if (!enrollment) {
      await prisma.studentKlass.create({
         data: {
            studentId: student.studentId,
            klassId: klass.id,
         },
      });
   }

   const exam = await prisma.exam.upsert({
      where: {
         klassId_title: {
            klassId: klass.id,
            title: DEMO_REVIEW.exam.title,
         },
      },
      update: {
         description: DEMO_REVIEW.exam.description,
         isActive: true,
      },
      create: {
         klassId: klass.id,
         title: DEMO_REVIEW.exam.title,
         description: DEMO_REVIEW.exam.description,
         isActive: true,
      },
   });

   const questions = await Promise.all(
      DEMO_REVIEW_QUESTION_DEFINITIONS.map((question) =>
         prisma.question.upsert({
            where: {
               examId_number: {
                  examId: exam.id,
                  number: question.number,
               },
            },
            update: {
               correct: question.correct,
               value: question.value,
               isActive: true,
            },
            create: {
               examId: exam.id,
               number: question.number,
               correct: question.correct,
               value: question.value,
               isActive: true,
            },
         }),
      ),
   );

   const maxScore = DEMO_REVIEW_QUESTION_DEFINITIONS.reduce(
      (total, question) => total + question.value,
      0,
   );

   const correctionExam = await prisma.correctionExam.upsert({
      where: {
         examId_studentId: {
            examId: exam.id,
            studentId: student.studentId,
         },
      },
      update: {
         filePath: DEMO_REVIEW.capture.imageUrl,
         status: CorrectionStatus.graded,
         score: maxScore,
         gradedByAgentId: reviewer.agentId,
         metadata: {
            source: 'review-demo-seed',
            scenario: input.scenario.key,
         },
      },
      create: {
         examId: exam.id,
         studentId: student.studentId,
         filePath: DEMO_REVIEW.capture.imageUrl,
         status: CorrectionStatus.graded,
         score: maxScore,
         gradedByAgentId: reviewer.agentId,
         metadata: {
            source: 'review-demo-seed',
            scenario: input.scenario.key,
         },
      },
   });

   await Promise.all(
      questions.map((question) =>
         prisma.correctionQuestion.upsert({
            where: {
               correctionId_questionId: {
                  correctionId: correctionExam.id,
                  questionId: question.id,
               },
            },
            update: {
               selected: question.correct,
               isCorrect: true,
               isActive: true,
            },
            create: {
               correctionId: correctionExam.id,
               questionId: question.id,
               selected: question.correct,
               isCorrect: true,
               isActive: true,
            },
         }),
      ),
   );

   const existingSessions = await prisma.correctionSession.findMany({
      where: {
         examId: exam.id,
         startedByAgentId: reviewer.agentId,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
   });

   let demoSession = existingSessions[0];
   if (!demoSession) {
      demoSession = await prisma.correctionSession.create({
         data: {
            examId: exam.id,
            startedByAgentId: reviewer.agentId,
            status: CorrectionSessionStatus.running,
         },
         select: { id: true },
      });
   }

   const obsoleteSessionIds = existingSessions
      .slice(1)
      .map((session) => session.id);

   const gradedPayload = buildDemoOmrPayload(
      input.scenario.student.registrationNumber,
   );
   const captureGraded = await prisma.correctionCapture.upsert({
      where: {
         correctionExamId: correctionExam.id,
      },
      update: {
         sessionId: demoSession.id,
         examId: exam.id,
         studentId: student.studentId,
         submittedByAgentId: reviewer.agentId,
         resolvedByAgentId: reviewer.agentId,
         resolvedAt: new Date(),
         status: CorrectionCaptureStatus.graded,
         reviewReasons: [],
         reviewNotes: null,
         originalImagePath: DEMO_REVIEW.capture.imageUrl,
         overlayImagePath: DEMO_REVIEW.capture.imageUrl,
         registrationNumber: input.scenario.student.registrationNumber,
         omrPayload: gradedPayload,
      },
      create: {
         sessionId: demoSession.id,
         examId: exam.id,
         studentId: student.studentId,
         submittedByAgentId: reviewer.agentId,
         resolvedByAgentId: reviewer.agentId,
         resolvedAt: new Date(),
         status: CorrectionCaptureStatus.graded,
         reviewReasons: [],
         originalImagePath: DEMO_REVIEW.capture.imageUrl,
         overlayImagePath: DEMO_REVIEW.capture.imageUrl,
         registrationNumber: input.scenario.student.registrationNumber,
         correctionExamId: correctionExam.id,
         omrPayload: gradedPayload,
      },
   });

   let captureNeedsReview = await prisma.correctionCapture.findFirst({
      where: {
         sessionId: demoSession.id,
         status: CorrectionCaptureStatus.needs_review,
      },
      select: { id: true },
   });

   if (!captureNeedsReview) {
      captureNeedsReview = await prisma.correctionCapture.create({
         data: {
            sessionId: demoSession.id,
            examId: exam.id,
            submittedByAgentId: reviewer.agentId,
            status: CorrectionCaptureStatus.needs_review,
            reviewReasons: [CorrectionCaptureReviewReason.answer_ambiguous],
            reviewNotes: DEMO_REVIEW.capture.reviewNotes,
            originalImagePath: DEMO_REVIEW.capture.imageUrl,
            overlayImagePath: DEMO_REVIEW.capture.imageUrl,
            registrationNumber: input.scenario.student.registrationNumber,
            omrPayload: buildDemoOmrPayload(
               input.scenario.student.registrationNumber,
               { ambiguousQuestionNumber: 2 },
            ),
         },
         select: { id: true },
      });
   }

   const ambiguousQuestion = questions.find(
      (question) => question.number === 2,
   );
   if (ambiguousQuestion) {
      await prisma.correctionCaptureReviewOverride.upsert({
         where: {
            captureId_questionId: {
               captureId: captureNeedsReview.id,
               questionId: ambiguousQuestion.id,
            },
         },
         update: {
            selectedAlternatives: [2, 3],
            gradingOverride: CorrectionCaptureQuestionGradingOverride.auto,
            reason: 'Marcação ambígua preparada para revisão demo.',
            note: `Seed demo para reviewer das lojas (${input.scenario.key}).`,
            reviewedByAgentId: reviewer.agentId,
            reviewedAt: new Date(),
         },
         create: {
            captureId: captureNeedsReview.id,
            questionId: ambiguousQuestion.id,
            selectedAlternatives: [2, 3],
            gradingOverride: CorrectionCaptureQuestionGradingOverride.auto,
            reason: 'Marcação ambígua preparada para revisão demo.',
            note: `Seed demo para reviewer das lojas (${input.scenario.key}).`,
            reviewedByAgentId: reviewer.agentId,
            reviewedAt: new Date(),
         },
      });
   }

   let captureInvalidated = await prisma.correctionCapture.findFirst({
      where: {
         sessionId: demoSession.id,
         status: CorrectionCaptureStatus.invalidated,
      },
      select: { id: true },
   });

   if (!captureInvalidated) {
      captureInvalidated = await prisma.correctionCapture.create({
         data: {
            sessionId: demoSession.id,
            examId: exam.id,
            submittedByAgentId: reviewer.agentId,
            resolvedByAgentId: reviewer.agentId,
            resolvedAt: new Date(),
            status: CorrectionCaptureStatus.invalidated,
            reviewReasons: [CorrectionCaptureReviewReason.registration_invalid],
            reviewNotes: 'Folha ilegível - usada apenas para demonstração.',
            originalImagePath: DEMO_REVIEW.capture.imageUrl,
            omrPayload: {
               source: 'review-demo-seed',
               scenario: input.scenario.key,
            },
         },
         select: { id: true },
      });
   }

   const reviewAuditLog =
      await prisma.correctionCaptureReviewAuditLog.findFirst({
         where: {
            captureId: captureGraded.id,
            action: 'seed_review_demo_created',
         },
         select: { id: true },
      });

   if (!reviewAuditLog) {
      await prisma.correctionCaptureReviewAuditLog.create({
         data: {
            captureId: captureGraded.id,
            actorAgentId: reviewer.agentId,
            action: 'seed_review_demo_created',
            payload: {
               institutionCode: input.institutionCode,
               reviewerEmail: input.scenario.reviewer.email,
               scenario: input.scenario.key,
            },
         },
      });
   }

   await prisma.correctionSession.update({
      where: { id: demoSession.id },
      data: {
         status: CorrectionSessionStatus.completed,
         finishedAt: new Date(),
         totalCaptures: 3,
         processedCaptures: 3,
         gradedCaptures: 1,
         needsReviewCaptures: 1,
         errorCaptures: 0,
         manualReviewRate: 1 / 3,
      },
   });

   if (obsoleteSessionIds.length > 0) {
      await prisma.correctionSession.deleteMany({
         where: {
            id: {
               in: obsoleteSessionIds,
            },
         },
      });
   }
}

function buildDemoOmrPayload(
   registrationNumber: string,
   options?: {
      ambiguousQuestionNumber?: number;
   },
) {
   const answers = DEMO_REVIEW_QUESTION_DEFINITIONS.map((question) => ({
      question: question.number,
      selected:
         options?.ambiguousQuestionNumber === question.number
            ? null
            : question.correct,
      isAmbiguous: options?.ambiguousQuestionNumber === question.number,
   }));

   return {
      source: 'review-demo-seed',
      success: true,
      registration: { value: registrationNumber, status: 'valid' },
      answers,
      answers_numeric: answers.map((answer) => answer.selected),
   };
}

async function upsertDemoUser(
   prisma: PrismaClient,
   input: {
      email: string;
      name: string;
      phoneE164: string;
      role: RoleEnum;
      createAgent?: boolean;
      createStudent?: {
         schoolId: string;
         registrationNumber: string;
      };
   },
) {
   const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
         role: input.role,
         verifiedEmail: true,
         isActive: true,
         isTest: true,
      },
      create: {
         email: input.email,
         role: input.role,
         verifiedEmail: true,
         isActive: true,
         isTest: true,
      },
   });

   await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
         name: input.name,
         phoneE164: input.phoneE164,
         timezone: 'America/Sao_Paulo',
         locale: 'pt-BR',
         notificationPrefsJson: { email: true, push: true },
         onboardingCompletedAt: new Date(),
      },
      create: {
         userId: user.id,
         name: input.name,
         phoneE164: input.phoneE164,
         timezone: 'America/Sao_Paulo',
         locale: 'pt-BR',
         notificationPrefsJson: { email: true, push: true },
         onboardingCompletedAt: new Date(),
      },
   });

   let agentId: string | undefined;
   if (input.createAgent) {
      const agent = await prisma.agent.upsert({
         where: { userId: user.id },
         update: {},
         create: {
            userId: user.id,
         },
      });
      agentId = agent.id;
   }

   let studentId: string | undefined;
   if (input.createStudent) {
      const student = await prisma.student.upsert({
         where: { userId: user.id },
         update: {
            schoolId: input.createStudent.schoolId,
            registrationNumber: input.createStudent.registrationNumber,
         },
         create: {
            userId: user.id,
            schoolId: input.createStudent.schoolId,
            registrationNumber: input.createStudent.registrationNumber,
         },
      });
      studentId = student.id;
   }

   return {
      userId: user.id,
      agentId: agentId ?? '',
      studentId: studentId ?? '',
   };
}

async function seedAclCatalog(prisma: PrismaClient) {
   for (const code of ACL_PERMISSION_CODES) {
      await prisma.aclPermission.upsert({
         where: { code },
         update: {},
         create: { code },
      });
   }

   for (const role of ACL_ROLES) {
      await prisma.aclRole.upsert({
         where: { code: role.code },
         update: {
            scopeType: role.scopeType as AclScopeType,
            rank: role.rank,
            isSystem: true,
         },
         create: {
            code: role.code,
            scopeType: role.scopeType as AclScopeType,
            rank: role.rank,
            isSystem: true,
         },
      });
   }

   const permissions = await prisma.aclPermission.findMany({
      select: { id: true, code: true },
   });
   const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

   const roles = await prisma.aclRole.findMany({
      select: { id: true, code: true },
   });
   const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));

   for (const role of ACL_ROLES) {
      const roleId = roleIdByCode.get(role.code);
      if (!roleId) continue;

      for (const permissionCode of role.permissions) {
         const permissionId = permissionIdByCode.get(permissionCode);
         if (!permissionId) continue;

         await prisma.aclRolePermission.upsert({
            where: {
               roleId_permissionId: {
                  roleId,
                  permissionId,
               },
            },
            update: {},
            create: {
               roleId,
               permissionId,
            },
         });
      }
   }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
   throw new Error('DATABASE_URL deve estar definida para executar o seed.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({
   adapter,
   log: parseLogLevels(process.env),
   errorFormat:
      (process.env.PRISMA_ERROR_FORMAT as Prisma.ErrorFormat) || 'pretty',
});

main(prisma)
   .catch((e) => {
      throw e;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
