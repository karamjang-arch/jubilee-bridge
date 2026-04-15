'use client';

import { useMemo } from 'react';
import katex from 'katex';

/**
 * MathText - LaTeX 수식을 KaTeX로 렌더링하는 컴포넌트
 *
 * 사용법:
 * <MathText text="x = $\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$" />
 *
 * 지원 패턴:
 * - $...$ : 인라인 수식
 * - $$...$$ : 블록 수식
 */
export default function MathText({ text, className = '' }) {
  const rendered = useMemo(() => {
    if (!text) return '';

    // $$ ... $$ 블록 수식 처리
    let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch (e) {
        console.warn('KaTeX block error:', e.message);
        return match;
      }
    });

    // $ ... $ 인라인 수식 처리
    result = result.replace(/\$([^$]+?)\$/g, (match, latex) => {
      try {
        return katex.renderToString(latex.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch (e) {
        console.warn('KaTeX inline error:', e.message);
        return match;
      }
    });

    return result;
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * MathBlock - 블록 레벨 수식용
 */
export function MathBlock({ latex, className = '' }) {
  const rendered = useMemo(() => {
    if (!latex) return '';
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch (e) {
      console.warn('KaTeX error:', e.message);
      return `<code>${latex}</code>`;
    }
  }, [latex]);

  return (
    <div
      className={`my-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * 텍스트에 수식이 포함되어 있는지 확인
 */
export function containsMath(text) {
  if (!text) return false;
  return /\$[^$]+\$/.test(text) || /\$\$[\s\S]+?\$\$/.test(text);
}

/**
 * 일반 텍스트에서 수식 패턴을 LaTeX로 변환 (클라이언트에서 사용)
 * sqrt(x) → $\sqrt{x}$
 * x^2 → $x^{2}$
 * 등
 */
export function normalizeToLatex(text) {
  if (!text) return text;

  let result = text;

  // 이미 $로 감싸진 부분은 건드리지 않음
  if (/\$/.test(result)) return result;

  // sqrt(x) → $\sqrt{x}$
  result = result.replace(/sqrt\s*\(\s*([^)]+)\s*\)/gi, (_, inner) => `$\\sqrt{${inner.trim()}}$`);

  // root(n,x) → $\sqrt[n]{x}$
  result = result.replace(/root\s*\(\s*([^,]+),\s*([^)]+)\s*\)/gi, (_, n, x) => `$\\sqrt[${n.trim()}]{${x.trim()}}$`);

  // x^n (단독 변수^숫자 패턴)
  result = result.replace(/([a-zA-Z])\^(\d+)/g, (_, base, exp) => `$${base}^{${exp}}$`);

  // x^{n} 이미 있는 경우
  result = result.replace(/([a-zA-Z])\^\{([^}]+)\}/g, (_, base, exp) => `$${base}^{${exp}}$`);

  // pi → $\pi$
  result = result.replace(/\bpi\b/gi, '$\\pi$');

  return result;
}
