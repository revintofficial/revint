export default function PublicLoading() {
  return (
    <div
      style={{
        background: "#0b0b0d",
        color: "#ededf0",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Loading"
      role="status"
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.08)",
          borderTopColor: "var(--revint-300)",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
