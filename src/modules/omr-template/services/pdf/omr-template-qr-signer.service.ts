import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ConfigType } from '@nestjs/config';
import correctionConfig from '../../../correction/config/correction.config';

type BuildTemplateQrInput = {
   templateId: string;
   templateVersionId: string;
   version: number;
   generatedAtIso: string;
};

@Injectable()
export class OmrTemplateQrSignerService {
   constructor(
      @Inject(correctionConfig.KEY)
      private readonly correctionSettings: ConfigType<typeof correctionConfig>,
   ) {}

   buildSignedTemplateQr(input: BuildTemplateQrInput): {
      payload: string;
      sig: string;
      token: string;
      payloadJson: Record<string, unknown>;
   } {
      const payloadJson = {
         kind: 'template_pdf',
         templateId: input.templateId,
         templateVersionId: input.templateVersionId,
         templateVersionNumber: input.version,
         generatedAt: input.generatedAtIso,
      };

      const payload = JSON.stringify(payloadJson);
      const sig = createHmac('sha256', this.correctionSettings.qrHmacSecret)
         .update(payload)
         .digest('hex');

      return {
         payload,
         sig,
         token: `${payload}.${sig}`,
         payloadJson,
      };
   }
}
