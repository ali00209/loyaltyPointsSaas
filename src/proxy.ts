import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 1. For CORS: Allowed Browser Origins
const ALLOWED_ORIGINS = ["http://192.168.56.1:8080"];

// 2. For IP Whitelisting: Allowed Client IPs
// const ALLOWED_IPS = ["192.168.56.1", "::1", "127.0.0.1"];

// Change function name to "proxy"
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  // const clientIp = request.ip || request.headers.get("x-forwarded-for") || "";

  // --- OPTION A: IP Whitelisting ---
  // if (!ALLOWED_IPS.includes(clientIp)) {
  //   return new NextResponse(
  //     JSON.stringify({ error: "Access Denied: IP not allowed" }),
  //     { status: 403, headers: { "Content-Type": "application/json" } },
  //   );
  // }

  // --- OPTION B: CORS Headers ---
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    return response;
  }

  return NextResponse.next();
}

// Apply this to your API routes
export const config = {
  matcher: "/api/:path*",
};
