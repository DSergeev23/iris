import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const { pathname } = request.nextUrl;

  // The admin domain owns only the protected interface. The portal domain cannot expose it by guessing a path.
  if (host === "irisadmin.ru" || host === "www.irisadmin.ru") {
    if (pathname === "/") return NextResponse.redirect(new URL("/admin", request.url));
    if (pathname === "/portal") return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (host === "iriscare.ru" || host === "www.iriscare.ru") {
    if (pathname === "/admin" || pathname === "/login") return NextResponse.redirect(new URL("/portal", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
