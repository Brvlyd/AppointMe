import { db } from "../lib/db";

async function main() {
  await db.appointmentParticipant.deleteMany();
  await db.appointment.deleteMany();
  await db.user.deleteMany();

  const [jakarta, auckland, newYork, london] = await Promise.all([
    db.user.create({
      data: { name: "Dewi Anggraini", username: "dewi", preferredTimezone: "Asia/Jakarta" },
    }),
    db.user.create({
      data: { name: "Liam Parata", username: "liam", preferredTimezone: "Pacific/Auckland" },
    }),
    db.user.create({
      data: { name: "Sarah Connor", username: "sarah", preferredTimezone: "America/New_York" },
    }),
    db.user.create({
      data: { name: "Oliver Hughes", username: "oliver", preferredTimezone: "Europe/London" },
    }),
  ]);

  await db.appointment.create({
    data: {
      title: "Quarterly planning sync",
      creatorId: jakarta.id,
      start: new Date("2026-10-05T02:00:00Z"),
      end: new Date("2026-10-05T03:00:00Z"),
      participants: {
        create: [{ userId: jakarta.id }, { userId: newYork.id }],
      },
    },
  });

  await db.appointment.create({
    data: {
      title: "Design review",
      creatorId: london.id,
      start: new Date("2026-10-06T09:00:00Z"),
      end: new Date("2026-10-06T10:00:00Z"),
      participants: {
        create: [{ userId: london.id }, { userId: auckland.id }, { userId: jakarta.id }],
      },
    },
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
