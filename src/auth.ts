import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Dev user for local development - bypasses all auth
const DEV_USER = {
  id: "dev-admin-001",
  email: "dev@example.com",
  name: "Dev Admin",
  role: "admin",
} as const

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // In development, auto-login as dev admin
        if (process.env.NODE_ENV === "development") {
          return DEV_USER
        }

        // In production, implement real authentication here
        // For now, reject all logins in production
        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as typeof DEV_USER).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  // In development, trust the host
  trustHost: process.env.NODE_ENV === "development",
})

// Type augmentation for session
declare module "next-auth" {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: string
  }
}
