import { RoleEnum } from '../../../../../../.prisma/client';
import { KlassStudentImportRowStatusEnum } from '../../../enums/klass-student-import-row-status.enum';
import { ImportKlassStudentsCsvService } from '../../create/import-klass-students-csv.service';

describe('ImportKlassStudentsCsvService', () => {
   let createKlassStudentService: {
      runDetailed: jest.Mock;
   };
   let service: ImportKlassStudentsCsvService;

   beforeEach(() => {
      createKlassStudentService = {
         runDetailed: jest.fn().mockResolvedValue({
            status: 'created',
            student: {
               studentId: 'student-1',
            },
         }),
      };

      service = new ImportKlassStudentsCsvService(
         createKlassStudentService as never,
      );
   });

   it('reconhece a coluna e-mail e envia o email real para criacao do aluno', async () => {
      const result = await service.run(
         {
            klassId: 'klass-1',
            csvContent:
               'nome,matricula,e-mail\nBruno Silva,2520226,bruno@example.com',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(createKlassStudentService.runDetailed).toHaveBeenCalledWith(
         {
            klassId: 'klass-1',
            name: 'Bruno Silva',
            registrationNumber: '2520226',
            email: 'bruno@example.com',
         },
         { id: 'user-1', role: RoleEnum.user },
      );
      expect(result.createdCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.rows).toEqual([
         expect.objectContaining({
            rowNumber: 2,
            email: 'bruno@example.com',
            status: KlassStudentImportRowStatusEnum.created,
            studentId: 'student-1',
         }),
      ]);
   });

   it('permite reimportar a mesma matricula quando o cadastro ja esta ativo', async () => {
      createKlassStudentService.runDetailed.mockResolvedValue({
         status: 'already_active',
         student: {
            studentId: 'student-1',
         },
      });

      const result = await service.run(
         {
            klassId: 'klass-1',
            csvContent:
               'nome,matricula,e-mail\nNome Novo,2520226,novo@example.com',
         },
         { id: 'user-1', role: RoleEnum.user } as never,
      );

      expect(result.alreadyActiveCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.rows[0]).toEqual(
         expect.objectContaining({
            name: 'Nome Novo',
            registrationNumber: '2520226',
            email: 'novo@example.com',
            status: KlassStudentImportRowStatusEnum.already_active,
         }),
      );
   });
});
