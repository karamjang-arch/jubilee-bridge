import { NextResponse } from "next/server";
import { fetchConcepts, fetchDaily, fetchSATScores } from "@/lib/sheets";
import { isUsingDemo, DEMO_CONCEPTS, DEMO_DAILY, DEMO_SAT_SCORES } from "@/lib/demo-data";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "concepts";
  const student = searchParams.get("student");

  try {
    let data;

    if (isUsingDemo()) {
      // 데모 데이터 반환
      switch (tab) {
        case "concepts": data = DEMO_CONCEPTS; break;
        case "daily": data = DEMO_DAILY; break;
        case "sat_scores": data = DEMO_SAT_SCORES; break;
        default: data = [];
      }
    } else {
      // Sheets API 호출
      switch (tab) {
        case "concepts": data = await fetchConcepts(); break;
        case "daily": data = await fetchDaily(); break;
        case "sat_scores": data = await fetchSATScores(); break;
        default: data = [];
      }
    }

    // 학생 필터
    if (student) {
      data = data.filter(d => d.student === student);
    }

    return NextResponse.json({ data, demo: isUsingDemo() });
  } catch (error) {
    console.error("Sheets API route error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
