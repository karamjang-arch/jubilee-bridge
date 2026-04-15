'use client';

import { useEffect, useRef, memo } from 'react';

/**
 * MathRenderer - LaTeX 수식을 KaTeX로 렌더링하는 컴포넌트
 *
 * 지원 패턴:
 * - $...$ : 인라인 수식
 * - $$...$$ : 블록 수식
 * - \(...\) : 인라인 수식 (대체)
 * - \[...\] : 블록 수식 (대체)
 *
 * 사용법:
 * <MathRenderer text="The area is $A = \pi r^2$" />
 * <MathRenderer text={question} className="text-body" />
 */
function MathRenderer({ text, className = '', as: Component = 'span' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    // KaTeX가 로드되었는지 확인
    const renderMath = async () => {
      // CDN에서 KaTeX 로드
      if (typeof window !== 'undefined' && !window.katex) {
        if (!document.getElementById('katex-script')) {
          const script = document.createElement('script');
          script.id = 'katex-script';
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
          script.async = true;
          document.head.appendChild(script);

          await new Promise((resolve) => {
            script.onload = resolve;
            script.onerror = resolve;
          });
        } else {
          // 이미 스크립트가 있으면 로드 대기
          await new Promise((resolve) => {
            const checkKatex = setInterval(() => {
              if (window.katex) {
                clearInterval(checkKatex);
                resolve();
              }
            }, 50);
            // 3초 타임아웃
            setTimeout(() => {
              clearInterval(checkKatex);
              resolve();
            }, 3000);
          });
        }
      }

      if (!window.katex) {
        // KaTeX를 로드할 수 없으면 원본 텍스트 표시
        containerRef.current.textContent = text;
        return;
      }

      const katex = window.katex;

      // 수식 패턴 매칭 및 변환
      let html = text;

      // 블록 수식: $$...$$ 또는 \[...\]
      html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
            output: 'html',
          });
        } catch (e) {
          console.warn('KaTeX block error:', e);
          return match;
        }
      });

      html = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
            output: 'html',
          });
        } catch (e) {
          console.warn('KaTeX block error:', e);
          return match;
        }
      });

      // 인라인 수식: $...$ 또는 \(...\)
      // 주의: $100 같은 금액 표시와 구분하기 위해 $ 뒤에 숫자만 있는 경우 제외
      html = html.replace(/\$([^$\n]+?)\$/g, (match, math) => {
        // 숫자만 있으면 (예: $100) 수식이 아님
        if (/^\d+([,.\d]*)?$/.test(math.trim())) {
          return match;
        }
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
            output: 'html',
          });
        } catch (e) {
          console.warn('KaTeX inline error:', e);
          return match;
        }
      });

      html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
            output: 'html',
          });
        } catch (e) {
          console.warn('KaTeX inline error:', e);
          return match;
        }
      });

      // 줄바꿈 처리
      html = html.replace(/\n/g, '<br />');

      containerRef.current.innerHTML = html;
    };

    renderMath();
  }, [text]);

  // 서버 사이드에서는 원본 텍스트 표시
  if (typeof window === 'undefined') {
    return <Component className={className}>{text}</Component>;
  }

  return (
    <Component
      ref={containerRef}
      className={className}
      suppressHydrationWarning
    >
      {text}
    </Component>
  );
}

export default memo(MathRenderer);

/**
 * 텍스트에 수식이 포함되어 있는지 확인
 */
export function hasMathContent(text) {
  if (!text) return false;
  // $...$, $$...$$, \(...\), \[...\] 패턴 확인
  return /\$[^$]+\$|\\\(.*?\\\)|\\\[.*?\\\]/.test(text);
}
