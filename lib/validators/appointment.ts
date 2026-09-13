import { z } from "zod";

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const createAppointmentSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  // Naive local wall-clock strings (e.g. "2026-10-05T14:00"), interpreted in
  // the creator's own preferredTimezone - not UTC, not the browser's zone.
  start: z.string().min(1, "start is required"),
  end: z.string().min(1, "end is required"),
  participantUserIds: z.array(z.string()).default([]),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
