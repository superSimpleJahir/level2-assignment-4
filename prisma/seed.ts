import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const categories = [
  { name: "Plumbing", description: "Leaks, pipe fitting, taps, geysers and drainage", icon: "wrench" },
  { name: "Electrical", description: "Wiring, switches, fans, lights and appliance fitting", icon: "bolt" },
  { name: "Cleaning", description: "Home, kitchen, bathroom and deep cleaning", icon: "sparkles" },
  { name: "Painting", description: "Interior and exterior wall painting", icon: "paint-roller" },
  { name: "AC Repair", description: "AC servicing, gas refill and installation", icon: "snowflake" },
  { name: "Carpentry", description: "Furniture repair, doors, cabinets and fittings", icon: "hammer" },
];

const technicians = [
  {
    name: "Rahim Uddin",
    email: "rahim.plumber@fixitnow.com",
    headline: "Licensed plumber with 8 years of experience",
    bio: "I fix leaks, install new fittings and clear blocked drains. Neat work and fair prices.",
    skills: ["pipe fitting", "leak repair", "drain cleaning", "geyser"],
    experienceYears: 8,
    hourlyRate: 15,
    city: "Dhaka",
    services: [
      { category: "Plumbing", title: "Leaking pipe & tap repair", description: "Find and fix leaking pipes, taps and flush tanks.", price: 20, durationMinutes: 60 },
      { category: "Plumbing", title: "Bathroom fitting installation", description: "Install commodes, basins, showers and mixers.", price: 45, durationMinutes: 120 },
    ],
  },
  {
    name: "Karim Hossain",
    email: "karim.electric@fixitnow.com",
    headline: "Certified electrician for homes and small offices",
    bio: "Safe wiring, fan and light installation, and fast fault finding.",
    skills: ["wiring", "fan installation", "circuit breaker", "lighting"],
    experienceYears: 6,
    hourlyRate: 18,
    city: "Dhaka",
    services: [
      { category: "Electrical", title: "Ceiling fan installation", description: "Fit a new ceiling fan including regulator and wiring check.", price: 18, durationMinutes: 60 },
      { category: "Electrical", title: "Full home wiring inspection", description: "Complete safety inspection of switches, sockets and the main board.", price: 55, durationMinutes: 180 },
    ],
  },
  {
    name: "Sumaiya Akter",
    email: "sumaiya.clean@fixitnow.com",
    headline: "Professional deep cleaning specialist",
    bio: "I bring my own supplies and leave your home spotless. Kitchens and bathrooms are my specialty.",
    skills: ["deep cleaning", "kitchen cleaning", "bathroom cleaning", "sofa cleaning"],
    experienceYears: 4,
    hourlyRate: 12,
    city: "Chattogram",
    services: [
      { category: "Cleaning", title: "Full home deep cleaning", description: "Top-to-bottom cleaning of rooms, kitchen and bathrooms.", price: 70, durationMinutes: 240 },
      { category: "Cleaning", title: "Kitchen deep clean", description: "Degrease stove, chimney, tiles, sink and cabinets.", price: 30, durationMinutes: 90 },
    ],
  },
  {
    name: "Nasir Ahmed",
    email: "nasir.ac@fixitnow.com",
    headline: "AC technician - servicing, gas refill and repair",
    bio: "All major AC brands. Honest diagnosis before any repair.",
    skills: ["ac servicing", "gas refill", "ac installation"],
    experienceYears: 10,
    hourlyRate: 20,
    city: "Sylhet",
    services: [
      { category: "AC Repair", title: "AC general service", description: "Filter and coil cleaning, drain flush and performance check.", price: 25, durationMinutes: 60 },
      { category: "AC Repair", title: "AC gas refill", description: "Leak check and refrigerant refill for split ACs.", price: 40, durationMinutes: 90 },
    ],
  },
];

const customers = [
  { name: "Tania Rahman", email: "tania@example.com", phone: "01711111111", address: "House 12, Road 5, Dhanmondi, Dhaka" },
  { name: "Imran Khan", email: "imran@example.com", phone: "01822222222", address: "Flat 4B, Agrabad, Chattogram" },
];

async function main() {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  const hash = (plain: string) => bcrypt.hash(plain, rounds);

  // ---- Admin ----
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fixitnow.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: await hash(adminPassword), role: "ADMIN", status: "ACTIVE" },
    create: { name: "FixItNow Admin", email: adminEmail, password: await hash(adminPassword), role: "ADMIN" },
  });
  console.log(`Admin ready: ${adminEmail}`);

  // ---- Categories ----
  const categoryIds: Record<string, string> = {};
  for (const c of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: { description: c.description, icon: c.icon },
      create: { ...c, slug: slugify(c.name) },
    });
    categoryIds[c.name] = saved.id;
  }
  console.log(`${categories.length} categories ready`);

  // ---- Technicians ----
  const techPassword = await hash("Tech@12345");
  for (const t of technicians) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { name: t.name, email: t.email, password: techPassword, role: "TECHNICIAN", phone: "01900000000", address: t.city },
    });

    const profile = await prisma.technicianProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        headline: t.headline,
        bio: t.bio,
        skills: t.skills,
        experienceYears: t.experienceYears,
        hourlyRate: t.hourlyRate,
        city: t.city,
      },
    });

    // Sunday is off; Mon-Sat 09:00-18:00 (UTC)
    for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
      await prisma.availabilitySlot.upsert({
        where: { technicianId_dayOfWeek_startTime: { technicianId: profile.id, dayOfWeek, startTime: "09:00" } },
        update: {},
        create: { technicianId: profile.id, dayOfWeek, startTime: "09:00", endTime: "18:00" },
      });
    }

    for (const s of t.services) {
      const exists = await prisma.service.findFirst({ where: { technicianId: profile.id, title: s.title } });
      if (!exists) {
        await prisma.service.create({
          data: {
            technicianId: profile.id,
            categoryId: categoryIds[s.category],
            title: s.title,
            description: s.description,
            price: s.price,
            durationMinutes: s.durationMinutes,
          },
        });
      }
    }
  }
  console.log(`${technicians.length} technicians ready`);

  // ---- Customers ----
  const customerPassword = await hash("Customer@123");
  for (const c of customers) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { ...c, password: customerPassword, role: "CUSTOMER" },
    });
  }
  console.log(`${customers.length} customers ready`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
