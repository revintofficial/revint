export default function MarketingLoading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-black"
      aria-label="Loading"
      role="status"
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.08)",
          borderTopColor: "#A5B4FC",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
