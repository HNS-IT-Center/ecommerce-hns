import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ToolsView } from "@/features/tools/components/tools-view";
import { ToolsCrossSell } from "@/features/tools/components/tools-cross-sell";

export const metadata: Metadata = {
  title: "Hardware Testing Tools - Keyboard, Mouse, Gamepad",
  description: "Test your keyboard, mouse, and gamepad inputs with our free hardware testing tools.",
};

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pb-16">
        <div className="mx-auto w-full px-4 py-8 md:px-6 2xl:px-8">
          <div className="mb-8 space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Hardware Testing Tools</h1>
            <p className="text-muted-foreground">Test your keyboard layout, mouse buttons, and gamepad connectivity.</p>
          </div>
          
          <ToolsView />
          
          <div className="mt-24 space-y-16">
            <ToolsCrossSell title="Explore Keyboards" searchQuery="keyboard" categorySlug="aksessories-komputer-keyboard" />
            <ToolsCrossSell title="Explore Mice" searchQuery="mouse" categorySlug="aksessories-komputer-mouse" />
            <ToolsCrossSell title="Explore Gamepads" searchQuery="gamepad" categorySlug="aksessories-komputer-gamepad" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
