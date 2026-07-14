import { NextResponse } from "next/server";
import { getCategories } from "@/app/weesels/data";

// Lightweight read-only endpoint so client components (the finish ceremony's
// watch step) can list categories without a server-side data fetch of
// their own.
export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories.filter((c) => c.active));
}
