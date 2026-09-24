import { AppDataSource } from '../database';
import { Plan } from '../entity/plan';

// Add the staff-provided subscription menu without changing historical rates.
export async function seedPlanCatalog() {
  const id = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  if (await AppDataSource.manager.exists(Plan, { where: { id: id(1) } })) return;
  await AppDataSource.transaction(async (manager) => {
    const options = [
      ['Standard Membership', 60],
      ['Student Membership (18–28)', 30],
      ['Standard + 1 Key', 90],
      ['Standard + 2 Keys', 120],
      ['Standard + 3 Keys', 150],
    ] as const;
    for (const [index, [name, monthlyCost]] of options.entries()) {
      await manager.save(
        Plan,
        manager.create(Plan, { id: id(index + 1), name, monthlyCost, available: true }),
      );
    }
    for (const legacyId of [
      '10000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000003',
    ]) {
      await manager.update(Plan, legacyId, { available: false });
    }
  });
}
