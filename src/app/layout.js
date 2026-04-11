import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { CurriculumProvider } from "@/hooks/useCurriculum";

export const metadata = {
  title: "JubileeBridge — 스킬 맵 학습 플랫폼",
  description: "US SAT · 한국 수능 — CB 기반 인터랙티브 스킬 맵 + 학습 도구",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg-page font-primary">
        <AuthProvider>
          <CurriculumProvider>
            {children}
          </CurriculumProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
