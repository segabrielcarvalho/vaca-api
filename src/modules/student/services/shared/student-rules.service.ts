import { randomUUID } from 'node:crypto';
import {
   BadRequestException,
   ConflictException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AclScopeType, Prisma, type User } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { KlassStudentObject } from '../../objects/klass-student.object';

type StudentWithKlassEnrollment = Prisma.StudentGetPayload<{
   include: {
      User: {
         select: {
            id: true;
            email: true;
            Profile: {
               select: {
                  name: true;
               };
            };
            Agent: {
               select: {
                  id: true;
               };
            };
         };
      };
      Enrollments: {
         select: {
            startedAt: true;
            endedAt: true;
         };
      };
   };
}>;

type KlassContext = {
   klassId: string;
   courseId: string;
   schoolId: string;
};

type StudentUserRecord = Pick<User, 'id'> & {
   Agent?: { id: string } | null;
   Student?: {
      id: string;
      schoolId: string;
      registrationNumber: string;
   } | null;
};

const REGISTRATION_REGEX = /^[A-Z0-9._-]{3,32}$/;
const EMAIL_TECHNICAL_DOMAIN = 'no-login.local';
const DEFAULT_PROFILE_PHONE = '+5500000000000';
const DEFAULT_PROFILE_TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_PROFILE_LOCALE = 'pt-BR';

@Injectable()
export class StudentRulesService {
   constructor(
      readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   normalizeName(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException('Nome do aluno deve ser uma string.');
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      if (normalized.length < 3) {
         throw new BadRequestException(
            'Nome do aluno deve ter ao menos 3 caracteres.',
         );
      }

      if (normalized.length > 120) {
         throw new BadRequestException(
            'Nome do aluno deve ter no máximo 120 caracteres.',
         );
      }

      return normalized;
   }

   normalizeRegistration(value: unknown): string {
      if (typeof value !== 'string') {
         throw new BadRequestException('Matrícula deve ser uma string.');
      }

      const normalized = value.trim().toUpperCase();
      if (!REGISTRATION_REGEX.test(normalized)) {
         throw new BadRequestException(
            'Matrícula inválida. Use de 3 a 32 caracteres alfanuméricos.',
         );
      }

      return normalized;
   }

   normalizeOptionalEmail(value: unknown): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string') {
         throw new BadRequestException('Email deve ser uma string.');
      }

      const normalized = value.trim().toLowerCase();
      if (!normalized) return null;

