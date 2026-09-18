import { z } from 'zod';

export const sessionIdParamSchema = z.object({ id: z.string().uuid() });
