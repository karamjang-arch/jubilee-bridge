# Jubilee Bridge — Progress Dashboard

Wisdom Dock US Track 학생 진도 대시보드

## 기술 스택

- Next.js 14 (App Router)
- Tailwind CSS
- Recharts (차트)
- NextAuth.js (Google OAuth)
- Google Sheets API v4
- Vercel (배포)

## 빠른 시작

### 1. 의존성 설치

```bash
cd jubilee-bridge
npm install
```

### 2. 환경 변수 설정

`.env.local.example`을 복사하여 `.env.local`을 만들고 값을 채워 넣으세요:

```bash
cp .env.local.example .env.local
```

필요한 값:
- `NEXT_PUBLIC_SHEETS_API_KEY` — Google Cloud Console에서 발급
- `NEXT_PUBLIC_SHEET_ID` — Sheets URL에서 추출
- `GOOGLE_CLIENT_ID` — Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth 클라이언트 시크릿
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`로 생성

### 3. 데모 모드로 실행 (API 키 없이)

API 키를 아직 설정하지 않았어도 데모 데이터로 실행 가능합니다:

```bash
npm run dev
```

브라우저에서:
- `http://localhost:3000` — 로그인 페이지
- `http://localhost:3000/student?demo=true` — 학생 대시보드 (데모)
- `http://localhost:3000/teacher?demo=true` — 교사 대시보드 (데모)

### 4. Google Cloud 세팅

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 (JubileeBridge)
2. Google Sheets API 활성화
3. API 키 발급 (HTTP 참조 제한: jubileebridge.vercel.app, localhost:3000)
4. OAuth 2.0 클라이언트 ID 생성:
   - 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`
   - 프로덕션: `https://jubileebridge.vercel.app/api/auth/callback/google`
5. Sheets 파일을 "링크가 있는 사용자 - 뷰어"로 공유

### 5. Sheets 구조

WisdomDock_Progress 스프레드시트에 다음 탭이 필요합니다:

**concepts** 탭:
| date | student | subject | topic | unit | status | mastery | study_minutes | quiz_result |

**daily** 탭:
| date | student | total_minutes | new_concepts | reviewed | mastery_change | xp | streak |

**sat_scores** 탭:
| date | student | rw_score | math_score | total_score | test_name |

**users** 탭:
| email | role | student_code | name |

### 6. Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 환경 변수 설정 (Vercel 대시보드 또는 CLI)
vercel env add NEXT_PUBLIC_SHEETS_API_KEY
vercel env add NEXT_PUBLIC_SHEET_ID
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
```

## 디렉토리 구조

```
jubilee-bridge/
  src/
    app/
      layout.js           # 루트 레이아웃
      page.js             # 로그인 페이지
      globals.css         # Tailwind + 커스텀 CSS
      student/
        page.js           # 학생 대시보드
      teacher/
        page.js           # 교사 대시보드
        [code]/
          page.js         # 학생 상세 (교사 전용)
      api/
        auth/
          [...nextauth]/
            route.js      # NextAuth.js 핸들러
        sheets/
          route.js        # Sheets API 프록시
    lib/
      sheets.js           # Google Sheets API 연동
      demo-data.js        # 데모 데이터
      data-service.js     # 데이터 서비스 레이어
    components/
      AuthProvider.js     # 세션 프로바이더
      Header.js           # 네비게이션 바
      Footer.js           # 하단 푸터
      StatCard.js         # 통계 카드
      StatusPill.js       # 상태 뱃지
      Charts.js           # Recharts 차트 컴포넌트
    middleware.js          # 인증 미들웨어
```

## Phase 로드맵

- Phase 1 (MVP): Google OAuth + 학생/교사 대시보드 + Sheets 읽기 + Vercel 배포
- Phase 2: 웹앱 내 데이터 입력 + 학부모 뷰 + 교사 메모
- Phase 3: 커스텀 도메인 + Supabase 전환 + 리더보드 + 한국 트랙 통합
