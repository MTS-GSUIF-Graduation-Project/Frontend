import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiEndpoints } from '../http/api-endpoints';
import { toApiException } from '../http/api-error';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
const REQUEST_FAILED_MESSAGE = 'The request could not be completed.';

/**
 * Set on requests whose callers render errors inline. 401 handling still applies;
 * only the global notification for other errors is skipped.
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const notifications = inject(NotificationService);
  const router = inject(Router);
  const isProtected = inject(ApiEndpoints).isProtected(request.url);

  return next(request).pipe(
    catchError(error => {
      if (isProtected && error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          auth.clearSession();
          notifications.show(SESSION_EXPIRED_MESSAGE);

          if (router.url.split(/[?#]/)[0] !== '/login') {
            void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          }
        } else if (!request.context.get(SKIP_ERROR_NOTIFICATION)) {
          notifications.show(toApiException(error, REQUEST_FAILED_MESSAGE).clientMessage);
        }
      }

      return throwError(() => error);
    })
  );
};
