import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail } from "@/lib/data-service";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // 등록된 사용자만 로그인 허용
      const dbUser = await getUserByEmail(user.email);
      if (!dbUser) {
        return false; // 미등록 사용자 차단
      }
      return true;
    },
    async session({ session }) {
      // 세션에 역할과 학생 코드 추가
      if (session?.user?.email) {
        const dbUser = await getUserByEmail(session.user.email);
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.studentCode = dbUser.student_code;
          session.user.displayName = dbUser.name;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
