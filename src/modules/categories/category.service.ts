import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { slugify } from "../../utils/slugify";

// Public listing only shows categories that are switched on
const getPublic = () =>
  prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, description: true, icon: true },
  });

const getAll = () =>
  prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { services: true } } },
  });

const create = async (data: { name: string; description?: string; icon?: string }) => {
  const slug = slugify(data.name);
  const exists = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: { equals: data.name, mode: "insensitive" } }] },
  });
  if (exists) throw ApiError.conflict(`Category "${data.name}" already exists`);

  return prisma.category.create({ data: { ...data, slug } });
};

const update = async (
  id: string,
  data: { name?: string; description?: string; icon?: string; isActive?: boolean },
) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound("Category not found");

  const slug = data.name ? slugify(data.name) : undefined;
  if (slug && slug !== category.slug) {
    const clash = await prisma.category.findUnique({ where: { slug } });
    if (clash) throw ApiError.conflict(`Category "${data.name}" already exists`);
  }

  return prisma.category.update({ where: { id }, data: { ...data, ...(slug ? { slug } : {}) } });
};

const remove = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { services: true } } },
  });
  if (!category) throw ApiError.notFound("Category not found");

  if (category._count.services > 0) {
    throw ApiError.conflict(
      `Cannot delete "${category.name}" because ${category._count.services} service(s) use it. Deactivate it instead.`,
    );
  }

  await prisma.category.delete({ where: { id } });
};

export const categoryService = { getPublic, getAll, create, update, remove };
