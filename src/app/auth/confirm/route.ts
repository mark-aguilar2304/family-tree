import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/navigation";

const otpTypes: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const type = otpTypes.find((candidate) => candidate === rawType);

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=auth_link_invalid", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_link_invalid", url));
  }

  return NextResponse.redirect(new URL(next, url));
}
