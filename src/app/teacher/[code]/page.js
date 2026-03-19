"use client";

import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function StudentDetailPage() {
  const params = useParams();
  const studentCode = params.code;

  return (
    <div className="min-h-screen bg-light">
      <Header />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4">
          <Link href="/teacher" className="text-sm text-teal hover:text-navy transition-colors">
            ← Back to all students
          </Link>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-jborder text-center">
          <div className="text-navy text-lg mb-2" style={{ fontWeight: 600 }}>
            Student: {studentCode}
          </div>
          <p className="text-jgray text-sm">
            Full student detail view will be available in Phase 2.
          </p>
          <p className="text-jgray text-sm mt-2">
            For now, use the Student View tab in the header to view individual student dashboards.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
