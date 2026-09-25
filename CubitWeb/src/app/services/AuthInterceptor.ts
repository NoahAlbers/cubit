import { OrganizationService } from './organization.service';
import { Injector, Injectable } from "@angular/core";
import { from as fromPromise, Observable } from "rxjs";

import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { AuthService } from "./security/auth.service";
import { tap } from "rxjs/operators";
import { Router } from "@angular/router";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private router: Router, private injector:Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    // console.log('intercept injecting:', this.auth.userToken);
    let reqClone = req.clone({
      headers: req.headers.set(
        "Authorization",
        "Bearer " + this.auth.authToken
      ),
    });
    return next.handle(reqClone).pipe(
      tap(
        event => {if(event instanceof HttpResponse){const timezone=event.headers.get('X-Cubit-Timezone');if(timezone)this.injector.get(OrganizationService).acceptTimezone(timezone);}},
        (err: any) => {
          if (err instanceof HttpErrorResponse) {
            if (err.status !== 401 || req.url==='/login' || req.url==='/api/account/redeem') {
              return;
            }
            this.auth.logout();
          }
        }
      )
    );
  }
}
