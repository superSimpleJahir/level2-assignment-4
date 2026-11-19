import { z } from "zod";

export const updateProfileSchema = z
  .object({
    headline: z.string().trim().min(3).max(100),
    bio: z.string().trim().max(1000),
    skills: z
      .array(z.string().trim().min(2, "Each skill must be at least 2 characters").max(40))
      .max(20, "You can list up to 20 skills"),
    experienceYears: z.number().int("Experience must be a whole number").min(0).max(60),
    hourlyRate: z.number().min(0, "Hourly rate cannot be negative").max(100000),
    city: z.string().trim().min(2).max(60),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm (24h) format");

const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

export const availabilitySchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0, "dayOfWeek must be 0 (Sun) to 6 (Sat)").max(6, "dayOfWeek must be 0 (Sun) to 6 (Sat)"),
        startTime: time,
        endTime: time,
      }),
    )
    .max(50, "Too many slots")
    .superRefine((slots, ctx) => {
      slots.forEach((slot, i) => {
        if (toMinutes(slot.endTime) <= toMinutes(slot.startTime)) {
          ctx.addIssue({ code: "custom", path: [i, "endTime"], message: "endTime must be after startTime" });
        }
      });

      // Slots on the same day must not overlap each other
      const sorted = slots
        .map((s, index) => ({ ...s, index }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (prev.dayOfWeek === cur.dayOfWeek && toMinutes(cur.startTime) < toMinutes(prev.endTime)) {
          ctx.addIssue({ code: "custom", path: [cur.index], message: "This slot overlaps with another slot on the same day" });
        }
      }
    }),
});
