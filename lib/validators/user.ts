import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

// Intl.supportedValuesOf('timeZone') is the runtime source of truth for valid
// IANA zone names - checked against it directly rather than hand-maintaining
// a list, so this never drifts from what lib/time.ts can actually handle.
const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  preferredTimezone: z
    .string()
    .refine((v) => validTimezones.has(v), { error: "must be a valid IANA timezone" }),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
