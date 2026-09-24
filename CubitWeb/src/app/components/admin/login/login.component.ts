import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/security/auth.service';
import { take, timeout } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('gear') gear?: ElementRef<HTMLImageElement>;
  form: UntypedFormGroup;
  loginError = '';
  showPassword = false;
  pending = false;
  demoAvailable = false;
  firstName: string | null = null;
  storyWord = 'make';
  storyFading = false;
  private readonly storyWords = ['make', 'build', 'fix'];
  private storyIndex = 0;
  private storyTimer?: ReturnType<typeof setInterval>;
  private storyFadeTimer?: ReturnType<typeof setTimeout>;
  private greetingAttempted = false;
  private greetingEmail = '';
  private greetingRequest?: Subscription;
  private emailChanges?: Subscription;
  private healthRequest?: Subscription;
  private request?: Subscription;
  private animation?: Animation;
  private angle = 0;
  private target = 0;
  private motion = 'idle';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private stopMotion = () => { this.freeze(); this.scheduleStory(); };
  private visibilityChanged = () => this.scheduleStory();

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private router: Router,
    private http: HttpClient
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.healthRequest = this.http.get<any>('/health').subscribe({
      next: d => this.demoAvailable = d.mode === 'local-development' && d.dataMode === 'demo',
      error: () => this.demoAvailable = false,
    });
    this.emailChanges = this.form.controls['email'].valueChanges.subscribe(value => {
      if (this.greetingAttempted && value !== this.greetingEmail) {
        this.firstName = null;
        this.greetingRequest?.unsubscribe();
      }
    });
    this.reducedMotion.addEventListener('change', this.stopMotion);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.scheduleStory();
    if (this.auth.validToken()) this.router.navigateByUrl(this.auth.home);
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.healthRequest?.unsubscribe();
    this.greetingRequest?.unsubscribe();
    this.emailChanges?.unsubscribe();
    clearInterval(this.storyTimer);
    clearTimeout(this.storyFadeTimer);
    this.animation?.cancel();
    this.reducedMotion.removeEventListener('change', this.stopMotion);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }

  recognizeBrowser() {
    const email = this.form.controls['email'];
    if (this.greetingAttempted || email.invalid || this.pending) return;
    this.greetingAttempted = true;
    this.greetingEmail = email.value;
    // One attempt after leaving the email field. Editing it cancels stale responses.
    this.greetingRequest = this.http.post<{firstName: string | null}>('/login/greeting', {
      email: email.value.trim().toLowerCase(),
    }).pipe(take(1), timeout(3000)).subscribe({
      next: result => {
        if (email.value === this.greetingEmail && typeof result.firstName === 'string') {
          this.firstName = result.firstName.slice(0, 40);
        }
      },
      error: () => { this.firstName = null; },
    });
  }

  private scheduleStory() {
    clearInterval(this.storyTimer);
    clearTimeout(this.storyFadeTimer);
    this.storyFading = false;
    if (this.reducedMotion.matches) { this.storyWord = 'make'; this.storyIndex = 0; return; }
    if (document.hidden) return;
    this.storyTimer = setInterval(() => {
      this.storyFading = true;
      this.storyFadeTimer = setTimeout(() => {
        this.storyIndex = (this.storyIndex + 1) % this.storyWords.length;
        this.storyWord = this.storyWords[this.storyIndex];
        this.storyFading = false;
      }, 200);
    }, 8000);
  }

  demo(member: boolean) {
    if (this.pending || !this.demoAvailable) return;
    this.form.setValue({email: member ? 'alex@example.test' : 'admin@example.test',password:'LocalDemoOnly!2026'});
    this.login();
  }

  login() {
    if (this.pending || this.form.invalid) return;
    this.freeze();
    this.pending = true;
    this.loginError = '';
    const formValues = this.form.value;

    this.request = this.auth
      .login(formValues.email, formValues.password)
      .pipe(take(1))
      .subscribe(
        () => {
          this.resultMotion(true);
          this.router.navigateByUrl(this.auth.home);
        },
        (err) => {
          this.pending = false;
          this.loginError = err.status === 401 ? 'Invalid email or password.' : 'Unable to sign in. Please try again.';
          this.resultMotion(false);
        }
      );
  }

  private freeze() {
    const gear = this.gear?.nativeElement;
    if (!gear) return;
    if (this.animation) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(gear).transform);
      this.angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      this.animation.cancel();
      this.animation = undefined;
    }
    gear.style.transform = `rotate(${this.angle}deg)`;
    this.target = this.angle;
    this.motion = 'idle';
  }
  onInput(event: Event) {
    if (this.pending) return;
    this.loginError = '';
    const input = event as InputEvent;
    const direction = input.inputType?.startsWith('delete') ? -1 : 1;
    const motion = direction < 0 ? 'deleting' : 'typing';
    // Reverse immediately on a direction change; only queue motion in the same direction.
    const queued = this.motion === motion ? this.target : null;
    this.freeze();
    const gear = this.gear?.nativeElement;
    if (!gear || this.reducedMotion.matches) return;
    const count = Math.min(24, Math.max(1, [...(input.data || '')].length));
    const remaining = queued === null ? 0 : ((direction * (queued - this.angle) % 360) + 360) % 360;
    const end = this.angle + direction * (remaining + count * 8);
    this.target = end;
    this.motion = motion;
    const animation = gear.animate([{transform:`rotate(${this.angle}deg)`}, {transform:`rotate(${end}deg)`}], {
      duration: Math.min(500, 190 + Math.abs(end - this.angle) * 2), easing: 'cubic-bezier(.18,.7,.25,1)', fill: 'forwards'
    });
    this.animation = animation;
    animation.onfinish = () => {
      this.angle = end;
      gear.style.transform = `rotate(${end}deg)`;
      animation.cancel();
      this.animation = undefined;
      this.motion = 'idle';
    };
  }
  private resultMotion(success: boolean) {
    this.freeze();
    const gear = this.gear?.nativeElement;
    if (!gear || this.reducedMotion.matches) return;
    if (success) {
      this.animation = gear.animate([{transform:`rotate(${this.angle}deg)`}, {transform:`rotate(${this.angle + 360}deg)`}], {
        duration:3800, iterations:Infinity, easing:'linear'
      });
    } else {
      const start = this.angle;
      const animation = gear.animate([0,14,4,17,8,11,7,8].map((offset,i) => ({
        transform:`rotate(${start + offset}deg)`, offset:[0,.18,.29,.43,.56,.69,.85,1][i]
      })), {duration:620, easing:'linear', fill:'forwards'});
      this.animation = animation;
      animation.onfinish = () => {
        this.angle = start + 8;
        gear.style.transform = `rotate(${this.angle}deg)`;
        animation.cancel();
        this.animation = undefined;
      };
    }
  }
}
