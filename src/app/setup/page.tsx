import { redirect } from "next/navigation";
import { SetupForm } from "@/features/auth/components/setup-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await db.adminUser.count()) redirect("/login");
  const enabled = (process.env.ADMIN_SETUP_TOKEN?.length ?? 0) >= 32;

  return <main className="login-page"><section className="login-card setup-card">
    <a className="brand" href="/portal"><span className="brand-mark">+</span><span>ИРИС</span></a>
    <p className="eyebrow">Первичная настройка</p>
    <h1>Создание администратора</h1>
    <p>Страница закроется автоматически после создания единственной учётной записи.</p>
    {!enabled && <p className="setup-warning" role="status">Добавьте в Timeweb переменную <code>ADMIN_SETUP_TOKEN</code> длиной не менее 32 символов и перезапустите приложение.</p>}
    <SetupForm enabled={enabled} />
  </section></main>;
}
