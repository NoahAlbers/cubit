export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Member Detail</h1>
      <p className="mt-1 text-sm text-muted-foreground">Member ID: {id}</p>
    </div>
  );
}
