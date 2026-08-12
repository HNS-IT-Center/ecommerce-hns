import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Reset Password — HNS IT Center",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold">Buat Password Baru</h1>
          </div>

          <ResetPasswordForm token={token} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
