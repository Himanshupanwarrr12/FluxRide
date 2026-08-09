import { prisma } from "../lib/prisma.js";

export const getUserProfileById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user || user.status === "DELETED") {
    throw new Error("User not found");
  }

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword };
};

export const updateUserProfile = async (
  id: string,
  data: { firstName?: string; lastName?: string; phone?: string }
) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user || user.status === "DELETED") {
    throw new Error("User not found");
  }

  if (data.phone && data.phone !== user.phone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone: data.phone },
    });
    if (existingPhone && existingPhone.id !== id) {
      throw new Error("Phone number is already in use by another account");
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.phone && { phone: data.phone }),
    },
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return { user: userWithoutPassword };
};

export const softDeleteUserAccount = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user || user.status === "DELETED") {
    throw new Error("User not found");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: "DELETED" },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    }),
  ]);

  return { message: "Account deleted successfully" };
};
