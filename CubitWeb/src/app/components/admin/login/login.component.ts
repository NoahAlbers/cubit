import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/security/auth.service';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('gear') gear?: ElementRef<HTMLImageElement>;
  form: UntypedFormGroup;
  loginError = '';
  showPassword = false;
  pending = false;
  demoAvailable = false;
  private request?: Subscription;
  private animation?: Animation;
  private angle = 0;
  private target = 0;
  private motion = 'idle';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private stopMotion = () => this.freeze();

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
    this.http.get<any>('/health').subscribe(d=>this.demoAvailable=d.dataMode==='demo');
    this.reducedMotion.addEventListener('change', this.stopMotion);
    if (this.auth.validToken()) this.router.navigateByUrl(this.auth.home);
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.animation?.cancel();
    this.reducedMotion.removeEventListener('change', this.stopMotion);
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
