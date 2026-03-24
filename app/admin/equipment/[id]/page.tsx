export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Equipment Detail</h1>
      <p className="mt-1 text-sm text-muted-foreground">Equipment ID: {id}</p>
    </div>
  );
}
