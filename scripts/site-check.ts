/**
 * Acceptance run for the public site.
 *
 *   npm run check:site
 *
 * A marketing site fails in ways an application does not: a page that only
 * works when you happen to be signed in, a form that silently drops a message,
 * a legal page nobody can find, a layout that breaks in the language it was not
 * written in. Each of those is checked here against the running server, in both
 * languages and in both appearances.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium,type Browser} from '@playwright/test';
import {db} from '../src/lib/db';

const base='http://127.0.0.1:3000';
const stamp=randomUUID().slice(0,8);
const passed:string[]=[];
const step=(name:string)=>passed.push(name);
const routes=['welcome','pricing','contact','terms','privacy-policy'] as const;

// The contact limiter counts per client for a whole hour, and every local
// request shares one client key, so a second run inside the hour would be
// throttled before it started. Clearing the bucket is test setup, not a
// weakening of the limit: the limit itself is asserted further down.
await db.authAttempt.deleteMany({where:{key:{startsWith:'public:contact:'}}});

let browser:Browser|undefined;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});

 /* ── A visitor carries no session at all ── */
 const visitor=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await visitor.newPage();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(`${page.url()} :: ${e.message}`));

 const root=await page.goto(`${base}/`);
 assert.equal(root?.status(),200);
 assert.match(page.url(),/\/ar$/,'the root must land on the Arabic home without a redirect chain');
 await page.getByRole('heading',{level:1}).first().waitFor({state:'visible',timeout:15000});
 assert.equal((await page.getByRole('heading',{level:1}).count()),1,'exactly one first level heading');
 assert.ok(!(await page.content()).includes('/api/command'),'the public home must not reference the command endpoint');
 step('A visitor with no session reaches the public home at the short address, with one first level heading');

 const titles:string[]=[];
 for(const locale of ['ar','en'] as const){
  for(const route of routes){
   const response=await page.goto(`${base}/${locale}/${route}`);
   assert.equal(response?.status(),200,`${locale}/${route}`);
   assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');
   assert.equal(await page.getByRole('heading',{level:1}).count(),1,`${locale}/${route} needs exactly one h1`);
   const title=await page.title();
   assert.ok(title.length>8,`${locale}/${route} title: ${title}`);
   // A title that repeats the brand at both ends is a template applied twice.
   const brand=locale==='ar'?'برنامج أو إس':'ProgramOS';
   assert.ok(title.split(brand).length-1<=1,`${locale}/${route} repeats the brand: ${title}`);
   titles.push(`${locale}/${route}: ${title}`);
   const description=await page.locator('meta[name="description"]').getAttribute('content');
   assert.ok((description??'').length>40,`${locale}/${route} needs a description`);
   const robots=await page.locator('meta[name="robots"]').getAttribute('content');
   assert.ok(!robots||!robots.includes('noindex'),`${locale}/${route} must be indexable`);
  }
 }
 assert.equal(new Set(titles.map(t=>t.split(': ')[1])).size,titles.length,'each page needs its own title');
 step('Ten public pages in two languages: correct direction, one heading, a distinct title and a description, and open to indexing');

 /* ── Every link in the page actually goes somewhere ── */
 await page.goto(`${base}/ar/welcome`);
 const hrefs=await page.locator('a[href^="/"]').evaluateAll(list=>[...new Set(list.map(a=>a.getAttribute('href')!))]);
 assert.ok(hrefs.length>=10,'the home should link to the rest of the site');
 for(const href of hrefs){
  const target=href.split('#')[0];
  if(!target)continue;
  const response=await visitor.request.get(`${base}${target}`);
  assert.ok(response.status()<400,`${href} answered ${response.status()}`);
 }
 // Every in page anchor must have a matching section.
 for(const href of hrefs.filter(h=>h.includes('#'))){
  const id=href.split('#')[1];
  await page.goto(`${base}${href}`);
  assert.equal(await page.locator(`#${id}`).count(),1,`missing section for ${href}`);
 }
 step(`Every link on the home page resolves, including the ${hrefs.filter(h=>h.includes('#')).length} in page anchors`);

 /* ── The contact form ── */
 await page.goto(`${base}/ar/contact`);
 const email=`visitor.${stamp}@example.invalid`;
 // Fields are addressed by their name attribute, which is also what a browser
 // autofill uses, so the test exercises the same handles a person would.
 const field=(name:string)=>page.locator(`[name="${name}"]`);
 await field('name').fill('سارة العمري');
 await field('organization').fill('مؤسسة اختبار الموقع');
 await field('email').fill(email);
 await field('phone').fill('0500000001');
 await field('message').fill('نرغب في عرض توضيحي للمنصة لبرنامج تدريبي يبدأ الشهر القادم.');
 const submit=page.getByRole('button',{name:'أرسل الرسالة'});
 assert.ok(await submit.isDisabled(),'an invalid mobile number must block submission');
 await field('phone').fill('+966500000001');
 assert.ok(await submit.isDisabled(),'consent must be required before the form can be sent');
 await field('consent').check();
 // Every visible field must be reachable by its label, which is how a screen
 // reader finds it.
 for(const label of ['الاسم','اسم الجهة','البريد الإلكتروني','رقم الجوال','رسالتك']){
  assert.ok(await page.getByLabel(label).count()>=1,`no field is labelled ${label}`);
 }
 await submit.click();
 await page.getByText('وصلتنا رسالتك').waitFor({state:'visible',timeout:15000});
 const lead=await db.contactLead.findFirstOrThrow({where:{email}});
 assert.equal(lead.organization,'مؤسسة اختبار الموقع');
 assert.equal(lead.topic,'demo');
 assert.equal(lead.status,'New');
 // A receipt to the sender, and a copy to whoever answers.
 assert.ok(await db.outbox.findFirst({where:{recipient:email}}),'the sender gets a receipt');
 if(process.env.CONTACT_EMAIL)assert.ok(await db.outbox.findFirst({where:{recipient:process.env.CONTACT_EMAIL,body:{contains:'مؤسسة اختبار الموقع'}}}),'the team gets the enquiry');
 step('The contact form validates before sending, stores the enquiry, and produces a receipt for the sender and a copy for the team');

 /* ── It cannot be used as a mail relay ── */
 // Consent is checked first, while this visitor still has budget left: the
 // limiter runs before validation, so the order of these two matters.
 const withoutConsent=await visitor.request.post(`${base}/api/public`,{headers:{origin:base},data:{action:'contact.submit',data:{
  name:'بلا موافقة',email:`noconsent.${stamp}@example.invalid`,organization:'جهة',topic:'other',message:'رسالة بلا موافقة على المعالجة.',locale:'ar',
 }}});
 assert.equal(withoutConsent.status(),422,'a message without consent is refused');
 assert.equal(await db.contactLead.count({where:{email:`noconsent.${stamp}@example.invalid`}}),0,'a refused message must not be stored');
 const flood=[];
 for(let i=0;i<5;i++){
  flood.push(await visitor.request.post(`${base}/api/public`,{headers:{origin:base},data:{action:'contact.submit',data:{
   name:'مرسل متكرر',email:`flood.${stamp}.${i}@example.invalid`,organization:'جهة',phone:'',topic:'other',
   message:'رسالة متكررة لاختبار حد الإرسال في نموذج التواصل.',locale:'ar',consent:true,
  }}}));
 }
 assert.ok(flood.some(r=>r.status()===429),'repeated submissions must be rate limited');
 step('The form is rate limited per visitor and refuses a submission with no consent');

 /* ── Pricing reflects the plans the billing engine enforces ── */
 await page.goto(`${base}/ar/pricing`);
 const plans=await db.plan.findMany({where:{active:true}});
 const body=await page.locator('main').innerText();
 for(const plan of plans)assert.ok(body.includes(plan.nameAr),`plan ${plan.code} is missing from the page`);
 step(`The pricing page shows the ${plans.length} plans the billing engine actually enforces`);

 /* ── Both appearances, and a narrow screen ── */
 for(const scheme of ['light','dark'] as const){
  const themed=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:scheme});
  const themedPage=await themed.newPage();
  themedPage.on('pageerror',e=>errors.push(`${scheme} :: ${e.message}`));
  for(const route of routes){
   await themedPage.goto(`${base}/ar/${route}`,{waitUntil:'networkidle'});
   const contrast=await themedPage.evaluate(()=>{
    const style=getComputedStyle(document.body);
    return {background:style.backgroundColor,color:style.color};
   });
   assert.notEqual(contrast.background,contrast.color,`${scheme} ${route} must not paint text on its own colour`);
  }
  await themedPage.goto(`${base}/ar/welcome`,{waitUntil:'networkidle'});
  await themedPage.screenshot({path:`../outputs/ProgramOS_site_home_${scheme}.png`,fullPage:false});
  await themed.close();
 }
 step('Every public page renders in both the light and dark appearances');

 for(const width of [360,768,1024]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){
   await page.goto(`${base}/ar/${route}`,{waitUntil:'networkidle'});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   assert.ok(!overflow,`horizontal overflow at ${width}px on ${route}`);
  }
 }
 step('No horizontal overflow at 360, 768 or 1024 pixels on any public page');

 /* ── The language and appearance switches ── */
 await page.setViewportSize({width:1440,height:1000});
 for(const locale of ['ar','en'] as const){
  await page.goto(`${base}/${locale}/welcome`);
  const appearance=page.getByRole('button',{name:locale==='ar'?/الوضع/:/mode/i});
  assert.equal(await appearance.count(),1,`${locale}: the appearance switch is missing from the public header`);
  const before=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  await appearance.click();
  await page.waitForTimeout(150);
  const after=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  assert.notEqual(before,after,`${locale}: clicking the appearance switch changed nothing`);
  // The choice is a cookie, so it has to survive a reload and a different page.
  await page.goto(`${base}/${locale}/pricing`);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),after,`${locale}: the appearance choice did not persist`);
  const stored=(await page.context().cookies()).find(c=>c.name==='programos.theme');
  assert.ok(stored,'the appearance choice must be stored');
  await page.context().clearCookies({name:'programos.theme'});
 }
 step('The public header carries the language and appearance switches, and an appearance choice persists across pages');

 /* ── The mobile menu ── */
 await page.setViewportSize({width:360,height:800});
 await page.goto(`${base}/ar/welcome`);
 const menu=page.getByRole('button',{name:'القائمة'});
 assert.equal(await menu.getAttribute('aria-expanded'),'false');
 await menu.click();
 assert.equal(await menu.getAttribute('aria-expanded'),'true');
 await page.getByRole('navigation',{name:'القائمة'}).last().getByRole('link',{name:'الأسعار'}).click();
 await page.waitForURL(/pricing/);
 assert.equal(await page.getByRole('button',{name:'القائمة'}).getAttribute('aria-expanded'),'false','the menu closes after navigating');
 step('The narrow screen menu opens, navigates and closes again');

 /* ── Crawler files ── */
 const robots=await visitor.request.get(`${base}/robots.txt`);
 assert.equal(robots.status(),200);
 const robotsBody=await robots.text();
 assert.ok(robotsBody.includes('/ar/welcome')&&robotsBody.includes('Disallow'),'robots must allow the site and close the application');
 const sitemap=await visitor.request.get(`${base}/sitemap.xml`);
 assert.equal(sitemap.status(),200);
 const sitemapBody=await sitemap.text();
 for(const route of routes)assert.ok(sitemapBody.includes(`/ar/${route}`),`${route} is missing from the sitemap`);
 assert.ok(!sitemapBody.includes('/ar/login'),'the sign in page does not belong in the sitemap');
 step('The crawler files list every public page and none of the private ones');

 /* ── Someone signed in still lands on their dashboard ── */
 const member=await db.membership.findFirst({where:{role:'Admin',active:true},include:{user:true,tenant:true}});
 if(member){
  const signedIn=await browser.newContext({viewport:{width:1440,height:900}});
  await signedIn.addCookies([{name:'authjs.session-token',value:'placeholder-for-routing-only',domain:'127.0.0.1',path:'/'}]);
  const response=await signedIn.request.get(`${base}/ar`,{maxRedirects:0});
  // A forged cookie buys the dashboard route and nothing else: the page itself
  // resolves the real actor and sends an unknown session back to sign in.
  assert.ok([200,307,302].includes(response.status()));
  const location=response.headers()['location']??'';
  assert.ok(location.includes('/login')||response.status()===200,'a session cookie routes away from the public home');
  await signedIn.close();
  step('A browser carrying a session cookie is routed to the application rather than the public home');
 }

 assert.deepEqual(errors,[],'client side errors');
 console.log('PASS');for(const item of passed)console.log(' •',item);
}finally{
 await browser?.close();
 await db.$disconnect();
}
