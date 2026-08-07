import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RegistrationUnavailable } from "@/features/auth/components/registration-unavailable";

export const metadata = {
  title: "Pesan lewat WhatsApp — HNS IT Center",
  // Jangan diindeks: halaman ini tidak punya isi yang berguna bagi pencari, dan
  // membiarkannya terindeks membuat orang mendarat di jalan buntu dari Google.
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <RegistrationUnavailable title="Pesan lewat WhatsApp" />
      </main>
      <Footer />
    </div>
  );
}