      return normalized;
   }

   async assertKlassPermission(input: {
      user: AuthCurrentUser;
      klassId: string;
      permissionCode: string;
   }) {
      await this.scopedAccessService.assertPermission({
         user: input.user,
         permissionCode: input.permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: input.klassId,
      });
   }

   async resolveKlassContext(klassId: string): Promise<KlassContext> {
      const klass = await this.prisma.klass.findUnique({
         where: { id: klassId },
         select: {
            id: true,
            courseId: true,
            Course: {
               select: {
                  schoolId: true,
               },
            },
         },
      });

      if (!klass) {
         throw new NotFoundException('Turma não encontrada.');
      }

      return {
         klassId: klass.id,
         courseId: klass.courseId,
         schoolId: klass.Course.schoolId,
      };
   }

   async assertStudentSameSchool(studentId: string, schoolId: string) {
      const student = await this.prisma.student.findUnique({
         where: {
            id: studentId,
         },
         select: {
            schoolId: true,
         },
      });

      if (!student) {
         throw new NotFoundException('Aluno não encontrado.');
      }

      if (student.schoolId !== schoolId) {
         throw new BadRequestException(
            'Aluno não pertence à mesma escola da turma selecionada.',
         );
      }
   }

   async assertUserCanBeStudent(
      user: Pick<User, 'id'> & { Agent?: { id: string } | null },
   ) {
      if (user.Agent?.id) {
         throw new BadRequestException(
            'O e-mail informado já pertence a um colaborador da instituição.',
         );
      }
   }

   async assertRegistrationAvailable(
      schoolId: string,
      registrationNumber: string,
      ignoreStudentId?: string,
   ) {
      const duplicate = await this.prisma.student.findFirst({
         where: {
            schoolId,
            registrationNumber,
            ...(ignoreStudentId ? { id: { not: ignoreStudentId } } : {}),
         },
         select: {
            id: true,
         },
      });

      if (duplicate) {
         throw new ConflictException(
            'Já existe um aluno com esta matrícula na escola selecionada.',
         );
      }
   }

   async findStudentBySchoolAndRegistration(
      schoolId: string,
      registrationNumber: string,
   ) {
      return this.prisma.student.findUnique({
         where: {
            schoolId_registrationNumber: {
               schoolId,
               registrationNumber,
            },
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  Profile: {
                     select: {
                        name: true,
                     },
                  },
                  Agent: {
                     select: {
                        id: true,
                     },
                  },
               },
            },
            Enrollments: {
               select: {
                  id: true,
                  startedAt: true,
                  endedAt: true,
                  klassId: true,
               },
               orderBy: {
                  startedAt: 'desc',
               },
            },
         },
      });
   }

   async findUserByEmail(email: string): Promise<StudentUserRecord | null> {
      return this.prisma.user.findUnique({
         where: { email },
         select: {
            id: true,
            Agent: {
               select: {
                  id: true,
               },
            },
            Student: {
               select: {
                  id: true,
                  schoolId: true,
                  registrationNumber: true,
               },
            },
         },
      });
   }

   async resolveAccessibleKlassIds(
      klassIds: string[],
      user: AuthCurrentUser,
      permissionCode: string,
   ) {
      const uniqueIds = [...new Set(klassIds.filter(Boolean))];
      const allowedIds: string[] = [];

      for (const klassId of uniqueIds) {
         try {
            await this.assertKlassPermission({
               user,
               klassId,
               permissionCode,
            });
            allowedIds.push(klassId);
         } catch {
            continue;
         }
      }

      return new Set(allowedIds);
   }

   async generateTechnicalEmail(registrationNumber: string, schoolId: string) {
      const registrationSlug = registrationNumber
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, '-')
         .replace(/^-+|-+$/g, '')
         .slice(0, 24);
      const schoolSlug = schoolId
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, '')
         .slice(0, 12);

      for (let attempt = 0; attempt < 5; attempt += 1) {
         const suffix =
            attempt === 0
               ? randomUUID().slice(0, 6)
               : randomUUID().slice(0, 10);
         const email = `student.${registrationSlug || 'reg'}.${schoolSlug || 'school'}.${suffix}@${EMAIL_TECHNICAL_DOMAIN}`;

         const existing = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
         });

         if (!existing) {
            return email;
         }
      }

      throw new BadRequestException(
         'Não foi possível gerar email técnico para o aluno.',
      );
   }

   async upsertProfileName(userId: string, name: string) {
      await this.prisma.userProfile.upsert({
         where: { userId },
         create: {
            userId,
            name,
            phoneE164: DEFAULT_PROFILE_PHONE,
            timezone: DEFAULT_PROFILE_TIMEZONE,
            locale: DEFAULT_PROFILE_LOCALE,
            notificationPrefsJson: {} as Prisma.InputJsonValue,
         },
         update: {
            name,
         },
      });
   }

   async getStudentInKlass(
      studentId: string,
      klassId: string,
      schoolId: string,
   ) {
      const student = await this.prisma.student.findFirst({
         where: {
            id: studentId,
            schoolId,
            Enrollments: {
               some: {
                  klassId,
               },
            },
         },
         include: {
            User: {
               select: {
                  id: true,
                  email: true,
                  Profile: {
                     select: {
                        name: true,
                     },
                  },
                  Agent: {
                     select: {
                        id: true,
                     },
                  },
               },
            },
            Enrollments: {
               where: {
                  klassId,
               },
               select: {
                  startedAt: true,
                  endedAt: true,
               },
               orderBy: {
                  startedAt: 'desc',
               },
            },
         },
      });

      if (!student) {
         throw new NotFoundException(
            'Aluno não encontrado para a turma selecionada.',
         );
      }

      return this.mapKlassStudentObject(student, klassId, schoolId);
   }

   mapKlassStudentObject(
      student: StudentWithKlassEnrollment,
      klassId: string,
      schoolId: string,
   ): KlassStudentObject {
      const activeEnrollment =
         student.Enrollments.find((enrollment) => !enrollment.endedAt) ?? null;
      const latestEnrollment =
         activeEnrollment ?? student.Enrollments[0] ?? null;

      return {
         studentId: student.id,
         userId: student.User.id,
         registrationNumber: student.registrationNumber,
         name: student.User.Profile?.name ?? null,
         email: student.User.email,
         klassId,
         schoolId,
         enrollmentActive: Boolean(activeEnrollment),
         enrollmentStartedAt: latestEnrollment?.startedAt ?? null,
         enrollmentEndedAt: latestEnrollment?.endedAt ?? null,
         createdAt: student.createdAt,
         updatedAt: student.updatedAt,
         enrollments: student.Enrollments.map((enrollment) => ({
            startedAt: enrollment.startedAt,
            endedAt: enrollment.endedAt,
            active: !enrollment.endedAt,
         })),
      };
   }
}
