export default interface IS3Provider {
   saveFileFromBase64(fileInBase64: string, folder?: string): Promise<string>;
   saveFileFromBuffer(buffer: Buffer, folder?: string): Promise<string>;
   deleteFile(key: string): Promise<void>;
   getMetadata(key: string): Promise<{ size: number; mimeType: string }>;
   listFiles(prefix: string): Promise<string[]>;
   downloadFile(s3Key: string, localPath: string): Promise<void>;
   downloadFileAsBuffer(s3Key: string): Promise<Buffer>;
   downloadFolder(s3Prefix: string, localDir: string): Promise<void>;
   getSignedUrl(
      s3Key: string,
      expiresIn?: number,
      inline?: boolean,
   ): Promise<string>;
   getCdnSignedUrl(
      s3Key: string,
      distributionDomain: string,
      expiresIn?: number,
      inline?: boolean,
   ): Promise<string>;
}
