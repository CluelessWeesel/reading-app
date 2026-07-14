import { ImageResponse } from "next/og";
import { getCategories, getSealedYears, getWeeselRows } from "@/app/weesels/data";
import { computeYearCategoryBlocks } from "@/app/weesels/weeselMath";
import { loadFraunces } from "@/app/weesels/share/loadFraunces";

export const runtime = "nodejs";

const PAPER = "#f7f1e3";
const INK = "#2b2118";
const INK_FAINT = "#8a7a63";

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return new Response("Not found", { status: 404 });
  }

  const sealedYears = await getSealedYears();
  if (!sealedYears.has(year)) {
    return new Response("This year isn't sealed yet.", { status: 404 });
  }

  const [categories, rows] = await Promise.all([getCategories(), getWeeselRows()]);
  const blocks = computeYearCategoryBlocks(year, rows, categories);
  const winners = blocks
    .filter((b) => b.status === "ran" && b.winner)
    .map((b) => ({
      categoryName: b.category.name,
      title: b.winner!.book_title ?? b.winner!.nominee,
      coverUrl: b.winner!.cover_url,
    }));

  const fontText = `${year} Weesels` + winners.map((w) => `${w.categoryName}${w.title}`).join("") + "🏆";
  const fraunces = await loadFraunces(fontText, 600);
  // Satori crashes ("Cannot read properties of undefined (reading 'split')")
  // if fontFamily is present in a style object but set to `undefined` -- it
  // must be omitted entirely, not just falsy, when no custom font loaded.
  const headingFont = fraunces ? { fontFamily: "Fraunces" } : {};

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
          padding: "56px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: INK_FAINT, textTransform: "uppercase" }}>
            The Weesels
          </div>
          <div
            style={{
              display: "flex",
              ...headingFont,
              fontWeight: 600,
              fontSize: 56,
              color: INK,
              marginTop: 6,
            }}
          >
            {year}
          </div>
        </div>

        {winners.length === 0 ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 28, color: INK_FAINT }}>
            No categories ran this year.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              flex: 1,
              alignContent: "flex-start",
              justifyContent: "center",
              gap: 20,
            }}
          >
            {winners.map((w) => (
              <div
                key={w.categoryName}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 250,
                }}
              >
                {w.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.coverUrl}
                    style={{
                      width: 130,
                      height: 195,
                      objectFit: "cover",
                      borderRadius: 8,
                      boxShadow: "0 12px 24px rgba(43,33,24,0.3)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 130,
                      height: 195,
                      borderRadius: 8,
                      backgroundColor: "#e8dcc4",
                      fontSize: 28,
                      color: "#b8a37f",
                    }}
                  >
                    {w.title.charAt(0)}
                  </div>
                )}
                <div style={{ display: "flex", fontSize: 14, color: INK_FAINT, marginTop: 10, textAlign: "center" }}>
                  {w.categoryName}
                </div>
                <div
                  style={{
                    display: "flex",
                    ...headingFont,
                    fontWeight: 600,
                    fontSize: 18,
                    color: INK,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  🏆 {w.title}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    {
      width: 1600,
      height: 900,
      fonts: fraunces ? [{ name: "Fraunces", data: fraunces, style: "normal", weight: 600 }] : undefined,
    }
  );
}
