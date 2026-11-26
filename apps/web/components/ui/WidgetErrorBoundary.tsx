"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Boundaries dashboards/widget grids so a single widget's error (auth 401,
 * endpoint 500, malformed payload) degrades to a small fallback instead of
 * knocking out the entire page with a white screen.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override state: State = { hasError: false };

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("WidgetErrorBoundary caught:", error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}