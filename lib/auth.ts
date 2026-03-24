import {
  getServerSession as _getServerSession,
  NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const member = await prisma.member.findUnique({
          where: { email: credentials.email },
          include: { role: true },
        });

        if (!member || !member.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          member.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Update lastLoginAt
        await prisma.member.update({
          where: { id: member.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: member.id,
          email: member.email,
          name: member.firstName,
          role: member.role.name,
          permissions: [],
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: fetch permissions from DB
        const member = await prisma.member.findUnique({
          where: { id: user.id },
          include: { role: true },
        });

        let permissions: string[] = [];
        if (member) {
          const rps = await prisma.rolePermission.findMany({
            where: { roleId: member.roleId },
            include: { permission: true },
          });
          permissions = rps.map((rp) => rp.permission.key);
        }

        token.id = user.id;
        token.role = user.role;
        token.permissions = permissions;
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
