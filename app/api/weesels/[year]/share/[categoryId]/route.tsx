import { ImageResponse } from "next/og";
import { getCategories, getSealedYears, getWeeselRows } from "@/app/weesels/data";
import { computeYearCategoryBlocks } from "@/app/weesels/weeselMath";
import { loadFraunces } from "@/app/weesels/share/loadFraunces";

export const runtime = "nodejs";

const PAPER = "#f7f1e3";
const INK = "#2b2118";
const INK_MUTED = "#6b5d4f";
const INK_FAINT = "#8a7a63";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; categoryId: string }> }
) {
  const { year: yearParam, categoryId: categoryIdParam } = await params;
  const year = Number(yearParam);
  const categoryId = Number(categoryIdParam);
  if (!Number.isInteger(year) || !Number.isInteger(categoryId)) {
    return new Response("Not found", { status: 404 });
  }

  const sealedYears = await getSealedYears();
  if (!sealedYears.has(year)) {
    return new Response("This year isn't sealed yet.", { status: 404 });
  }

  const [categories, rows] = await Promise.all([getCategories(), getWeeselRows()]);
  const blocks = computeYearCategoryBlocks(year, rows, categories);
  const block = blocks.find((b) => b.category.id === categoryId);
  if (!block || !block.winner) {
    return new Response("No winner for this category.", { status: 404 });
  }

  const { category, winner } = block;
  const title = winner.book_title ?? winner.nominee;
  const author = winner.book_author ?? winner.author_or_narrator;
  const citation = winner.citation;
  const coverUrl = winner.cover_url;

  const fontText = `${year} Weesels${category.name}${title}${author ?? ""}${citation ?? ""}🏆`;
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
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: INK_FAINT, textTransform: "uppercase" }}>
            {year} Weesels
          </div>
          <div style={{ display: "flex", fontSize: 64, marginTop: 12 }}>🏆</div>
          <div
            style={{
              display: "flex",
              ...headingFont,
              fontWeight: 600,
              fontSize: 42,
              color: INK,
              textAlign: "center",
              marginTop: 14,
            }}
          >
            {category.name}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", marginTop: 20 }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              style={{ height: 540, borderRadius: 10, boxShadow: "0 24px 48px rgba(43,33,24,0.35)" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 540,
                width: 360,
                borderRadius: 10,
                backgroundColor: "#e8dcc4",
                ...headingFont,
                fontWeight: 600,
                fontSize: 72,
                color: "#b8a37f",
              }}
            >
              {title.charAt(0)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              ...headingFont,
              fontWeight: 600,
              fontSize: 40,
              color: INK,
              textAlign: "center",
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          {author && (
            <div style={{ display: "flex", fontSize: 24, color: INK_MUTED, marginTop: 8 }}>{author}</div>
          )}
          {citation && (
            <div
              style={{
                display: "flex",
                fontSize: 20,
                fontStyle: "italic",
                color: INK_FAINT,
                textAlign: "center",
                marginTop: 22,
                maxWidth: 760,
              }}
            >
              &ldquo;{citation}&rdquo;
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: fraunces ? [{ name: "Fraunces", data: fraunces, style: "normal", weight: 600 }] : undefined,
    }
  );
}
