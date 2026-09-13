import * as appointmentRepository from "@/lib/repositories/appointmentRepository";
import { findManyByIds } from "@/lib/repositories/userRepository";
import { localWallTimeToUtc, validateAppointmentWindow } from "@/lib/time";

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

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

/**
 * Creates an appointment for `creator` (already authenticated by the caller -
 * this function trusts it and does not re-fetch/re-verify the creator).
 * Validates, in order: invited users actually exist, start/end parse as valid
 * local wall-clock times in the creator's zone, and the resulting UTC window
 * is within working hours for every participant (creator included).
 */
export async function createAppointment(input: {
  creator: { id: string; preferredTimezone: string };
  title: string;
  description?: string;
  start: string;
  end: string;
  participantUserIds: string[];
}): Promise<ServiceResult<Awaited<ReturnType<typeof appointmentRepository.create>>>> {
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

  const appointment = await appointmentRepository.create({
    title: input.title,
    description: input.description,
    creatorId: input.creator.id,
    start: utcStart,
    end: utcEnd,
    participantUserIds: participantIds,
  });

  return { ok: true, data: appointment };
}
