import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=InvalidToken", request.url)
    );
  }

  try {
    const member = await prisma.member.findFirst({
      where: {
        magicLinkToken: token,
        magicLinkExpires: { gt: new Date() },
      },
    });

    if (!member) {
      return NextResponse.redirect(
        new URL("/login?error=InvalidToken", request.url)
      );
    }

    // Clear the magic link token
    await prisma.member.update({
      where: { id: member.id },
      data: {
        magicLinkToken: null,
        magicLinkExpires: null,
      },
    });

    // If member has no password, redirect to set-password
    if (!member.passwordHash) {
      return NextResponse.redirect(
        new URL(`/set-password?memberId=${member.id}`, request.url)
      );
    }

    // Member has a password — redirect to login with success message
    return NextResponse.redirect(
      new URL("/login?verified=true", request.url)
    );
  } catch (error) {
    console.error("Magic link verification error:", error);
    return NextResponse.redirect(
      new URL("/login?error=InvalidToken", request.url)
    );
  }
}
