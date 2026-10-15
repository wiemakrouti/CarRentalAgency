import { z } from 'zod';
import { APPROVAL_STATUSES } from '../enums.js';

export const approvalListQuerySchema = z.object({
  status: z.enum(APPROVAL_STATUSES).optional(),
});

export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>;
