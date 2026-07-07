import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = await fetch(`${API_URL}/auth/callback${url.search}`, {
    redirect: "manual",
  });

  const location = upstream.headers.get("location") || "/home";
  const res = NextResponse.redirect(new URL(location, req.url));

  const setCookies = upstream.headers.getSetCookie();
  for (const cookie of setCookies) {
    res.headers.append("set-cookie", cookie);
  }

  return res;
}
