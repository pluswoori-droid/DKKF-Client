import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dkkf Launcher — 마인크래프트를 나만의 방식으로",
  description: "Minecraft 26.3 Fabric 기반 Dkkf Launcher Windows 다운로드와 설치 안내.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
