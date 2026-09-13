import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "username is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
