import {Section} from '@/components/site/sections';
import {getSiteCopy,LEGAL_UPDATED} from '@/i18n/site';
import {formatDate} from '@/lib/format';
import type {Locale} from '@/i18n/dictionary';

/**
 * The shared shape of the two legal pages.
 *
 * Both are long documents, so each gets a numbered table of contents that
 * doubles as in page navigation, and section anchors that survive being linked
 * from an email or a contract.
 */

const slug=(index:number)=>`s${index+1}`;

export function LegalPage({
 locale,document,
}:{locale:Locale;document:{title:string;intro:string;sections:readonly {title:string;body:string}[]}}){
 const t=getSiteCopy(locale);
 return (
  <Section>
   <div className="grid gap-12 lg:grid-cols-[0.32fr_1fr] lg:gap-14">
    <div className="lg:sticky lg:top-24 lg:self-start">
     <h1 className="text-[1.9rem] leading-tight tracking-tight">{document.title}</h1>
     <p className="mt-3 text-[12.5px] text-[var(--text-faint)]">
      {t.legal.updated}: {formatDate(LEGAL_UPDATED,locale)}
     </p>
     <nav aria-label={t.legal.tocTitle} className="mt-6 hidden lg:block">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{t.legal.tocTitle}</p>
      <ol className="mt-3 space-y-2">
       {document.sections.map((section,index)=>(
        <li key={section.title} className="flex gap-2 text-[13px] leading-snug">
         <span className="tabular-nums text-[var(--text-faint)]">{index+1}</span>
         <a href={`#${slug(index)}`} className="text-[var(--text-muted)] transition-colors hover:text-copper-700">
          {section.title}
         </a>
        </li>
       ))}
      </ol>
     </nav>
    </div>

    <div className="max-w-3xl">
     <p className="text-[15.5px] leading-relaxed text-[var(--text-muted)]">{document.intro}</p>
     <div className="mt-10 space-y-9">
      {document.sections.map((section,index)=>(
       <section key={section.title} id={slug(index)} className="scroll-mt-24">
        <h2 className="flex gap-3 text-[17px] leading-snug">
         <span aria-hidden className="tabular-nums text-copper-700">{index+1}</span>
         {section.title}
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.85] text-[var(--text-muted)]">{section.body}</p>
       </section>
      ))}
     </div>
    </div>
   </div>
  </Section>
 );
}
