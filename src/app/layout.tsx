import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Inicialização da fonte Inter
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SGH | IFNMG JANUÁRIA",
  description: "Sistema de Gestão de Horários do IFNMG - Campus Januária",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Barra de progresso com a cor verde do IFNMG */}
        <NextTopLoader
          color="#15803d"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #15803d,0 0 5px #15803d"
        />

        {children}
      </body>
    </html>
  );
}
