import type {Metadata} from 'next';
import {SiteHeader,SiteFooter} from '@/components/site/site-chrome';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

/**
 * The public shell. Unlike the application shell it loads no session and reads
 * nothing from the database, so a visitor gets HTML without a single query.
 */

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 const t=getSiteCopy(locale);
 const base=process.env.APP_URL??'http://127.0.0.1:3000';
 return {
  // `absolute` rather than `default`: the application layout above sets a
  // title template, and a default here would be fed through it, so the brand
  // name would appear at both ends of the home page title.
  title:{absolute:t.meta.title,template:`%s · ${locale==='ar'?'برنامج أو إس':'ProgramOS'}`},
  description:t.meta.description,
  // The application refuses indexing; the public pages are the one part that
  // should be found.
  robots:{index:true,follow:true},
  alternates:{canonical:`${base}/${locale}/welcome`,languages:{ar:`${base}/ar/welcome`,en:`${base}/en/welcome`}},
  openGraph:{
   type:'website',
   siteName:'ProgramOS',
   locale:locale==='ar'?'ar_SA':'en_GB',
   title:t.meta.title,
   description:t.meta.description,
   url:`${base}/${locale}/welcome`,
  },
 };
}

export default async function SiteLayout({
 children,params,
}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 return (
  <div className="flex min-h-dvh flex-col">
   {/* The first stop for a keyboard, so the whole navigation can be passed by. */}
   <a
    href="#main"
    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:z-[60] focus:rounded-[10px] focus:bg-navy-900 focus:px-4 focus:py-2.5 focus:text-[13.5px] focus:font-semibold focus:text-white focus:start-3"
   >
    {locale==='ar'?'تخطَّ إلى المحتوى':'Skip to content'}
   </a>
   <SiteHeader locale={locale}/>
   <main id="main" className="flex-1">{children}</main>
   <SiteFooter locale={locale}/>
  </div>
 );
}
