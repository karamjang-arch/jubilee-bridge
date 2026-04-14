import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { fetchStudentProfiles, fetchUsers } from "@/lib/sheets";
import { isUsingDemo } from "@/lib/demo-data";

// 데모 유저
const DEMO_PROFILES = [
  { id: 'JH', name: '지후', email: 'jihu@test.com', role: 'student', grade: 10 },
  { id: 'EH', name: '은후', email: 'eunhu@test.com', role: 'student', grade: 7 },
  { id: 'KJ', name: '관리자', email: 'admin@test.com', role: 'admin', grade: null },
];

async function getUserByEmail(email) {
  console.log('[AUTH] getUserByEmail:', email);

  if (isUsingDemo()) {
    return DEMO_PROFILES.find(u => u.email === email) || null;
  }

  try {
    // users 탭에서 확인 (admin/teacher/student 모두 여기에 있음)
    const users = await fetchUsers();
    console.log('[AUTH] users tab:', users.length, 'records');

    const userMatch = users.find(u => u.email === email);
    if (userMatch) {
      console.log('[AUTH] Found in users tab:', userMatch.role);
      return {
        id: userMatch.student_code || userMatch.id || email.split('@')[0].toUpperCase().slice(0, 4),
        name: userMatch.name,
        email: userMatch.email,
        role: userMatch.role,
        grade: null,
      };
    }

    // student_profile 탭 시도 (없으면 무시)
    try {
      const profiles = await fetchStudentProfiles();
      const profileMatch = profiles.find(p => p.email === email);
      if (profileMatch) {
        console.log('[AUTH] Found in student_profile');
        return {
          id: profileMatch.id,
          name: profileMatch.name,
          email: profileMatch.email,
          role: profileMatch.role || 'student',
          grade: profileMatch.grade ? parseInt(profileMatch.grade) : null,
        };
      }
    } catch (profileError) {
      console.log('[AUTH] student_profile tab not available, skipping');
    }

    console.log('[AUTH] User not found:', email);
    return null;
  } catch (error) {
    console.error('[AUTH] Error:', error.message);
    return null;
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // 모든 Google 로그인 허용 (신규 사용자는 signup 페이지로 리다이렉트됨)
      return true;
    },
    async jwt({ token, user, account }) {
      // 초기 로그인 시 기본 정보 설정
      if (account && user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      // 매번 사용자 정보 갱신 (5분마다 또는 미등록 상태일 때)
      const shouldRefresh = !token.lastChecked ||
                           Date.now() - token.lastChecked > 5 * 60 * 1000 ||
                           !token.registered;

      if (shouldRefresh && token.email) {
        console.log('[AUTH] Refreshing user data for:', token.email);
        const dbUser = await getUserByEmail(token.email);

        if (dbUser) {
          token.registered = true;
          token.role = dbUser.role;
          token.studentId = dbUser.id;
          token.displayName = dbUser.name;
          token.grade = dbUser.grade;
          console.log('[AUTH] User registered:', dbUser.role);
        } else {
          token.registered = false;
          console.log('[AUTH] User not registered');
        }
        token.lastChecked = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      session.user.email = token.email;
      session.user.registered = token.registered || false;

      if (token.registered) {
        session.user.role = token.role;
        session.user.studentId = token.studentId;
        session.user.displayName = token.displayName;
        session.user.grade = token.grade;
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
