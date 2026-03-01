import Stream from 'stream';

export async function streamToBuffer(
   stream: NodeJS.ReadableStream | Stream,
): Promise<Buffer<ArrayBufferLike>> {
   const chunks: Buffer[] = [];

   return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk as Buffer));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
   });
}
