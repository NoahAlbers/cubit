import { Member } from "./member";
import { Plan } from "./plan";

export class MemberPlan {
  id: string;
  billingRate?: number;
  billingName?: string;
  finalBillingDate?: string;

  startDate: Date;

  endDate: Date;

  member: Member;

  plan: Plan;
}
