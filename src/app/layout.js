import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "Jubilee Bridge — Progress Dashboard",
  description: "Wisdom Dock US Track student progress dashboard for Purdue Korean Church Youth",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-light">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
