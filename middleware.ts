import { NextResponse, type NextRequest } from "next/server";

function isPathOrChild(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/index.html") return NextResponse.redirect(new URL("/portal", request.url));
  if (pathname === "/admin.html") return NextResponse.redirect(new URL("/admin", request.url));
  if (pathname === "/admin-login.html") return NextResponse.redirect(new URL("/login", request.url));

  // The admin domain owns only the protected interface. The portal domain cannot expose it by guessing a path.
  if (host === "irisadmin.ru" || host === "www.irisadmin.ru") {
    if (pathname === "/") return NextResponse.redirect(new URL("/admin", request.url));
    if (pathname === "/portal") return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (host === "iriscare.ru" || host === "www.iriscare.ru") {
    if (isPathOrChild(pathname, "/admin") || isPathOrChild(pathname, "/login") || isPathOrChild(pathname, "/setup") || isPathOrChild(pathname, "/api/uploads")) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
