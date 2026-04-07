"use client";

import { Component, type ReactNode } from "react";
import { BarChart2, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ─── Types ────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ───────────────────────────────────────────

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ChartErrorBoundary]", error);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Card>
        {this.props.title && (
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {this.props.title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-muted p-4">
              <BarChart2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Grafico non disponibile</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {process.env.NODE_ENV === "development" && this.state.error?.message
                  ? this.state.error.message
                  : "Si è verificato un errore durante il caricamento."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}