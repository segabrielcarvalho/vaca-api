import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';

export const ApiKey = () => {
   return applyDecorators(UseGuards(ApiKeyGuard));
};
