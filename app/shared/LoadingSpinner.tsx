export function LoadingSpinner({ size = 48, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/deco/loading.png"
      alt="Loading"
      width={size}
      height={size}
      className={`loading-spinner ${className ?? ""}`}
    />
  );
}
