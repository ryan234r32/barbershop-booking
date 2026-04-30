export default function CalendarLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-secondary rounded" />
        <div className="h-9 w-24 bg-secondary rounded" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 bg-secondary rounded" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-16 bg-secondary/60 rounded" />
        ))}
      </div>
    </div>
  );
}
