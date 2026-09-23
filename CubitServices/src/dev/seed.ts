import { hash } from 'bcrypt'
import { AppDataSource } from '../app'
import { Member, ROLES } from '../entity/member'
import { Plan } from '../entity/plan'
import { MemberPlan } from '../entity/memberPlan'
import { MemberKey } from '../entity/memberKey'
import { Transaction } from '../entity/transaction'

// Called once, after schema initialization. Never overwrite existing local data.
export async function seedLocalData() {
  if (await AppDataSource.manager.count(Member)) return
  await AppDataSource.transaction(async manager => {
    const plan = await manager.save(Plan, manager.create(Plan, {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Demo Membership', monthlyCost: 50,
    }))
    const password = await hash('LocalDemoOnly!2026', 10)
    const startDate = new Date()
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
    const samples = [
      { id: '20000000-0000-4000-8000-000000000001', firstName: 'Demo', lastName: 'Admin', email: 'admin@example.test', role: ROLES.ADMIN, active: true },
      { id: '20000000-0000-4000-8000-000000000002', firstName: 'Alex', lastName: 'Example', email: 'alex@example.test', role: ROLES.MEMBER, active: true },
      { id: '20000000-0000-4000-8000-000000000003', firstName: 'Sam', lastName: 'Example', email: 'sam@example.test', role: ROLES.MEMBER, active: false },
    ]
    for (const [index, sample] of samples.entries()) {
      const { active, ...fields } = sample
      await manager.save(Member, manager.create(Member, {
        ...fields, paypalEmail: sample.email, password,
        balance: 0, status: active ? 'Active' : 'Inactive',
        statusReason: 'Synthetic local development record',
      }))
      await manager.save(MemberKey, manager.create(MemberKey, {
        id: `30000000-0000-4000-8000-00000000000${index + 1}`,
        memberId: sample.id, serialNumber: `DEMO0000000${index + 1}`, status: 'Active',
      }))
      if (active) {
        await manager.save(MemberPlan, manager.create(MemberPlan, {
          memberId: sample.id, planId: plan.id, startDate,
          paypalSubscriptionId: '', paypalSubscriptionPlanId: '',
        }))
        await manager.save(Transaction, manager.create(Transaction, {
          memberId: sample.id, amount: 50, transactionDate: startDate,
          method: 'Local demo', description: 'Synthetic membership payment',
        }))
      }
    }
  })
  console.log('Created three synthetic members. Demo login: admin@example.test')
}
