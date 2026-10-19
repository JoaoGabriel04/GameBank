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
  variable: '--font-jaro-next',
})

const inconsolata = Inconsolata({
  subsets: ['latin'],
  variable: '--font-inconsolata-next',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`dark ${jaro.variable} ${inconsolata.variable}`}>
      <body>
        <ToastProvider>
          <MusicProvider />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}