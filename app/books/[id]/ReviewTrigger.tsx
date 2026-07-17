"use client";

import { useOpenReviewModal } from "./EditModalProvider";

export function ReviewTrigger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const openReview = useOpenReviewModal();
  return (
    <button type="button" onClick={openReview} className={className}>
      {children}
    </button>
  );
}
