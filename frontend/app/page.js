import Hero from "@/components/Hero";
import { Navbar } from "../components/navbar/navbar";
import { GuestGate } from "@/components/auth-guard";
// import Component from "@/components/saa-s-template";

export default function Home() {
  return (
    <GuestGate>
      <main className="min-h-screen bg-void-black text-phosphor-white">
        <Navbar />
        <Hero />
      </main>
    </GuestGate>
  );
}
