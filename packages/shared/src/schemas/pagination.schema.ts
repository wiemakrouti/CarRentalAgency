import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// z.coerce.boolean() is a footgun for query strings: it calls JS's
// Boolean(), so Boolean("false") is true. This preprocesses "true"/"false"
// strings correctly before the boolean check runs — every boolean query
// param (includeArchived, and any future one, e.g. Clients' `blacklisted`)
// should be built on this, not z.coerce.boolean() directly.
export function booleanQueryParam(defaultValue?: boolean) {
  const schema = z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean(),
  );
  return defaultValue === undefined ? schema.optional() : schema.default(defaultValue);
}

export const includeArchivedQuerySchema = z.object({
  includeArchived: booleanQueryParam(false),
});
