"use client";

import { forwardRef, useState } from "react";
import styles from "./PasswordInput.module.css";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className={styles.wrapper}>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`${className ?? ""} ${styles.input}`.trim()}
          autoCapitalize="none"
          autoCorrect="off"
          {...props}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? "🙈" : "👁"}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
