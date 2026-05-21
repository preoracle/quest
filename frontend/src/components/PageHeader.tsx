export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-on-surface md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-base text-on-muted">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
