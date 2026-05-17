import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { SidebarProvider } from "../lib/sidebar-context";
import { ToastProvider } from "../components/toast";
import { TemplateProvider } from "../lib/template-context";

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medclara | Multilingual Medical ASR",
  description:
    "Medclara automatically transforms doctor-patient conversations into accurate, multilingual medical reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SidebarProvider>
            <TemplateProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </TemplateProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
