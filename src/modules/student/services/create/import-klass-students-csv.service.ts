import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { KlassStudentImportRowStatusEnum } from '../../enums/klass-student-import-row-status.enum';
import { ImportKlassStudentsCsvInput } from '../../inputs/import-klass-students-csv.input';
import { KlassStudentImportResultObject } from '../../objects/klass-student-import-result.object';
import { CreateKlassStudentService } from './create-klass-student.service';

type ParsedCsvRow = {
   rowNumber: number;
   values: Record<string, string>;
};

const CSV_HEADER_ALIASES: Record<
   string,
   'name' | 'registrationNumber' | 'email'
> = {
   nome: 'name',
   name: 'name',
   matricula: 'registrationNumber',
   matricula_: 'registrationNumber',
   registrationnumber: 'registrationNumber',
   registration_number: 'registrationNumber',
   email: 'email',
};

@Injectable()
export class ImportKlassStudentsCsvService {
   constructor(
      private readonly createKlassStudentService: CreateKlassStudentService,
   ) {}

   async run(
      input: ImportKlassStudentsCsvInput,
      user: AuthCurrentUser,
   ): Promise<KlassStudentImportResultObject> {
      const rows = this.parseCsv(input.csvContent);

      const resultRows: KlassStudentImportResultObject['rows'] = [];

      for (const row of rows) {
         const name = row.values.name ?? '';
         const registrationNumber = row.values.registrationNumber ?? '';
         const email = row.values.email ?? '';

         try {
            const result = await this.createKlassStudentService.runDetailed(
               {
                  klassId: input.klassId,
                  name,
                  registrationNumber,
                  email: email || undefined,
               },
               user,
            );

            resultRows.push({
               rowNumber: row.rowNumber,
               name,
               registrationNumber,
               email: email || null,
               status:
                  result.status as unknown as KlassStudentImportRowStatusEnum,
               message: null,
               studentId: result.student.studentId,
            });
         } catch (error) {
            resultRows.push({
               rowNumber: row.rowNumber,
               name: name || null,
               registrationNumber: registrationNumber || null,
               email: email || null,
               status: KlassStudentImportRowStatusEnum.error,
               message:
                  error instanceof Error
                     ? error.message
                     : 'Falha ao importar linha.',
               studentId: null,
            });
         }
      }

      return {
         totalRows: rows.length,
         processedRows: rows.length,
         createdCount: resultRows.filter(
            (row) => row.status === KlassStudentImportRowStatusEnum.created,
         ).length,
         linkedCount: resultRows.filter(
            (row) => row.status === KlassStudentImportRowStatusEnum.linked,
         ).length,
         reactivatedCount: resultRows.filter(
            (row) => row.status === KlassStudentImportRowStatusEnum.reactivated,
         ).length,
         alreadyActiveCount: resultRows.filter(
            (row) =>
               row.status === KlassStudentImportRowStatusEnum.already_active,
         ).length,
         errorCount: resultRows.filter(
            (row) => row.status === KlassStudentImportRowStatusEnum.error,
         ).length,
         rows: resultRows,
      };
   }

   private parseCsv(csvContent: string): ParsedCsvRow[] {
      const normalizedContent = csvContent.replace(/^\uFEFF/, '').trim();
      if (!normalizedContent) {
         throw new BadRequestException(
            'Informe um CSV válido para importação.',
         );
      }

      const delimiter = this.detectDelimiter(normalizedContent);
      const rawRows = this.tokenizeCsv(normalizedContent, delimiter);
      if (rawRows.length < 2) {
         throw new BadRequestException(
            'O CSV deve conter cabeçalho e ao menos uma linha de dados.',
         );
      }

      const headers = rawRows[0].map((value) => this.normalizeHeader(value));
      const mappedHeaders = headers.map((header) => CSV_HEADER_ALIASES[header]);

      if (
         !mappedHeaders.includes('name') ||
         !mappedHeaders.includes('registrationNumber')
      ) {
         throw new BadRequestException(
            'O CSV deve conter as colunas nome/name e matricula/registrationNumber.',
         );
      }

      const rows: ParsedCsvRow[] = [];
      for (let index = 1; index < rawRows.length; index += 1) {
         const rawRow = rawRows[index];
         if (rawRow.every((value) => value.trim().length === 0)) {
            continue;
         }

         const values: Record<string, string> = {};
         mappedHeaders.forEach((header, headerIndex) => {
            if (!header) return;
            values[header] = (rawRow[headerIndex] ?? '').trim();
         });

         rows.push({
            rowNumber: index + 1,
            values,
         });
      }

      return rows;
   }

   private tokenizeCsv(content: string, delimiter: string) {
      const rows: string[][] = [];
      let currentCell = '';
      let currentRow: string[] = [];
      let inQuotes = false;

      for (let index = 0; index < content.length; index += 1) {
         const char = content[index];
         const next = content[index + 1];

         if (inQuotes) {
            if (char === '"' && next === '"') {
               currentCell += '"';
               index += 1;
               continue;
            }

            if (char === '"') {
               inQuotes = false;
               continue;
            }

            currentCell += char;
            continue;
         }

         if (char === '"') {
            inQuotes = true;
            continue;
         }

         if (char === delimiter) {
            currentRow.push(currentCell);
            currentCell = '';
            continue;
         }

         if (char === '\n') {
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentCell = '';
            currentRow = [];
            continue;
         }

         if (char !== '\r') {
            currentCell += char;
         }
      }

      currentRow.push(currentCell);
      rows.push(currentRow);

      return rows;
   }

   private detectDelimiter(content: string) {
      const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
      const commaCount = (firstLine.match(/,/g) ?? []).length;
      const semicolonCount = (firstLine.match(/;/g) ?? []).length;
      return semicolonCount > commaCount ? ';' : ',';
   }

   private normalizeHeader(value: string) {
      return value
         .trim()
         .toLowerCase()
         .normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .replace(/[^a-z0-9]+/g, '_')
         .replace(/^_+|_+$/g, '');
   }
}
