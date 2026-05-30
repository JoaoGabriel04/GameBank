import type { Metadata } from "next";
import "./globals.css";
import { Jaro, Inconsolata } from 'next/font/google'
import { ToastProvider } from "@/components/Toast";
import MusicProvider from "@/components/MusicProvider";

export const metadata: Metadata = {
  title: "GameBank",
  description: "Gerenciador de partidas do tabuleiro Super Banco Imobiliário",
};

const jaro = Jaro({
  subsets: ['latin'],
})

const inconsolata = Inconsolata({
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${jaro.className} ${inconsolata.className}`}>
      <body>
        <ToastProvider>
          <MusicProvider />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}