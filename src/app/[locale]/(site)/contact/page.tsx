import type {Metadata} from 'next';
import Link from 'next/link';
import {ContactForm} from '@/components/site/contact-form';
import {Section,SectionHead,Point} from '@/components/site/sections';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale:raw}=await params;
 const t=getSiteCopy(isLocale(raw)?raw:'ar');
 return {title:t.contact.title,description:t.contact.body};
}

export default async function ContactPage({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 const t=getSiteCopy(locale);

 return (
  <Section>
   <div className="grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:gap-16">
    <div>
     <SectionHead title={t.contact.title} body={t.contact.body} level="h1"/>
     <div className="mt-8">
      <ContactForm locale={locale}/>
     </div>
    </div>

    <aside className="lg:pt-16">
     <div className="surface bg-[var(--surface-sunken)] p-6">
      <h2 className="text-[15.5px] font-semibold">{t.contact.aside.title}</h2>
      <ul className="mt-4 space-y-4">
       {t.contact.aside.points.map(point=>(
        <li key={point} className="flex gap-3 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
         <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-copper-600"/>
         {point}
        </li>
       ))}
      </ul>
      <Link href={`/${locale}/register`}
       className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-navy-900 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-800">
       {t.nav.start}
      </Link>
     </div>

     <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--text-faint)]">
      {locale==='ar'
       ?'تُستخدم بياناتك للرد على رسالتك فقط، وتُحذف بعد انتهاء الغرض منها.'
       :'Your details are used to answer this message only, and are deleted once that purpose ends.'}
      {' '}
      <Link href={`/${locale}/privacy-policy`} className="font-medium text-copper-700 hover:underline">
       {t.legal.privacy.title}
      </Link>
     </p>
    </aside>
   </div>
  </Section>
 );
}
