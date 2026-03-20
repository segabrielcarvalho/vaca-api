import { Injectable, NotFoundException } from '@nestjs/common';
import { AclScopeType } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CorrectionAccessService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async assertExamPermission(
      examId: string,
      user: AuthCurrentUser,
      permissionCode: string,
   ) {
      const exam = await this.prisma.exam.findUnique({
         where: { id: examId },
         select: {
            id: true,
            klassId: true,
            Klass: {
               select: {
                  Course: {
                     select: {
                        schoolId: true,
                     },
                  },
               },
            },
         },
      });

      if (!exam) {
         throw new NotFoundException('Prova não encontrada.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: exam.klassId,
      });

      return exam;
   }

   async assertSessionPermission(
      sessionId: string,
      user: AuthCurrentUser,
      permissionCode: string,
   ) {
      const session = await this.prisma.correctionSession.findUnique({
         where: { id: sessionId },
         select: {
            id: true,
            examId: true,
            Exam: {
               select: {
                  klassId: true,
               },
            },
         },
      });

      if (!session) {
         throw new NotFoundException('Sessão de correção não encontrada.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: session.Exam.klassId,
      });

      return session;
   }

   async assertCapturePermission(
      captureId: string,
      user: AuthCurrentUser,
      permissionCode: string,
   ) {
      const capture = await this.prisma.correctionCapture.findUnique({
         where: { id: captureId },
         select: {
            id: true,
            sessionId: true,
            examId: true,
            Exam: {
               select: {
                  klassId: true,
               },
            },
         },
      });

      if (!capture) {
         throw new NotFoundException('Capture não encontrado.');
      }

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: capture.Exam.klassId,
      });

      return capture;
   }
}
