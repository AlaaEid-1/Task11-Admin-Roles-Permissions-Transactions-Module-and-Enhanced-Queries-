import { z } from 'zod';

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.enum(['createdAt', 'amount', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  fields: z
    .string()
    .transform((val) => val.split(',').filter(Boolean))
    .optional(),
});

export type TransactionQueryType = z.infer<typeof transactionQuerySchema>;
