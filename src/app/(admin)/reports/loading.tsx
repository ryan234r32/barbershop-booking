export default function ReportsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2">
        <div className="h-9 w-20 bg-secondary rounded-full" />
        <div className="h-9 w-20 bg-secondary rounded-full" />
        <div className="h-9 w-20 bg-secondary rounded-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-secondary rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-48 bg-secondary/60 rounded-lg" />
        <div className="h-32 bg-secondary/60 rounded-lg" />
      </div>
    </div>
  );
}
