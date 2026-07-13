import {
  getServerSession as _getServerSession,
  NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function permissionsForRole(roleId: string): Promise<string[]> {
  const rps = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rps.map((rp) => rp.permission.key);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const member = await prisma.member.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { role: true },
        });
        if (!member?.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          member.passwordHash
        );
        if (!valid) return null;

        await prisma.member.update({
          where: { id: member.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: member.id,
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          role: member.role.name,
          permissions: await permissionsForRole(member.roleId),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
      } else if (trigger === "update" && token.id) {
        // Refresh role/permissions on session.update()
        const member = await prisma.member.findUnique({
          where: { id: token.id },
          include: { role: true },
        });
        if (member) {
          token.role = member.role.name;
          token.permissions = await permissionsForRole(member.roleId);
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      return session;
    },
  },
};

export function auth() {
  return _getServerSession(authOptions);
}
