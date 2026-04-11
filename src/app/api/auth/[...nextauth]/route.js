import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { fetchStudentProfiles } from "@/lib/sheets";
import { isUsingDemo } from "@/lib/demo-data";

// 데모 유저
const DEMO_PROFILES = [
  { id: 'JH', name: '지후', email: 'jihu@test.com', role: 'student', grade: 10 },
  { id: 'EH', name: '은후', email: 'eunhu@test.com', role: 'student', grade: 7 },
  { id: 'KJ', name: '관리자', email: 'admin@test.com', role: 'admin', grade: null },
];

async function getUserByEmail(email) {
  if (isUsingDemo()) {
    return DEMO_PROFILES.find(u => u.email === email) || null;
  }

  try {
    const profiles = await fetchStudentProfiles();
    return profiles.find(p => p.email === email) || null;
  } catch (error) {
    console.error('Failed to fetch profiles:', error);
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
      if (account && user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        // DB에서 사용자 정보 확인
        const dbUser = await getUserByEmail(user.email);
        if (dbUser) {
          token.registered = true;
          token.role = dbUser.role;
          token.studentId = dbUser.id;
          token.displayName = dbUser.name;
          token.grade = dbUser.grade;
        } else {
          token.registered = false;
        }
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
