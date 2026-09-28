import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ColorPaletteInit } from "@/components/providers/color-palette-init"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ClipEngine",
  description: "Podcast → Clips & Shorts",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ColorPaletteInit />
      </body>
    </html>
  )
}
