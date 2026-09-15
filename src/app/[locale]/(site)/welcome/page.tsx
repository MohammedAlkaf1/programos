import {
 FolderKanban,FileText,Gavel,Users,CalendarCheck,TrendingUp,BarChart3,ShieldCheck,
 Plug,Sparkles,MapPin,Lock,Languages,ScrollText,
} from 'lucide-react';
import {PlatformJourney3D} from '@/components/site/platform-journey-3d';
import {Section,SectionHead,Eyebrow,CtaLink,Card,Faq,Point} from '@/components/site/sections';
import {Arrow as DirectionArrow} from '@/components/site/site-chrome';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

const MODULE_ICONS=[FolderKanban,FileText,Gavel,Users,CalendarCheck,TrendingUp,BarChart3,ShieldCheck];
const TRUST_ICONS=[MapPin,Lock,ScrollText,Languages];

export default async function WelcomePage({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 const t=getSiteCopy(locale);

 return (
  <>
   {/* ── Hero: the message on top, the journey scene across the full width below ── */}
   <section className="site-hero relative overflow-hidden text-ivory-500">
    <div
     aria-hidden
     className="absolute inset-x-0 top-0 h-[28rem] opacity-70"
     style={{backgroundImage:'radial-gradient(ellipse 60% 70% at 50% -20%, rgba(229,138,60,0.22), transparent 65%)'}}
    />
    <div className="relative mx-auto max-w-3xl px-5 pt-16 text-center sm:px-8 sm:pt-20 lg:pt-24">
     <div className="animate-rise">
      <Eyebrow tone="light">{t.hero.eyebrow}</Eyebrow>
      <h1 className="mt-4 text-[2.4rem] leading-[1.15] tracking-tight text-ivory-500 sm:text-[3.2rem]">{t.hero.title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-[16.5px] leading-relaxed text-navy-300">{t.hero.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
       <CtaLink href={`/${locale}/register`}>
        {t.hero.primary}
        <DirectionArrow locale={locale}/>
       </CtaLink>
       <CtaLink href={`/${locale}/welcome#journey`} variant="ghost">{t.hero.secondary}</CtaLink>
      </div>
      <p className="mt-4 text-[13px] text-navy-400">{t.hero.note}</p>
     </div>
    </div>
    <div className="relative mt-8 sm:mt-10">
     <PlatformJourney3D locale={locale}/>
     <p className="relative z-10 mx-auto -mt-2 max-w-2xl px-5 pb-12 text-center text-[13.5px] leading-relaxed text-navy-400 sm:pb-14">{t.hero.scene}</p>
    </div>
   </section>

   {/* ── Trust strip ────────────────────────────────────────── */}
   <div className="border-b border-[var(--line-soft)] bg-[var(--surface-sunken)]">
    <ul className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
     {t.trust.map((item,index)=>{
      const Icon=TRUST_ICONS[index]??MapPin;
      return (
       <li key={item.title} className="flex gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-copper-600" aria-hidden/>
        <span>
         <span className="block text-[14.5px] font-semibold">{item.title}</span>
         <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-muted)]">{item.body}</span>
        </span>
       </li>
      );
     })}
    </ul>
   </div>

   {/* ── The problem ────────────────────────────────────────── */}
   <Section>
    <SectionHead title={t.problem.title} body={t.problem.body} align="center"/>
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
     {t.problem.pains.map(pain=>(
      <Card key={pain.title}>
       <h3 className="text-[16px] font-semibold">{pain.title}</h3>
       <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{pain.body}</p>
      </Card>
     ))}
    </div>
   </Section>

   {/* ── How it works: the journey as a numbered timeline ──── */}
   <Section id="journey" tone="sunken">
    <SectionHead eyebrow={t.journey.eyebrow} title={t.journey.title} body={t.journey.body} align="center"/>
    <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-6">
     <span aria-hidden className="absolute top-5 hidden h-px bg-[var(--line-strong)] lg:block lg:inset-x-[10%]"/>
     {t.journey.steps.map((step,index)=>(
      <li key={step.title} className="relative flex gap-4 lg:block lg:text-center">
       <span aria-hidden className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-copper-600 text-[14px] font-bold text-white shadow-[var(--shadow-subtle)] lg:mx-auto">
        {index+1}
       </span>
       <div className="lg:mt-5">
        <h3 className="text-[15.5px] font-semibold">{step.title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>
       </div>
      </li>
     ))}
    </ol>
   </Section>

   {/* ── Who it is for ──────────────────────────────────────── */}
   <Section>
    <div className="surface grid gap-8 p-8 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
     <div>
      <h2 className="text-[1.5rem] leading-tight tracking-tight">{t.audience.title}</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--text-muted)]">{t.audience.body}</p>
     </div>
     <ul className="grid gap-6 sm:grid-cols-3">
      {t.audience.items.map(item=>(
       <li key={item.title}>
        <h3 className="text-[14.5px] font-semibold">{item.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
       </li>
      ))}
     </ul>
    </div>
   </Section>

   {/* ── Modules ────────────────────────────────────────────── */}
   <Section id="product" tone="sunken">
    <SectionHead title={t.modules.title} body={t.modules.body} align="center"/>
    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
     {t.modules.items.map((item,index)=>{
      const Icon=MODULE_ICONS[index]??FolderKanban;
      return (
       <Card key={item.title}>
        <span className="flex size-10 items-center justify-center rounded-[11px] bg-copper-100 text-copper-700" aria-hidden>
         <Icon size={19}/>
        </span>
        <h3 className="mt-4 text-[15.5px] font-semibold">{item.title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
       </Card>
      );
     })}
    </div>
   </Section>

   {/* ── Impact measurement, the differentiator ─────────────── */}
   <Section id="measurement" tone="inverse">
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
     <div>
      <SectionHead eyebrow={t.measurement.eyebrow} title={t.measurement.title} body={t.measurement.body} tone="light"/>
      <p className="mt-6 max-w-xl border-s-2 border-copper-500 ps-4 text-[14.5px] leading-relaxed text-ivory-500/90">
       {t.measurement.note}
      </p>
     </div>
     <ul className="space-y-7">
      {t.measurement.points.map(point=>(
       <Point key={point.title} title={point.title} body={point.body} tone="light"/>
      ))}
     </ul>
    </div>
   </Section>

   {/* ── Security ───────────────────────────────────────────── */}
   <Section id="security">
    <SectionHead eyebrow={t.security.eyebrow} title={t.security.title} body={t.security.body}/>
    <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
     {t.security.items.map(item=>(
      <div key={item.title}>
       <h3 className="flex items-center gap-2 text-[15.5px] font-semibold">
        <ShieldCheck size={17} className="shrink-0 text-copper-600" aria-hidden/>
        {item.title}
       </h3>
       <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>
      </div>
     ))}
    </div>
   </Section>

   {/* ── Platform and assistant ─────────────────────────────── */}
   <Section tone="sunken">
    <SectionHead title={t.platform.title} align="center"/>
    <div className="mt-12 grid gap-5 lg:grid-cols-2">
     {[{...t.platform.api,Icon:Plug},{...t.platform.ai,Icon:Sparkles}].map(block=>(
      <Card key={block.title}>
       <span className="flex size-10 items-center justify-center rounded-[11px] bg-copper-100 text-copper-700" aria-hidden>
        <block.Icon size={19}/>
       </span>
       <h3 className="mt-4 text-[17px] font-semibold">{block.title}</h3>
       <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{block.body}</p>
       <ul className="mt-4 space-y-2">
        {block.points.map(point=>(
         <li key={point} className="flex gap-2.5 text-[13.5px] text-[var(--text-muted)]">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-copper-600"/>
          {point}
         </li>
        ))}
       </ul>
      </Card>
     ))}
    </div>
   </Section>

   {/* ── Pricing teaser ─────────────────────────────────────── */}
   <Section>
    <div className="surface flex flex-col items-start gap-6 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
     <div className="max-w-xl">
      <Eyebrow>{t.pricing.eyebrow}</Eyebrow>
      <h2 className="mt-3 text-[1.7rem] leading-tight tracking-tight">{t.pricing.title}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{t.pricing.body}</p>
     </div>
     <div className="flex shrink-0 flex-wrap gap-3">
      <CtaLink href={`/${locale}/pricing`}>
       {t.nav.pricing}
       <DirectionArrow locale={locale}/>
      </CtaLink>
      <CtaLink href={`/${locale}/contact`} variant="secondary">{t.nav.contact}</CtaLink>
     </div>
    </div>
   </Section>

   {/* ── Questions ──────────────────────────────────────────── */}
   <Section tone="sunken">
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
     <SectionHead title={t.faq.title}/>
     <Faq items={t.faq.items}/>
    </div>
   </Section>

   {/* ── Closing call ───────────────────────────────────────── */}
   <Section>
    <div className="relative overflow-hidden rounded-[1.5rem] bg-navy-900 px-8 py-14 text-center sm:px-12 sm:py-16">
     <div
      aria-hidden
      className="absolute inset-0 opacity-[0.55]"
      style={{backgroundImage:'radial-gradient(circle at 80% 10%, rgba(229,138,60,0.32), transparent 48%), radial-gradient(circle at 10% 90%, rgba(58,74,98,0.9), transparent 52%)'}}
     />
     <div className="relative mx-auto max-w-2xl">
      <h2 className="text-[2rem] leading-tight tracking-tight text-ivory-500 sm:text-[2.3rem]">{t.cta.title}</h2>
      <p className="mt-4 text-[15.5px] leading-relaxed text-navy-300">{t.cta.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
       <CtaLink href={`/${locale}/register`}>
        {t.cta.primary}
        <DirectionArrow locale={locale}/>
       </CtaLink>
       <CtaLink href={`/${locale}/contact`} variant="ghost">{t.cta.secondary}</CtaLink>
      </div>
     </div>
    </div>
   </Section>
  </>
 );
}
