import { formatPhone } from '../../services/contact-format';
import { Component, OnInit, OnDestroy, NgZone, ElementRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';
import { MemberService } from '../../services/member.service';
import { Observable, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { AddEditMemberPlanComponent } from '../add-edit-member-plan/add-edit-member-plan.component';
import { AlertDialogComponent } from '../shared/alert-dialog/alert-dialog.component';
import { AddKeyComponent } from '../add-key/add-key.component';
import { AddTransactionComponent } from '../add-transaction/add-transaction.component';
import { UploadFileService } from '../../services/upload-service.service';
import { MatLegacySlideToggle as MatSlideToggle } from '@angular/material/legacy-slide-toggle';
import * as qr from 'qrcode-generator';
import { Key } from '../../entities/memberKey';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import { Member } from '../../entities/member';
import { MemberPlan } from '../../entities/memberPlan';
import { KeyService } from '../../services/key.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../entities/transaction';
import { billingRows, BillingRow } from './billing-history';
import { EditChargeComponent } from './edit-charge.component';
import { ListNavigationService } from '../../services/list-navigation.service';
import { StaffToolsComponent } from './staff-tools.component';
import { DraftGuard } from '../../services/draft-guard';

@Component({
  selector: 'app-member',
  templateUrl: './member.component.html',
  styles: [
    `
      .mediumField {
        width: 200px;
      }

      .mat-column-serialNumber {
        width: 50%;
        flex: none;
      }

      .subheaderText {
        margin-left: 1em;
      }

      .Inactive {
        color: red;
      }
    `,
  ],
})
export class MemberComponent implements OnInit, OnDestroy {
  @ViewChild(StaffToolsComponent) staffTools?:StaffToolsComponent;
  originalContact:any; saving=false; saveError=''; created=false;contactLoading=false;
  emptyContact(id='New'){return {id,firstName:'',lastName:'',email:'',paypalEmail:'',phone:'',emergencyContact:'',emergencyEmail:'',emergencyPhone:'',password:'',role:'member'};}
  historyFrom='';historyTo='';historyType='';historyPage=1;historySize=20;
  cutoffOriginal=''; changingPlan=false;
  get filteredHistory(){return this.historyRows.filter(r=>(!this.historyFrom||r.date>=this.historyFrom)&&(!this.historyTo||r.date<=this.historyTo)&&(!this.historyType||r.kind===this.historyType));}
  get historyPages(){return Math.max(1,Math.ceil(this.filteredHistory.length/this.historySize));}
  get visibleHistory(){return this.filteredHistory.slice((this.historyPage-1)*this.historySize,this.historyPage*this.historySize);}
  get enabledKeys(){return this.memberKeys.data.filter(k=>k.status==='Active').length;}
  get entryAllowed(){return this.memberStatus==='Active'&&this.enabledKeys>0;}
  get entryReason(){return this.memberStatus==='Active'?(this.enabledKeys?(this.billing?.pastDue>0?'Within the billing grace period':'Membership is current'):'No enabled key'):this.billing?.accessReason||'Review membership status';}
  jump(id:string){document.getElementById(id)?.scrollIntoView({block:'start'});document.getElementById(id)?.focus({preventScroll:true});}
  hasUnsavedChanges(){return this.form.dirty||!!this.staffTools?.hasUnsavedChanges()||!!(this.cutoffPlan&&this.cutoffOriginal!==JSON.stringify([this.cutoffDate,this.cutoffReason]));}
  canSaveDraft(){return this.form.dirty&&this.form.valid&&!this.saving&&!this.contactLoading&&!this.staffTools?.hasUnsavedChanges()&&!this.cutoffPlan;}
  discardDraft(){this.form.reset(this.originalContact||this.emptyContact());this.staffTools?.discardDraft();this.cutoffPlan=null;}
  saveDraft(){return this.save(false);}
  revertContact(){this.form.reset(this.originalContact||this.emptyContact());this.saveError='';}
  async closeCutoff(){if(this.cutoffOriginal!==JSON.stringify([this.cutoffDate,this.cutoffReason])&&!await this.drafts.confirmDiscard())return;this.cutoffPlan=null;}
  get returnUrl() { return this.navigation.memberReturn(this.activatedRoute.snapshot.queryParams.returnTo,this.memberId); }
  get auditQuery(){const previous=this.router.parseUrl(this.returnUrl);return this.returnUrl.split(/[?#]/)[0]==='/audit'&&previous.queryParams.memberId===this.memberId?previous.queryParams:{memberId:this.memberId,memberReturnTo:this.returnUrl};}
  get returnTarget() { return this.returnUrl.split(/[?#]/)[0]; }
  get returnQuery() { return this.router.parseUrl(this.returnUrl).queryParams; }
  get returnLabel() { return this.navigation.label(this.returnUrl); }
  form: UntypedFormGroup;
  headerText = '';
  memberPlans = new MatTableDataSource<MemberPlan>();
  memberKeys = new MatTableDataSource<Key>();
  lastEntry: string | null = null;
  activityLoading = false;
  activityError = '';
  get lastEntryLabel() {
    if (this.activityLoading) return 'Loading entry history…';
    if (this.activityError) return 'Entry history unavailable';
    if (!this.lastEntry) return 'No recorded entries';
    const calendarDay = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date);
      const part = (type: string) => Number(parts.find(p=>p.type===type)?.value);
      return Date.UTC(part('year'), part('month')-1, part('day'));
    };
    const days = Math.max(0, Math.round((calendarDay(new Date())-calendarDay(new Date(this.lastEntry)))/86400000));
    return days===0 ? 'Last entry: Today' : `Last entry: ${days} day${days===1?'':'s'} ago`;
  }
  memberId = '';
  memberTypes = ['admin', 'member'];
  billing: any; billingError = ''; cutoffPlan: any; cutoffDate = ''; cutoffReason = '';
  cutoffPreview: any; cutoffBusy = false; cutoffError = ''; cutoffSaved = '';
  historyOrder = 'desc';
  historyRows: BillingRow[] = [];
  get lastPaymentDate(){return (this.billing?.payments||[]).filter(p=>Number(p.amount)>0&&!p.correctedBy&&!p.reversalOf&&new Date(p.transactionDate)<=new Date()).map(p=>p.transactionDate).sort().pop()||null;}
  paymentChanges: any[] = [];
  private initialSections = new Set<string>();
  private anchorScroll?: Subscription;
  openPlan = false;
  memberPicture = '';
  memberStatus = 'Loading...';
  @ViewChild('fileInput') fileInput;
  filecontrol: ElementRef[];
  qrCode = '';

  memberBalance = '';

  constructor(
    private drafts:DraftGuard,
    private router: Router,
    private zone: NgZone,
    private http: HttpClient,
    private fb: UntypedFormBuilder,
    private activatedRoute: ActivatedRoute,
    private memberService: MemberService,
    private keyService: KeyService,
    private dialog: MatDialog,
    private transactionService: TransactionService,
    public uploadService: UploadFileService,
    private snackBar: MatSnackBar,
    public navigation: ListNavigationService
  ) {
    this.form = this.fb.group({
      id: [''],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      paypalEmail: ['',Validators.email],
      emergencyContact: [''],
      emergencyEmail: ['', Validators.email],
      emergencyPhone: [''],
      role: ['member',Validators.required],
      password: [''],
    });

    //console.log('subscribe to route');

    this.activatedRoute.params.subscribe((params) => {
      this.form.controls['id'].setValue(params.id);
      this.memberId = params.id;
      this.lastEntry=null;this.activityError='';this.activityLoading=params.id!=='New';
      this.form.reset(this.emptyContact(params.id));this.originalContact=null;this.billing=null;this.memberPlans.data=[];this.memberKeys.data=[];
      this.contactLoading=params.id!=='New';if(this.contactLoading)this.form.disable();else this.form.enable();
      this.initialSections.clear();
      this.anchorScroll?.unsubscribe();
      this.anchorScroll = undefined;

      if (this.form.controls['id'].value !== 'New') {
        this.updateMemberBalance();
        this.makeQRCode();
        this.loadValuesIfExisting(this.form.controls['id'].value);
        this.form.valueChanges.subscribe(() => {
          this.headerText =
            this.form.controls['firstName'].value +
            ' ' +
            this.form.controls['lastName'].value;
        });

        this.loadPlans(false);

        this.loadKeys();

      } else {
        this.headerText = 'New Member';
      }
    });
  }

  private checkMemberStatus() {
    this.loadBilling();
  }

  loadBilling() {
    if (this.memberId === 'New') return;
    this.http.get<any>('/api/cubit/members/' + this.memberId + '/billing').subscribe({
      next: result => { this.billing = result; this.sortHistory(); this.paymentChanges = (result.payments || []).filter(p=>p.correctedBy || p.reversalOf || p.correctionReason); this.memberStatus = result.status; this.billingError = ''; this.sectionLoaded('billing'); },
      error: () => this.billingError = 'Could not load billing history. Please refresh.',
    });
  }

  sortHistory() {
    this.historyRows = billingRows(this.billing, this.historyOrder);
    this.historyPage=1;
  }
  abs(value:number) { return Math.abs(value); }
  editBillingEntry(row:BillingRow) {
    if(row.charge) this.dialog.open(EditChargeComponent,{disableClose:true,data:{charge:row.charge,balance:this.billing.balance}}).afterClosed().subscribe(result=>{if(result==='Saved')this.loadBilling();});
    else this.addEditTransaction(row.id);
  }

  sectionLoaded(section: string) {
    this.initialSections.add(section);
    if (this.initialSections.size !== 6 || this.anchorScroll || this.activatedRoute.snapshot.fragment !== 'access-keys') return;
    // Wait for async profile sections to render before positioning the shortcut.
    this.anchorScroll = this.zone.onStable.pipe(take(1)).subscribe(() => {
      document.getElementById('access-keys')?.scrollIntoView({ block: 'start' });
    });
  }

  ngOnDestroy() { this.anchorScroll?.unsubscribe(); }

  async openCutoff(plan: any) {
    if(this.cutoffPlan&&this.cutoffOriginal!==JSON.stringify([this.cutoffDate,this.cutoffReason])&&!await this.drafts.confirmDiscard())return;
    this.cutoffPlan = plan;
    this.cutoffDate = plan.finalBillingDate || (plan.endDate ? plan.endDate.slice(0, 10) : '');
    this.cutoffReason = ''; this.cutoffPreview = null; this.cutoffError = ''; this.cutoffSaved = '';
    this.cutoffOriginal=JSON.stringify([this.cutoffDate,this.cutoffReason]);
  }

  changeCutoff() { this.cutoffPreview = null; this.cutoffError = ''; }

  submitCutoff(preview: boolean) {
    if (this.cutoffBusy || !this.cutoffDate || !this.cutoffReason.trim()) return;
    this.cutoffBusy = true; this.cutoffError = '';
    this.http.post<any>('/api/cubit/plans/' + this.cutoffPlan.id + '/cutoff', {
      finalBillingDate: this.cutoffDate, reason: this.cutoffReason, preview,
      expectedDate: this.cutoffPlan.finalBillingDate || (this.cutoffPlan.endDate ? this.cutoffPlan.endDate.slice(0, 10) : null),
    }).subscribe({ next: result => {
      this.cutoffBusy = false;
      if (preview) this.cutoffPreview = result;
      else { this.cutoffSaved = 'Final billing date saved. Earlier unpaid charges remain on the account.'; this.cutoffPlan = null; this.loadPlans(); this.updateMemberBalance(); }
    }, error: err => { this.cutoffBusy = false; this.cutoffError = err.error?.message || 'Could not save the final billing date.'; } });
  }

  private loadPlans(refreshBilling = true) {
    this.memberService
      .getMemberPlans(this.memberId)
      .pipe(take(1))
      .subscribe((data) => {
        this.openPlan = false;
        this.memberPlans.data = data;
        this.sectionLoaded('plans');
        //console.log('plans', data);
        data.forEach((record) => {
          if (!record.endDate) {
            this.openPlan = true;
          }
        });
        if(refreshBilling)this.checkMemberStatus();
      });
  }

  private loadKeys() {
    this.activityLoading=true;this.activityError='';
    this.keyService
      .getMemberActivity(this.memberId)
      .pipe(take(1))
      .subscribe({next: data => {
        this.memberKeys.data = data.keys;
        this.lastEntry = data.lastEntry;
        this.activityLoading=false;this.sectionLoaded('keys');
      }, error: () => {
        this.activityLoading=false;this.activityError='Could not load access keys and entry history. Please refresh.';
        this.sectionLoaded('keys');
      }});
  }

  makeQRCode() {
    const qrcode = qr(4, 'M');
    qrcode.addData(this.memberId);
    qrcode.make();
    this.qrCode = qrcode.createDataURL(3, 0);
  }

  uploadMemberImage(file) {
    // this.uploadService.uploadfile(file, 'setMemberImage', {
    //   MemberKey: this.Key
    // });
    this.uploadService.uploadMemberImage(file, this.memberId);
  }

  addKey() {
    this.dialog
      .open(AddKeyComponent, {
        disableClose: true,
        data: { memberKey: this.memberId },
      })
      .afterClosed()
      .subscribe((result) => {
        this.loadKeys();
      });
  }

  setKeyStatus(key: Key) {
    const status=key.status==='Active'?'Inactive':'Active';
    this.dialog.open(AlertDialogComponent,{data:{header:status==='Active'?'Enable fob':'Disable fob',OkCancel:true,requireReason:true,message:`Set fob ${key.serialNumber} to ${status.toLowerCase()}?`}}).afterClosed().subscribe(result=>{
      if(!result?.reason)return;
      this.keyService.saveKey({...key,status},result.reason,key.status).then(()=>{this.loadKeys();this.snackBar.open(`Fob ${status.toLowerCase()}`,null,{duration:2000});}).catch(err=>this.snackBar.open(err.error?.message||'Could not update fob.',null,{duration:5000}));
    });
  }
  deleteKey(key: Key) {
    this.dialog.open(AlertDialogComponent,{data:{header:'Remove fob',OkCancel:true,requireReason:true,message:`Remove fob ${key.serialNumber} from this account? Its change history will remain in the audit log.`}}).afterClosed().subscribe(result=>{
      if(!result?.reason)return;
      this.keyService.deleteKey(key,result.reason).then(()=>{this.loadKeys();this.snackBar.open('Fob removed',null,{duration:2000});}).catch(err=>this.snackBar.open(err.error?.message||'Could not remove fob.',null,{duration:5000}));
    });
  }

  addEditTransaction(id) {
    this.dialog
      .open(AddTransactionComponent, {
        disableClose: true,
        width:'540px', maxWidth:'calc(100vw - 24px)', panelClass:'billing-entry-dialog',
        data: { id: id, memberId: this.memberId, memberName: this.originalContact ? `${this.originalContact.firstName} ${this.originalContact.lastName}`.trim() : this.headerText },
      })
      .afterClosed()
      .subscribe((result) => {
        if(result==='Saved')this.loadBilling();
      });
  }

  addEditPlan(Id) {
    if (Id === 'New' && this.openPlan) {
      this.changingPlan=true;
      this.openCutoff(this.memberPlans.data.find(p=>!p.endDate));
      this.jump('membership-billing');
      return;
    }

    this.dialog
      .open(AddEditMemberPlanComponent, {
        disableClose: true,
        data: { Id: Id, memberId: this.memberId },
      })
      .afterClosed()
      .subscribe((result) => {
        this.loadPlans();
      });
  }

  loadValuesIfExisting(memberId) {
    this.memberService.getMember(memberId).subscribe({next:(data) => {
      Object.keys(data).forEach((KeyName) => {
        if (this.form.controls[KeyName]) {
          this.form.controls[KeyName].setValue(['phone','emergencyPhone'].includes(KeyName)?(formatPhone(data[KeyName])??data[KeyName]):data[KeyName]);
        }
      });
      this.memberPicture = data.picture || '';
      this.navigation.rememberMember(memberId,`${data.firstName} ${data.lastName}`.trim());
      this.originalContact={...this.form.getRawValue()};this.form.markAsPristine();
      this.form.enable();this.contactLoading=false;
      this.sectionLoaded('member');
    },error:()=>{this.saveError='Could not load contact details. Refresh before editing.';}});
  }

  ngOnInit() {}

  updateMemberBalance() {
    this.loadBilling();
  }

  back() {
    this.router.navigateByUrl(this.returnUrl);
  }

  async save(navigateAfterCreate=true):Promise<boolean> {
    this.form.markAllAsTouched();if(this.form.invalid||this.saving||this.contactLoading)return false;
    this.saving=true;this.saveError='';
    const submitted=this.form.getRawValue();this.form.disable();
    try{
      const data=await this.memberService.saveMember(submitted).pipe(take(1)).toPromise();
      const isNew=this.memberId==='New';this.form.patchValue(data);this.originalContact={...this.form.getRawValue()};this.form.markAsPristine();
      if(isNew&&navigateAfterCreate){this.created=true;await this.router.navigate(['/member',data.id],{queryParams:{returnTo:this.returnUrl},replaceUrl:true});}
      this.snackBar.open(isNew?'Member created':'Contact details saved',null,{duration:2500});return true;
    }catch(err){this.saveError=err.error?.message||'Could not save contact details. Please try again.';return false;}
    finally{this.saving=false;if(!this.contactLoading)this.form.enable();}
  }
}
