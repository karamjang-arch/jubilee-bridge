// Build: 2026-04-14-v2
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
      <head>
        {/* KaTeX for math rendering */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"
          integrity="sha512-fHwaWebuwA7NSF5Qg/af4UeDx9XqUpYpOGgubo3yWu+b2IQR4UeQwbb42Ti7gVAjNtVoI/I9TEoYeu9omwcC6g=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
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
