'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Menu,X,ArrowLeft,ArrowRight} from 'lucide-react';
import {BrandMark} from '@/components/shell/brand-mark';
import {LocaleToggle} from '@/components/shell/locale-toggle';
import {ThemeToggle} from '@/components/shell/theme-toggle';
import {getSiteCopy} from '@/i18n/site';
import type {Locale} from '@/i18n/dictionary';

/**
 * The header and footer that frame every public page.
 *
 * The header is the one interactive piece of the marketing site: the language
 * switch, the light and dark switch, and a menu that opens on a narrow screen.
 * Everything below it is server rendered, so the page is readable before any
 * script arrives.
 *
 * Both switches are the same components the application uses, so a visitor who
 * picks a language or a palette here keeps it after signing in.
 */

/** Reads in the natural direction of the language rather than flipping a glyph. */
export function Arrow({locale,className}:{locale:Locale;className?:string}){
 const Icon=locale==='ar'?ArrowLeft:ArrowRight;
 return <Icon size={16} className={className} aria-hidden/>;
}

export function SiteHeader({locale}:{locale:Locale}){
 const t=getSiteCopy(locale);
 const pathname=usePathname();
 const [open,setOpen]=useState(false);

 // A link inside the open menu changes the route without unmounting the header,
 // so the menu has to be told to close.
 useEffect(()=>{setOpen(false);},[pathname]);
 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[open]);

 const links=[
  {href:`/${locale}/welcome#product`,label:t.nav.product},
  {href:`/${locale}/welcome#measurement`,label:t.nav.measurement},
  {href:`/${locale}/welcome#security`,label:t.nav.security},
  {href:`/${locale}/pricing`,label:t.nav.pricing},
  {href:`/${locale}/contact`,label:t.nav.contact},
 ];

 return (
  <header className="sticky top-0 z-50 border-b border-[var(--line-soft)] bg-[var(--surface-page)]/85 backdrop-blur-md">
   <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
    <Link href={`/${locale}/welcome`} className="shrink-0 rounded-lg" aria-label={getSiteCopy(locale).meta.title}>
     <BrandMark locale={locale} tone="dark"/>
    </Link>

    <nav aria-label={t.nav.menu} className="ms-auto hidden items-center gap-1 lg:flex">
     {links.map(link=>(
      <Link key={link.href} href={link.href}
       className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]">
       {link.label}
      </Link>
     ))}
    </nav>

    <div className="ms-auto flex items-center gap-2 lg:ms-0">
     <ThemeToggle className="hidden border border-[var(--line-strong)] p-0 size-9 items-center justify-center hover:border-navy-400 sm:inline-flex"/>
     <div className="hidden sm:block"><LocaleToggle locale={locale} compact/></div>
     <Link href={`/${locale}/login`}
      className="hidden h-9 items-center rounded-[10px] px-3 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] sm:inline-flex">
      {t.nav.login}
     </Link>
     <Link href={`/${locale}/register`}
      className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-navy-900 px-4 text-[13.5px] font-semibold text-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-navy-800">
      {t.nav.start}
     </Link>
     <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="site-menu" aria-label={t.nav.menu}
      className="inline-flex size-9 items-center justify-center rounded-[10px] border border-[var(--line-strong)] text-[var(--text-muted)] lg:hidden">
      {open?<X size={17}/>:<Menu size={17}/>}
     </button>
    </div>
   </div>

   {open?(
    <div id="site-menu" className="animate-fade border-t border-[var(--line-soft)] bg-[var(--surface-page)] lg:hidden">
     <nav aria-label={t.nav.menu} className="mx-auto grid max-w-6xl gap-1 px-5 py-3 sm:px-8">
      {links.map(link=>(
       <Link key={link.href} href={link.href}
        className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]">
        {link.label}
       </Link>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t border-[var(--line-soft)] pt-3">
       <LocaleToggle locale={locale}/>
       <ThemeToggle className="border border-[var(--line-strong)] size-9 inline-flex items-center justify-center p-0 hover:border-navy-400"/>
       <Link href={`/${locale}/login`} className="rounded-lg px-3 py-2 text-[14px] font-medium text-[var(--text-muted)]">{t.nav.login}</Link>
      </div>
     </nav>
    </div>
   ):null}
  </header>
 );
}

export function SiteFooter({locale}:{locale:Locale}){
 const t=getSiteCopy(locale);
 const groups=[
  {title:t.footer.product,links:[
   {href:`/${locale}/welcome#product`,label:t.nav.product},
   {href:`/${locale}/welcome#measurement`,label:t.nav.measurement},
   {href:`/${locale}/welcome#security`,label:t.nav.security},
   {href:`/${locale}/pricing`,label:t.nav.pricing},
  ]},
  {title:t.footer.company,links:[
   {href:`/${locale}/contact`,label:t.nav.contact},
   {href:`/${locale}/login`,label:t.nav.login},
   {href:`/${locale}/register`,label:t.nav.start},
  ]},
  {title:t.footer.legal,links:[
   {href:`/${locale}/terms`,label:t.legal.terms.title},
   {href:`/${locale}/privacy-policy`,label:t.legal.privacy.title},
   {href:'/docs/ProgramOS_User_Guide_AR.pdf',label:t.footer.guide},
  ]},
 ];
 return (
  <footer className="mt-24 border-t border-[var(--line-soft)] bg-[var(--surface-sunken)]">
   <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
     <div className="max-w-xs">
      <BrandMark locale={locale} tone="dark"/>
      <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-muted)]">{t.footer.tagline}</p>
     </div>
     {groups.map(group=>(
      <nav key={group.title} aria-label={group.title}>
       <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{group.title}</p>
       <ul className="mt-3 space-y-2">
        {group.links.map(link=>(
         <li key={link.href}>
          {link.href.endsWith('.pdf')
           ? <a href={link.href} target="_blank" rel="noopener" className="text-[13.5px] text-[var(--text-muted)] transition-colors hover:text-copper-700">{link.label}</a>
           : <Link href={link.href} className="text-[13.5px] text-[var(--text-muted)] transition-colors hover:text-copper-700">{link.label}</Link>}
         </li>
        ))}
       </ul>
      </nav>
     ))}
    </div>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-6 text-[12.5px] text-[var(--text-faint)]">
     <p>© {new Date().getFullYear()} ProgramOS. {t.footer.rights}</p>
     <p>{t.footer.madeIn}</p>
    </div>
   </div>
  </footer>
 );
}
