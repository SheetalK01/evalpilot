import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name').max(80),
  description: z.string().trim().max(500).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
