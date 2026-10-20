import type { Metadata } from "next";
import "./globals.css";
import localFont from 'next/font/local'
import { ToastProvider } from "@/components/Toast";
import MusicProvider from "@/components/MusicProvider";
import MotionPrefsProvider from "@/components/MotionPrefsProvider";

export const metadata: Metadata = {
  title: "GameBank",
  description: "Gerenciador de partidas do tabuleiro Super Banco Imobiliário",
};

// Arquivos locais (subset latin do Google Fonts) para o build não depender
// de rede: com next/font/google, uma falha no fetch quebra o build.
const jaro = localFont({
  src: '../../public/fonts/Jaro-latin.woff2',
  weight: '400',
  variable: '--font-jaro-next',
})

const inconsolata = localFont({
  src: '../../public/fonts/Inconsolata-latin-200-900.woff2',
  weight: '200 900',
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
        <MotionPrefsProvider>
          <ToastProvider>
            <MusicProvider />
            {children}
          </ToastProvider>
        </MotionPrefsProvider>
      </body>
    </html>
  );
}