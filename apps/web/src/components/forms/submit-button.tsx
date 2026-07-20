"use client";

import { Button, type ButtonProps } from "@dogtoralia/ui";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  /** Texto mostrado mientras la acción está en curso. */
  pendingText: string;
}

export function SubmitButton({ pendingText, children, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
