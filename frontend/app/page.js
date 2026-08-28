import Hero from "@/components/Hero";
import { Navbar } from "../components/navbar/navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-void-black text-phosphor-white">
      <Navbar />
      <Hero />
    </main>
  );
}
