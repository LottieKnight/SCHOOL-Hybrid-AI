"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export { buttonClassName };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      type={type}
      {...props}
    />
  );
});
