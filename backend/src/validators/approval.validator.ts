import { z } from 'zod';

export const approvalIdParamSchema = z.object({
  id: z.string().uuid('Identifiant de demande invalide.'),
});
