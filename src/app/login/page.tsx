import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentAdmin, isAdminDemoMode } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isAdminDemoMode() || await getCurrentAdmin()) redirect("/admin");
  return <main className="login-page"><section className="login-card"><a className="brand" href="/portal"><span className="brand-mark">+</span><span>ИРИС</span></a><h1>Админка</h1><p>Управление отделениями, материалами и маршрутами пациентов.</p><LoginForm /></section></main>;
}
