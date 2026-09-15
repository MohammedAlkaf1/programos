export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface p-4">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton mt-3 h-7 w-20" />
            <div className="skeleton mt-3 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <div className="skeleton h-4 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-6 w-full" />
            ))}
          </div>
        </div>
        <div className="surface p-5">
          <div className="skeleton h-4 w-32" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
