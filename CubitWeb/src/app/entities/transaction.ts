import { Member } from "./member";

export class Transaction {
  id: string;
  correctedBy?: string;
  reversalOf?: string;
  requestKey?: string;
  amount: Number;

  confirmation: string;

  transactionDate: Date;

  description: string;

  member: Member;

  method: string;

  paypalEmail: string;

  paypalMemberId: Number;

  paypalName: string;
}
