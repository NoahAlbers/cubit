import {Entity,Column,PrimaryColumn,Index} from 'typeorm'
@Entity()
export class BackupSettings {
 @PrimaryColumn() id:string
 @Column({type:'text'}) settings:string
 @Column({default:1}) revision:number
}
@Entity()
export class BackupJob {
 @PrimaryColumn() id:string
 @Column() kind:string
 @Index() @Column({default:'Queued'}) status:string
 @Column() requestedBy:string
 @Column({default:()=> 'CURRENT_TIMESTAMP'}) createdAt:Date
 @Column({nullable:true}) startedAt:Date
 @Column({nullable:true}) finishedAt:Date
 @Column({type:'text',nullable:true}) result:string
}
@Entity()
export class BackupRuntime {
 @PrimaryColumn() id:string
 @Column({type:'text'}) detail:string
 @Column() heartbeat:Date
}
