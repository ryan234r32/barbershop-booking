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
            className="w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-gray-500 mt-1">
                    {service.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  約 {service.duration} 分鐘
                </p>
              </div>
              <span className="text-emerald-600 font-semibold whitespace-nowrap">
                NT${service.price.toLocaleString()}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
