import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            fontFamily: "Roboto, sans-serif",
            background: "#F9FAFB",
            color: "#1A202C",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>Terjadi kesalahan pada tampilan</h1>
          <p style={{ margin: 0, maxWidth: 460, color: "#4A5568" }}>
            Silakan muat ulang halaman. Jika masih terjadi, periksa koneksi ke
            backend lalu coba lagi.
          </p>
          <pre
            style={{
              maxWidth: 640,
              overflow: "auto",
              fontSize: 12,
              background: "#fff",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              textAlign: "left",
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              background: "#5688D2",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
