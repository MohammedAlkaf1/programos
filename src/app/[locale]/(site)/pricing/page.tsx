import type {Metadata} from 'next';
import {Check} from 'lucide-react';
import {db} from '@/lib/db';
import {formatMoney} from '@/lib/plan-math';
import {Section,SectionHead,CtaLink,Card,Faq,Eyebrow} from '@/components/site/sections';
import {Arrow} from '@/components/site/site-chrome';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

/**
 * Pricing reads the same plan rows the billing engine enforces, so the page a
 * visitor sees and the limits a workspace actually gets can never disagree.
 */

export const revalidate=300;

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale:raw}=await params;
 const t=getSiteCopy(isLocale(raw)?raw:'ar');
 return {title:t.pricing.title,description:t.pricing.body};
}

export default async function PricingPage({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 const t=getSiteCopy(locale);
 const plans=await db.plan.findMany({where:{active:true},orderBy:{sortOrder:'asc'}});
 const limit=(value:number)=>value<0?t.pricing.unlimited:new Intl.NumberFormat(locale==='ar'?'ar-SA-u-nu-latn':'en-GB').format(value);
 const featureLabel=(code:string)=>t.pricing.featureLabels[code as keyof typeof t.pricing.featureLabels]??code;
 const columns=plans.length>=4?'md:grid-cols-2 xl:grid-cols-4':'lg:grid-cols-3';

 return (
  <>
   <Section>
    <SectionHead eyebrow={t.pricing.eyebrow} title={t.pricing.title} body={t.pricing.body} align="center" level="h1"/>
    <div className={`mt-12 grid gap-5 ${columns}`}>
     {plans.map(plan=>{
      // The Growth plan is where most organizations land, so the page recommends it.
      const featured=plan.code==='growth';
      const contact=plan.maxPrograms<0;
      return (
       <Card key={plan.id} className={featured?'relative border-copper-600 shadow-[var(--shadow-raised)]':undefined}>
        {featured?(
         <span className="absolute -top-3 rounded-full bg-copper-600 px-3 py-1 text-[11.5px] font-semibold text-white start-6">
          {t.pricing.featured}
         </span>
        ):null}
        <h2 className="text-[17px] font-semibold">{locale==='ar'?plan.nameAr:plan.nameEn}</h2>
        <p className="mt-1.5 min-h-[3.9rem] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
         {locale==='ar'?plan.descriptionAr:plan.descriptionEn}
        </p>
        <p className="mt-5 flex items-baseline gap-2">
         <span className="text-[2rem] font-semibold tabular-nums tracking-tight">
          {plan.priceMonthly===0?t.pricing.free:formatMoney(plan.priceMonthly,plan.currency,locale)}
         </span>
         {plan.priceMonthly>0?<span className="text-[13px] text-[var(--text-muted)]">{t.pricing.perMonth}</span>:null}
        </p>
        <ul className="mt-5 space-y-2.5 border-t border-[var(--line-soft)] pt-5 text-[13.5px]">
         <li className="flex items-baseline justify-between gap-3">
          <span className="text-[var(--text-muted)]">{t.pricing.limits.programs}</span>
          <span className="font-semibold tabular-nums">{limit(plan.maxPrograms)}</span>
         </li>
         <li className="flex items-baseline justify-between gap-3">
          <span className="text-[var(--text-muted)]">{t.pricing.limits.members}</span>
          <span className="font-semibold tabular-nums">{limit(plan.maxMembers)}</span>
         </li>
         <li className="flex items-baseline justify-between gap-3">
          <span className="text-[var(--text-muted)]">{t.pricing.limits.enrollments}</span>
          <span className="font-semibold tabular-nums">{limit(plan.maxEnrollments)}</span>
         </li>
        </ul>
        {plan.features.length?(
         <div className="mt-5 border-t border-[var(--line-soft)] pt-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{t.pricing.includes}</p>
          <ul className="mt-2.5 space-y-2 text-[13px]">
           {plan.features.map(code=>(
            <li key={code} className="flex items-start gap-2">
             <Check size={15} className="mt-0.5 shrink-0 text-copper-600" aria-hidden/>
             {featureLabel(code)}
            </li>
           ))}
          </ul>
         </div>
        ):null}
        <div className="mt-6">
         <CtaLink
          href={contact?`/${locale}/contact`:`/${locale}/register?plan=${plan.code}`}
          variant={featured?'primary':'secondary'}
         >
          {contact?t.pricing.contactCta:t.pricing.cta}
          <Arrow locale={locale}/>
         </CtaLink>
        </div>
       </Card>
      );
     })}
    </div>
    <div className="mx-auto mt-8 max-w-3xl space-y-2 text-center text-[13px] leading-relaxed text-[var(--text-muted)]">
     <p>{t.pricing.payment}</p>
     <p>{t.pricing.nonprofit}</p>
     <p className="text-[12.5px] text-[var(--text-faint)]">{t.pricing.vat}</p>
    </div>
   </Section>

   <Section tone="sunken">
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
     <div>
      <Eyebrow>{t.pricing.eyebrow}</Eyebrow>
      <h2 className="mt-3 text-[1.6rem] leading-tight tracking-tight">{t.pricing.featuresTitle}</h2>
     </div>
     <ul className="grid gap-3 sm:grid-cols-2">
      {t.pricing.features.map(feature=>(
       <li key={feature} className="flex items-start gap-2.5 text-[14px]">
        <Check size={16} className="mt-0.5 shrink-0 text-copper-600" aria-hidden/>
        {feature}
       </li>
      ))}
     </ul>
    </div>
   </Section>

   <Section>
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
     <SectionHead title={t.pricing.faqTitle}/>
     <Faq items={t.pricing.faq}/>
    </div>
   </Section>
  </>
 );
}
