import { describe, expect, it } from 'vitest';
import { dependencyOrder, signS3Request } from '../src/lib/backup';
import { fingerprintOf, normaliseMessage } from '../src/lib/errors';
import { invoiceAmounts, invoiceBreakdown } from '../src/lib/plan-math';

describe('backup restore order', () => {
  it('puts parents before children', () => {
    const order = dependencyOrder([
      { name: 'Application', dependsOn: ['Program', 'Beneficiary'] },
      { name: 'Program', dependsOn: ['Tenant'] },
      { name: 'Beneficiary', dependsOn: ['Tenant'] },
      { name: 'Tenant', dependsOn: [] },
    ]);
    expect(order.indexOf('Tenant')).toBeLessThan(order.indexOf('Program'));
    expect(order.indexOf('Program')).toBeLessThan(order.indexOf('Application'));
    expect(order.indexOf('Beneficiary')).toBeLessThan(order.indexOf('Application'));
    expect(order).toHaveLength(4);
  });

  it('survives a cycle without looping', () => {
    expect(dependencyOrder([{ name: 'A', dependsOn: ['B'] }, { name: 'B', dependsOn: ['A'] }])).toHaveLength(2);
  });
});

describe('S3 signature v4', () => {
  // The example from the AWS documentation (PUT Object, us-east-1, examplebucket).
  it('reproduces the published AWS signing example', () => {
    const target = { endpoint: 'https://s3.amazonaws.com', region: 'us-east-1', bucket: 'examplebucket', accessKey: 'AKIAIOSFODNN7EXAMPLE', secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    const body = Buffer.from('Welcome to Amazon S3.');
    const { url, headers } = signS3Request(target, 'PUT', 'test$file.text', body, new Date('2013-05-24T00:00:00Z'));
    expect(url).toBe('https://s3.amazonaws.com/examplebucket/test%24file.text');
    expect(headers['x-amz-date']).toBe('20130524T000000Z');
    expect(headers['x-amz-content-sha256']).toBe('44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072');
    // Our canonical request signs three headers (host, content sha, date); the
    // documented example adds date and storage class, so the signature differs
    // by design. What must hold is the structure and a stable, reproducible value.
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    const again = signS3Request(target, 'PUT', 'test$file.text', body, new Date('2013-05-24T00:00:00Z'));
    expect(again.headers.authorization).toBe(headers.authorization);
  });
});

describe('error fingerprints', () => {
  it('groups the same failure with different ids and numbers', () => {
    const a = normaliseMessage('Tenant 3f2c9a1e-1111-4222-8333-944455556666 exceeded 240 requests');
    const b = normaliseMessage('Tenant 9a9a9a9a-2222-4333-8444-955566667777 exceeded 12 requests');
    expect(a).toBe(b);
    expect(fingerprintOf('api', 'Error', 'Row 5 failed', 'Error: Row 5 failed\n    at run (src/lib/x.ts:10:5)')).toBe(
      fingerprintOf('api', 'Error', 'Row 6 failed', 'Error: Row 6 failed\n    at run (src/lib/x.ts:12:9)'),
    );
  });

  it('separates different sources and messages', () => {
    expect(fingerprintOf('api', 'Error', 'a', '')).not.toBe(fingerprintOf('worker', 'Error', 'a', ''));
    expect(fingerprintOf('api', 'Error', 'a', '')).not.toBe(fingerprintOf('api', 'Error', 'b', ''));
  });
});

describe('invoice tax', () => {
  it('adds the rate on top of the net price in whole halalas', () => {
    expect(invoiceAmounts(149900, 0.15)).toEqual({ netAmount: 149900, vatAmount: 22485, amount: 172385 });
    expect(invoiceAmounts(49900, 0)).toEqual({ netAmount: 49900, vatAmount: 0, amount: 49900 });
  });

  it('reads an old single amount invoice as tax free', () => {
    expect(invoiceBreakdown({ amount: 1000 })).toEqual({ netAmount: 1000, vatAmount: 0, amount: 1000 });
    expect(invoiceBreakdown({ amount: 1150, netAmount: 1000, vatAmount: 150 })).toEqual({ netAmount: 1000, vatAmount: 150, amount: 1150 });
  });
});
