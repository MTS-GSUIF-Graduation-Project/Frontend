import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiEndpoints } from '../http/api-endpoints';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!inject(ApiEndpoints).isProtected(request.url)) {
    return next(request);
  }

  const token = inject(AuthService).getToken();

  if (!token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }));
};
