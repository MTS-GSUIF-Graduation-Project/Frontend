import { HttpErrorResponse } from '@angular/common/http';
import { ApiException } from '../models/api-response.model';
import { toApiException } from './api-error';

describe('toApiException', () => {
  it('keeps the GSUIF envelope message and field errors with the HTTP status', () => {
    const error = toApiException(httpError(400, {
      status: 'BAD_REQUEST',
      clientMessage: 'Validation failed',
      statusCode: 400,
      body: null,
      errors: { username: 'Username is required' }
    }), 'Sign-in failed.');

    expect(error.statusCode).toBe(400);
    expect(error.clientMessage).toBe('Validation failed');
    expect(error.errors).toEqual({ username: 'Username is required' });
  });

  it('keeps nonzero statuses for HTML or empty error bodies', () => {
    expect(toApiException(httpError(500, '<html>Server Error</html>'), 'Sign-in failed.')).toMatchObject({
      statusCode: 500,
      clientMessage: 'An unexpected server error occurred.',
      errors: null
    });
    expect(toApiException(httpError(502, null), 'Sign-in failed.')).toMatchObject({
      statusCode: 502,
      clientMessage: 'The service is temporarily unavailable.'
    });
    expect(toApiException(httpError(503, ''), 'Sign-in failed.').statusCode).toBe(503);
  });

  it('reports network failures with status 0', () => {
    const error = toApiException(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }), 'Sign-in failed.');

    expect(error.statusCode).toBe(0);
    expect(error.clientMessage).toBe('Unable to reach the server.');
  });

  it('uses the caller fallback for other statuses without an envelope', () => {
    expect(toApiException(httpError(404, 'Not Found'), 'Sign-in failed.')).toMatchObject({
      statusCode: 404,
      clientMessage: 'Sign-in failed.'
    });
  });

  it('passes ApiException through and wraps unknown errors', () => {
    const apiError = new ApiException(401, 'Invalid username or password', null);

    expect(toApiException(apiError, 'Sign-in failed.')).toBe(apiError);
    expect(toApiException(new TypeError('boom'), 'Sign-in failed.')).toMatchObject({ statusCode: 0, clientMessage: 'Sign-in failed.' });
  });
});

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error, url: '/api/auth/login' });
}
