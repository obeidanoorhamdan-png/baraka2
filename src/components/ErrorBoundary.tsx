import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
  /** Optional name for logging context. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions inside its subtree and shows a helpful
 * Arabic fallback instead of a blank white screen. The user can retry
 * (re-mount the subtree) without losing the rest of the app shell.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to console so we can see it in dev/preview.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label || "unknown", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="p-5 my-4 border-destructive/40 bg-destructive/5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/15 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-destructive">حدث خطأ أثناء عرض هذا القسم</h3>
            <p className="text-sm text-muted-foreground mt-1">
              يمكنك إعادة المحاولة. إذا تكررت المشكلة، أعد تحميل الصفحة.
            </p>
            <pre className="mt-2 text-[11px] text-destructive/80 whitespace-pre-wrap break-words max-h-40 overflow-auto bg-background/60 p-2 rounded">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={this.reset} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> إعادة المحاولة
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                إعادة تحميل الصفحة
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }
}
