import React from "react";
import PropTypes from "prop-types";

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary
// A class-based React Error Boundary that catches render/lifecycle errors in
// any child component tree and shows a fallback UI instead of an empty screen.
// ─────────────────────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // Called during rendering phase when a descendant throws.
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Called after render with error + component stack info.
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Forward to an error tracking service (Sentry, etc.) if configured.
    if (typeof window !== "undefined" && window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }

    // Log in development for easier debugging.
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary] Caught an error:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children, onReset } = this.props;

    if (!hasError) return children;

    // Use a custom fallback if provided.
    if (fallback) {
      return typeof fallback === "function"
        ? fallback({ error, errorInfo, reset: this.handleReset })
        : fallback;
    }

    const handleReset = () => {
      this.handleReset();
      if (onReset) onReset();
    };

    return (
      <div style={styles.container} role="alert" aria-live="assertive">
        <div style={styles.card}>
          <div style={styles.icon} aria-hidden="true">
            &#9888;
          </div>
          <h2 style={styles.heading}>Something went wrong</h2>
          <p style={styles.description}>
            An unexpected error occurred. Our team has been notified.
          </p>

          {process.env.NODE_ENV !== "production" && error && (
            <details style={styles.details}>
              <summary style={styles.summary}>Error details (dev only)</summary>
              <pre style={styles.pre}>{error.toString()}</pre>
              {errorInfo && (
                <pre style={styles.pre}>{errorInfo.componentStack}</pre>
              )}
            </details>
          )}

          <div style={styles.actions}>
            <button
              onClick={handleReset}
              style={styles.primaryButton}
              type="button"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={styles.secondaryButton}
              type="button"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  /** Children to render normally. */
  children: PropTypes.node.isRequired,
  /**
   * Optional custom fallback. Can be a React node or a render function
   * receiving { error, errorInfo, reset }.
   */
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  /** Called after the internal state reset (useful for clearing router state). */
  onReset: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  fallback: null,
  onReset: null,
};

export default ErrorBoundary;

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles — keeps the component self-contained; override via fallback prop.
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "0.75rem",
    padding: "2.5rem 2rem",
    maxWidth: "480px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  },
  icon: {
    fontSize: "2.5rem",
    marginBottom: "1rem",
    color: "#f59e0b",
  },
  heading: {
    margin: "0 0 0.5rem",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#111827",
  },
  description: {
    margin: "0 0 1.5rem",
    color: "#6b7280",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },
  details: {
    marginBottom: "1.5rem",
    textAlign: "left",
    background: "#f3f4f6",
    borderRadius: "0.5rem",
    padding: "0.75rem 1rem",
  },
  summary: {
    cursor: "pointer",
    fontSize: "0.875rem",
    color: "#374151",
    fontWeight: 500,
  },
  pre: {
    marginTop: "0.5rem",
    fontSize: "0.75rem",
    color: "#dc2626",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowX: "auto",
  },
  actions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "0.5rem 1.25rem",
    backgroundColor: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: "0.5rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  secondaryButton: {
    padding: "0.5rem 1.25rem",
    backgroundColor: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "0.5rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
};
