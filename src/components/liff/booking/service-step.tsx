"use client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
}

export function ServiceStep({
  services,
  onSelect,
}: {
  services: Service[];
  onSelect: (service: Service) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">選擇服務</h2>
      <div className="space-y-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelect(service)}
            className="w-full text-left p-4 bg-[var(--color-surface)] rounded-lg border border-transparent hover:border-[var(--color-brand)] transition-all active:scale-[0.98]"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-[var(--color-brand)]">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {service.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  約 {service.duration} 分鐘
                </p>
              </div>
              <span className="text-[var(--color-brand)] font-semibold whitespace-nowrap">
                NT${service.price.toLocaleString()}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
