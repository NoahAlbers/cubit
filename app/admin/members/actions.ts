"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  memberSearchSchema,
  createMemberSchema,
  type MemberSearchInput,
} from "@/lib/validations/member";
import { Prisma } from "@/lib/generated/prisma/client";

const ACTIVE_STATUSES = ["ACTIVE", "HOLD", "PAST_DUE", "PROSPECTIVE"];

export async function getMembers(params: MemberSearchInput) {
  await requirePermission("members.view");

  const parsed = memberSearchSchema.parse(params);
  const {
    search,
    status,
    membershipType,
    showInactive,
    sortField,
    sortDirection,
    page,
    pageSize,
  } = parsed;

  const where: Prisma.MemberWhereInput = {};

  // Search filter
  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  // Status filter
  if (status && status.length > 0) {
    where.status = { in: status as Prisma.EnumMemberStatusFilter["in"] };
  } else if (!showInactive) {
    where.status = {
      in: ACTIVE_STATUSES as Prisma.EnumMemberStatusFilter["in"],
    };
  }

  // Membership type filter
  if (membershipType && membershipType.length > 0) {
    where.membershipType = {
      in: membershipType as Prisma.EnumMembershipTypeFilter["in"],
    };
  }

  // Build orderBy
  let orderBy: Prisma.MemberOrderByWithRelationInput[] = [];
  if (sortField === "name") {
    orderBy = [
      { lastName: sortDirection },
      { firstName: sortDirection },
    ];
  } else if (sortField === "joinDate") {
    orderBy = [{ joinDate: sortDirection }];
  } else if (sortField === "status") {
    orderBy = [{ status: sortDirection }];
  } else if (sortField === "lastLoginAt") {
    orderBy = [{ lastLoginAt: sortDirection }];
  }

  const skip = (page - 1) * pageSize;

  const [members, totalCount, totalActive] = await Promise.all([
    prisma.member.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: { role: true },
    }),
    prisma.member.count({ where }),
    prisma.member.count({ where: { status: "ACTIVE" } }),
  ]);

  // Serialize dates for client
  const serializedMembers = members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone,
    status: m.status,
    membershipType: m.membershipType,
    joinDate: m.joinDate?.toISOString() ?? null,
    lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
    role: { id: m.role.id, name: m.role.name },
  }));

  return { members: serializedMembers, totalCount, totalActive };
}

export type MemberListItem = Awaited<
  ReturnType<typeof getMembers>
>["members"][number];

export async function createMember(data: unknown) {
  await requirePermission("members.create");

  const result = createMemberSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { firstName, lastName, email, phone, membershipType, roleId } =
    result.data;

  // Check for duplicate email
  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return { error: "A member with this email already exists" };
  }

  // If no roleId provided, look up the default "Member" role
  let finalRoleId = roleId;
  if (!finalRoleId) {
    const memberRole = await prisma.role.findUnique({
      where: { name: "Member" },
    });
    if (!memberRole) {
      return { error: "Default Member role not found. Please select a role." };
    }
    finalRoleId = memberRole.id;
  }

  const member = await prisma.member.create({
    data: {
      firstName,
      lastName,
      email,
      phone: phone || null,
      membershipType: membershipType as "STANDARD" | "STUDENT" | "SCHOLARSHIP" | "SPONSORSHIP",
      roleId: finalRoleId,
      status: "PROSPECTIVE",
    },
  });

  return { success: true, memberId: member.id };
}

export async function getRoles() {
  await requirePermission("members.view");
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return roles;
}
