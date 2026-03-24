export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-blue">Cubit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Melbourne Makerspace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
