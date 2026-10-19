import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/shared/toast";
import { TitleCaseEnforcer } from "@/components/shared/title-case-enforcer";
import "./globals.css";

// Poppins is the only typeface in the app — both the sans and mono tokens point at it
// (see --font-sans / --font-mono in globals.css). Poppins isn't a variable font, so every
// weight the UI uses (font-light … font-extrabold) is loaded explicitly.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "WinOS",
  description: "winos",
  icons: {
    icon: "/winos-favicon.png",
    shortcut: "/winos-favicon.png",
    apple: "/winos-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full overflow-hidden`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          {/* App-wide title case for text and inputs (small words like "and"/"of" stay lowercase). */}
          <TitleCaseEnforcer />
        </ThemeProvider>
      </body>
    </html>
  );
}
