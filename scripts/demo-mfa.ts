/**
 * Provisions two step verification for the demo accounts.
 *
 *   npm run demo:mfa
 *
 * Two step verification is required for every staff role, which is correct and
 * is not relaxed anywhere in the product. It does mean that trying six roles
 * means six separate setups in an authenticator app before you can look at
 * anything. This script provisions all of them with one shared secret, so a
 * single entry in the authenticator covers every demo role.
 *
 * It is a convenience for the seeded demo data and nothing more:
 *   · it refuses to run in production,
 *   · it refuses to run unless DEMO_LOGIN is on,
 *   · it only touches addresses ending in @programos.sa.
 * A real account is never reachable from here, and the sign in path itself is
 * untouched: the code is still required at every sign in.
 */
import 'dotenv/config';
import {db} from '../src/lib/db';
import {newSecret,seal,unseal,otp} from '../src/lib/totp';

const DEMO_DOMAIN='@programos.sa';

if(process.env.NODE_ENV==='production')throw new Error('demo:mfa is not available in production');
if(process.env.DEMO_LOGIN!=='1')throw new Error('demo:mfa needs DEMO_LOGIN=1, which marks this database as seeded demo data');

try{
 const accounts=await db.user.findMany({where:{email:{endsWith:DEMO_DOMAIN}},orderBy:{email:'asc'}});
 if(!accounts.length)throw new Error(`no demo accounts found. Run npm run db:seed first.`);

 // One secret for all of them, so the authenticator needs a single entry.
 const existing=accounts.find(a=>a.mfaEnabled&&a.mfaSecret);
 const reuse=process.argv.includes('--reset')?null:existing;
 const secret=reuse?unseal(reuse.mfaSecret!):newSecret();

 for(const account of accounts){
  await db.user.update({where:{id:account.id},data:{mfaEnabled:true,mfaSecret:seal(secret),mfaLastStep:0}});
 }

 const label=encodeURIComponent('ProgramOS demo');
 const uri=`otpauth://totp/${label}?secret=${secret}&issuer=ProgramOS&digits=6&period=30`;

 console.log(`${accounts.length} demo accounts now use one shared authenticator entry.\n`);
 console.log('Add this to any authenticator app (Google Authenticator, Microsoft Authenticator, 1Password):');
 console.log(`\n  secret: ${secret}`);
 console.log(`  uri:    ${uri}\n`);
 console.log(`  code right now: ${otp(secret,Math.floor(Date.now()/30000))}  (changes every 30 seconds)\n`);
 console.log('Accounts:');
 for(const account of accounts)console.log(`  ${account.email}`);
 console.log('\nPass --reset to issue a new secret and invalidate the old entry.');
}finally{
 await db.$disconnect();
}
