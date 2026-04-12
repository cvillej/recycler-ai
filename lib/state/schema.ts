export const LastErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  timestamp: z.string().datetime(),
  stack: z.string().optional(),
});

export type LastError = z.infer<typeof LastErrorSchema>;

export const lastErrorReducer = (prev: LastError | undefined, update: LastError | undefined): LastError | undefined => update || prev;
