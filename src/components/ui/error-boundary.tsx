"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ───────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error);
    }
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <DefaultFallback
        error={this.state.error}
        onReset={() => this.reset()}
        className={this.props.className}
      />
    );
  }
}

// ─── Fallback UI di default ───────────────────────────────

interface DefaultFallbackProps {
  error: Error | null;
  onReset: () => void;
  className?: string;
}

function DefaultFallback({ error, onReset, className }: DefaultFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Qualcosa è andato storto</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {process.env.NODE_ENV === "development" && error?.message
            ? error.message
            : "Impossibile caricare questo componente."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Riprova
      </Button>
    </div>
  );
}