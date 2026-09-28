import { signIn } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/"

  // Sign in with credentials (will use dev user)
  try {
    await signIn("credentials", {
      email: "dev@example.com",
      password: "dev",
      redirect: true,
      redirectTo: callbackUrl,
    })
  } catch (error) {
    // signIn throws a redirect, which is expected
    // If it's a redirect error, the redirect will happen
    if ((error as Error)?.message?.includes("NEXT_REDIRECT")) {
      throw error
    }
    // For other errors, redirect to home
    return NextResponse.redirect(new URL(callbackUrl, request.nextUrl.origin))
  }
}
