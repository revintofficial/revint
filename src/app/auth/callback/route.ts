import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app/dashboard";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const errUrl = new URL("/login", url.origin);
      errUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(errUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
