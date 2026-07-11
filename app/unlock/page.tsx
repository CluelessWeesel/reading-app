import { UnlockForm } from "./UnlockForm";

function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  // Only allow same-site relative paths -- reject absolute/protocol-relative
  // URLs so this can't be turned into an open redirect.
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <UnlockForm next={safeNext(next)} />;
}
