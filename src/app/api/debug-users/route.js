import { NextResponse } from "next/server";
import { fetchUsers, fetchStudentProfiles } from "@/lib/sheets";

export async function GET(request) {
  try {
    const users = await fetchUsers();
    const profiles = await fetchStudentProfiles();

    return NextResponse.json({
      users: {
        count: users.length,
        sample: users.slice(0, 5),
      },
      profiles: {
        count: profiles.length,
        sample: profiles.slice(0, 5),
      },
      sheetId: process.env.NEXT_PUBLIC_SHEET_ID?.slice(0, 10) + '...',
      apiKeySet: !!process.env.NEXT_PUBLIC_SHEETS_API_KEY,
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 });
  }
}
