import {createHmac,createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newSecret(){return Array.from(randomBytes(32),b=>alphabet[b%32]).join('');}
function decode(secret:string){let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');return Buffer.from((bits.match(/.{8}/g)??[]).map(s=>parseInt(s,2)));}
export function otp(secret:string,step:number,digits=6){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const digest=createHmac('sha1',decode(secret)).update(b).digest();const offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0');}
export function verifyOtp(secret:string,code:string,last=0,now=Date.now()){if(!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);for(const s of [step,step-1,step+1])if(s>last&&timingSafeEqual(Buffer.from(otp(secret,s)),Buffer.from(code)))return s;return null;}
function key(){if(!process.env.AUTH_SECRET)throw new Error('Missing AUTH_SECRET');return createHash('sha256').update(process.env.AUTH_SECRET).digest();}
export function seal(secret:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');}
export function unseal(value:string){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
