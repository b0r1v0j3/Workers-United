import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ForWorkers } from "@/components/landing/ForWorkers";
import { ForEmployers } from "@/components/landing/ForEmployers";
import { Reasons } from "@/components/landing/Reasons";
import { FAQ } from "@/components/landing/FAQ";
import { Contact } from "@/components/landing/Contact";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col font-sans">
      <Header />
      <Hero />
      <HowItWorks />
      <ForWorkers />
      <ForEmployers />
      <Reasons />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}
