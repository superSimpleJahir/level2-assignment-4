import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";

const create = async (customerId: string, input: { bookingId: string; rating: number; comment?: string }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { review: { select: { id: true } } },
  });

  if (!booking || booking.customerId !== customerId) throw ApiError.notFound("Booking not found");
  if (booking.status !== "COMPLETED") {
    throw ApiError.badRequest("You can review a booking only after the job is completed", {
      currentStatus: booking.status,
    });
  }
  if (booking.review) throw ApiError.conflict("You have already reviewed this booking");

  // Create the review and refresh the technician's average rating together
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        bookingId: booking.id,
        customerId,
        technicianId: booking.technicianId,
        rating: input.rating,
        comment: input.comment,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    const stats = await tx.review.aggregate({
      where: { technicianId: booking.technicianId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.technicianProfile.update({
      where: { id: booking.technicianId },
      data: {
        ratingAvg: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        reviewCount: stats._count.rating,
      },
    });

    return review;
  });
};

export const reviewService = { create };
