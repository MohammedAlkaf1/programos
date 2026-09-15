import {describe,it,expect} from 'vitest';
import {otp,verifyOtp,seal,unseal} from '../src/lib/totp';
describe('TOTP RFC 6238 vectors and replay protection',()=>{
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 it.each([[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])('matches RFC timestamp %s',(time,code)=>expect(otp(secret,Math.floor(Number(time)/30),8)).toBe(code));
 it('rejects reused and incorrect codes',()=>{expect(verifyOtp(secret,'287082',0,59000)).toBe(1);expect(verifyOtp(secret,'287082',1,59000)).toBeNull();expect(verifyOtp(secret,'000000',0,59000)).toBeNull();});
 it('authenticates encrypted secrets',()=>{process.env.AUTH_SECRET='unit-test-only';const value=seal(secret);expect(unseal(value)).toBe(secret);const b=Buffer.from(value,'base64');b[20]^=1;expect(()=>unseal(b.toString('base64'))).toThrow();});
});
