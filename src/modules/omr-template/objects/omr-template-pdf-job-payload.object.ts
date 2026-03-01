import {
   OmrTemplatePdfGenerationTrigger,
} from '../../../../.prisma/client';

export type OmrTemplatePdfJobPayload = {
   templateVersionId: string;
   assetId: string;
   trigger: OmrTemplatePdfGenerationTrigger;
   requestedByAgentId?: string;
};
