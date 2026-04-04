import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "JubileeBridge — 스킬 맵 학습 플랫폼",
  description: "8과목 4,351 CB 기반 인터랙티브 스킬 맵 + 학습 도구",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg-page font-primary">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
