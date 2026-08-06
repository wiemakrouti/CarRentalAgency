import { z } from 'zod';
import { booleanQueryParam, includeArchivedQuerySchema, paginationQuerySchema } from '@car-rental/shared';

export const clientIdParamSchema = z.object({ id: z.string().uuid() });

export const clientDocumentIdParamSchema = clientIdParamSchema.extend({
  documentId: z.string().uuid(),
});

export const clientListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  search: z.string().trim().min(1).optional(),
  blacklisted: booleanQueryParam(),
});

export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
