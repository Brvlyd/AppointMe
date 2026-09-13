import * as appointmentRepository from "@/lib/repositories/appointmentRepository";
import { findManyByIds } from "@/lib/repositories/userRepository";
import { localWallTimeToUtc, validateAppointmentWindow } from "@/lib/time";

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

type AppointmentInput = {
  creator: { id: string; preferredTimezone: string };
  title: string;
  description?: string;
  start: string;
  end: string;
  participantUserIds: string[];
};

export async function listAppointmentsForUser(userId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const { appointments, total } = await appointmentRepository.listForUser({
    userId,
    skip,
    take: pageSize,
  });
  return {
    data: appointments,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** Returns null (not a permission error) if the appointment doesn't exist or the
 *  viewer isn't the creator or an invitee - same shape either way, so a caller
 *  can't tell an appointment "exists but you can't see it" from "doesn't exist". */
export async function getAppointmentById(id: string, viewerId: string) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) return null;
  const isCreator = appointment.creatorId === viewerId;
  const isParticipant = appointment.participants.some((p) => p.userId === viewerId);
  if (!isCreator && !isParticipant) return null;
  return appointment;
}

/**
 * Shared by create and update: invited users must exist, start/end must parse
 * as valid local wall-clock times in the creator's zone, and the resulting
 * UTC window must pass validateAppointmentWindow for every zone involved.
 */
async function resolveWindow(
  input: AppointmentInput
): Promise<
  | { ok: true; utcStart: Date; utcEnd: Date; participantIds: string[] }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const participantIds = [...new Set(input.participantUserIds)].filter(
    (id) => id !== input.creator.id
  );

  const participants = participantIds.length > 0 ? await findManyByIds(participantIds) : [];
  const foundIds = new Set(participants.map((u) => u.id));
  const missingIds = participantIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Some invited users do not exist",
      details: { missingIds },
    };
  }

  let utcStart: Date;
  let utcEnd: Date;
  try {
    utcStart = localWallTimeToUtc(input.start, input.creator.preferredTimezone);
    utcEnd = localWallTimeToUtc(input.end, input.creator.preferredTimezone);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: "Invalid start/end datetime",
      details: { message: (error as Error).message },
    };
  }

  const zones = [input.creator.preferredTimezone, ...participants.map((u) => u.preferredTimezone)];
  const validation = validateAppointmentWindow(utcStart, utcEnd, zones);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "Appointment window is invalid",
      details: { violations: validation.violations },
    };
  }

  return { ok: true, utcStart, utcEnd, participantIds };
}

/**
 * Creates an appointment for `creator` (already authenticated by the caller -
 * this function trusts it and does not re-fetch/re-verify the creator).
 */
export async function createAppointment(
  input: AppointmentInput
): Promise<ServiceResult<Awaited<ReturnType<typeof appointmentRepository.create>>>> {
  const resolved = await resolveWindow(input);
  if (!resolved.ok) return resolved;

  const appointment = await appointmentRepository.create({
    title: input.title,
    description: input.description,
    creatorId: input.creator.id,
    start: resolved.utcStart,
    end: resolved.utcEnd,
    participantUserIds: resolved.participantIds,
  });

  return { ok: true, data: appointment };
}

/** Only the creator may edit. Re-runs the exact same validation as create. */
export async function updateAppointment(
  id: string,
  input: AppointmentInput
): Promise<ServiceResult<Awaited<ReturnType<typeof appointmentRepository.update>>>> {
  const existing = await appointmentRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Appointment not found" };
  }
  if (existing.creatorId !== input.creator.id) {
    return { ok: false, status: 403, error: "Only the creator can edit this appointment" };
  }

  const resolved = await resolveWindow(input);
  if (!resolved.ok) return resolved;

  const appointment = await appointmentRepository.update(id, {
    title: input.title,
    description: input.description,
    start: resolved.utcStart,
    end: resolved.utcEnd,
    participantUserIds: resolved.participantIds,
  });

  return { ok: true, data: appointment };
}

/** Only the creator may delete. */
export async function deleteAppointment(id: string, userId: string): Promise<ServiceResult<null>> {
  const existing = await appointmentRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Appointment not found" };
  }
  if (existing.creatorId !== userId) {
    return { ok: false, status: 403, error: "Only the creator can delete this appointment" };
  }

  await appointmentRepository.remove(id);
  return { ok: true, data: null };
}
