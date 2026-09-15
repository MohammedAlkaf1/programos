import type {MetadataRoute} from 'next';
import {locales} from '@/i18n/dictionary';
import {LEGAL_UPDATED} from '@/i18n/site';

const pages=[
 {path:'welcome',priority:1},
 {path:'pricing',priority:0.8},
 {path:'contact',priority:0.6},
 {path:'terms',priority:0.3},
 {path:'privacy-policy',priority:0.3},
] as const;

export default function sitemap():MetadataRoute.Sitemap{
 const base=process.env.APP_URL??'http://127.0.0.1:3000';
 return pages.flatMap(page=>
  locales.map(locale=>({
   url:`${base}/${locale}/${page.path}`,
   lastModified:new Date(LEGAL_UPDATED),
   changeFrequency:'monthly' as const,
   priority:page.priority,
   // Each page names its twin, so a search engine serves the right language.
   alternates:{languages:Object.fromEntries(locales.map(other=>[other,`${base}/${other}/${page.path}`]))},
  })),
 );
}
