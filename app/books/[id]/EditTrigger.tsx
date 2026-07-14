"use client";

import { useOpenEditModal } from "./EditModalProvider";

export function EditTrigger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const openEdit = useOpenEditModal();
  return (
    <button type="button" onClick={openEdit} className={className}>
      {children}
    </button>
  );
}
