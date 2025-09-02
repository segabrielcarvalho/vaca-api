import {
   CreateBucketCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   HeadBucketCommand,
   HeadObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
   S3Client,
   type HeadObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import { Mime } from 'mime';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import getMimeTypeByBase64 from '../../../../utils/getMimeTypeByBase64';
import IS3Provider from './s3.interface';

export interface S3Config {
   bucket: string;
   region: string;
   endpoint?: string;
   credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
   };
}

const mime = new Mime();

export default class S3Provider implements IS3Provider {
   private readonly client: S3Client;
   private readonly bucketName: string;
   private initializedBucket = false;

   constructor(private readonly config: S3Config) {
      const { region, credentials, endpoint, bucket } = this.config;

      if (!region) throw new Error('S3 client: "region" não foi definida.');

      this.client = new S3Client({
         region,
         credentials,
         endpoint,
         forcePathStyle: true,
      });

      this.bucketName = bucket;
   }

   private async initBucket() {
      if (this.initializedBucket) return;

      try {
         await this.client.send(
            new HeadBucketCommand({ Bucket: this.bucketName }),
         );
      } catch {
         console.warn(`Bucket "${this.bucketName}" não encontrado. Criando…`);
         await this.client.send(
            new CreateBucketCommand({ Bucket: this.bucketName }),
         );
      }
      this.initializedBucket = true;
   }

   private async beforeEach() {
      await this.initBucket();
   }

   private buildKey(fileName: string, folder?: string) {
      return folder ? `${folder.replace(/\/$/, '')}/${fileName}` : fileName;
   }

   public async saveFileFromBase64(
      fileInBase64: string,
      folder?: string,
   ): Promise<string> {
      await this.beforeEach();

      const base64Clean = fileInBase64.replace(/^data:.+;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');

      const contentType = getMimeTypeByBase64(fileInBase64);
      const extension = mime.getExtension(contentType) ?? 'bin';
      const fileName = `${randomBytes(8).toString('hex')}.${extension}`;
      const key = this.buildKey(fileName, folder);

      await this.client.send(
         new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentEncoding: 'base64',
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000, public',
            ACL: 'private',
            Metadata: {
               'x-amz-meta-original-filename': fileName,
            },
         }),
      );

      return key;
   }

   public async saveFileFromBuffer(
      buffer: Buffer,
      folder?: string,
   ): Promise<string> {
      await this.beforeEach();

      const result = await fileTypeFromBuffer(buffer);
      if (!result) throw new Error('Tipo de arquivo desconhecido.');
      const { mime: mimeType } = result;

      const extension = mimeType.split('/')[1] || 'bin';
      const fileName = `${randomBytes(8).toString('hex')}.${extension}`;
      const key = this.buildKey(fileName, folder);

      await this.client.send(
         new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            ContentDisposition: 'inline',
            Metadata: {
               'x-amz-meta-original-filename': fileName,
            },
            CacheControl: 'max-age=31536000, public',
            ACL: 'private',
         }),
      );

      return key;
   }

   public async getMetadata(
      key: string,
   ): Promise<{ size: number; mimeType: string }> {
      await this.beforeEach();

      const params: HeadObjectCommandInput = {
         Bucket: this.bucketName,
         Key: key,
      };
      try {
         const { ContentLength, ContentType } = await this.client.send(
            new HeadObjectCommand(params),
         );
         return {
            size: ContentLength ?? 0,
            mimeType: ContentType ?? 'application/octet-stream',
         };
      } catch (e) {
         console.error(`Erro ao obter metadados de "${key}":`, e);
         throw new Error(`Não foi possível obter metadados do arquivo: ${key}`);
      }
   }

   public async listFiles(prefix: string): Promise<string[]> {
      await this.beforeEach();
      const all: string[] = [];
      let token: string | undefined;

      while (true) {
         const {
            Contents = [],
            IsTruncated,
            NextContinuationToken,
         } = await this.client.send(
            new ListObjectsV2Command({
               Bucket: this.bucketName,
               Prefix: prefix,
               ContinuationToken: token,
            }),
         );

         Contents.forEach(({ Key }) => Key && all.push(Key));
         if (!IsTruncated) break;
         token = NextContinuationToken;
      }
      return all;
   }

   public async downloadFile(s3Key: string, localPath: string): Promise<void> {
      await this.beforeEach();

      const { Body } = await this.client.send(
         new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key }),
      );
      if (!Body) throw new Error(`Objeto "${s3Key}" não encontrado.`);

      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      await pipeline(
         Body as NodeJS.ReadableStream,
         fs.createWriteStream(localPath),
      );
   }

   public async downloadFolder(
      s3Prefix: string,
      localDir: string,
   ): Promise<void> {
      await this.beforeEach();
      const keys = await this.listFiles(s3Prefix);
      if (!keys.length) return console.log('Nenhum arquivo encontrado.');

      fs.mkdirSync(localDir, { recursive: true });
      for (const key of keys.filter((k) => !k.endsWith('/'))) {
         await this.downloadFile(key, path.join(localDir, path.basename(key)));
      }
   }

   public async getSignedUrl(
      s3Key: string,
      expiresIn = 300,
      inline = false,
   ): Promise<string> {
      await this.beforeEach();

      const cmd = new GetObjectCommand({
         Bucket: this.bucketName,
         Key: s3Key,
         ResponseContentDisposition: inline
            ? undefined
            : `attachment; filename="${path.basename(s3Key)}"`,
      });

      return getSignedUrl(this.client, cmd, { expiresIn });
   }

   public async getCdnSignedUrl(
      s3Key: string,
      distributionDomain: string,
      expiresIn = 300,
      inline = false,
   ): Promise<string> {
      const s3Url = await this.getSignedUrl(s3Key, expiresIn, inline);
      const url = new URL(s3Url);

      url.host = distributionDomain
         .replace(/^https?:\/\//, '')
         .replace(/\/$/, '');

      const prefix = `/${this.bucketName}/`;

      if (url.pathname.startsWith(prefix))
         url.pathname = `/${url.pathname.slice(prefix.length)}`;

      return url.toString();
   }

   public async deleteFile(key: string): Promise<void> {
      await this.beforeEach();
      await this.client.send(
         new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
   }

   public async downloadFileAsBuffer(s3Key: string): Promise<Buffer> {
      await this.beforeEach();

      const { Body } = await this.client.send(
         new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key }),
      );
      if (!Body) {
         throw new Error(`Objeto "${s3Key}" não encontrado ou está vazio.`);
      }

      return this.streamToBuffer(Body as NodeJS.ReadableStream);
   }

   private async streamToBuffer(
      stream: NodeJS.ReadableStream,
   ): Promise<Buffer> {
      return new Promise((resolve, reject) => {
         const chunks: Buffer[] = [];
         stream.on('data', (chunk) => chunks.push(chunk));
         stream.on('error', reject);
         stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
   }
}
