import type {ReactNode} from 'react';
import Link from 'next/link';
import {cx} from '@/lib/cx';
import type {Locale} from '@/i18n/dictionary';

/**
 * The small set of shapes every public page is built from.
 *
 * A marketing page drifts quickly when each section invents its own spacing and
 * type scale. Keeping the shapes here means the rhythm of the page is decided
 * once, and a new section inherits it instead of guessing.
 */

/**
 * `space` is a prop rather than a class the caller overrides, because two
 * padding utilities on one element are decided by their order in the generated
 * stylesheet, not by the order they were written in. Naming the cases here
 * keeps the rhythm predictable.
 */
export function Section({
 id,children,className,tone='page',space='default',
}:{id?:string;children:ReactNode;className?:string;tone?:'page'|'sunken'|'inverse';space?:'default'|'top'|'bottom'|'none'}){
 return (
  <section
   id={id}
   className={cx(
    'scroll-mt-20',
    space==='default'&&'py-20 sm:py-24',
    space==='top'&&'pt-20 sm:pt-24',
    space==='bottom'&&'pb-20 sm:pb-24',
    tone==='sunken'&&'bg-[var(--surface-sunken)]',
    tone==='inverse'&&'bg-navy-900 text-ivory-500',
    className,
   )}
  >
   <div className="mx-auto max-w-6xl px-5 sm:px-8">{children}</div>
  </section>
 );
}

export function Eyebrow({children,tone='dark'}:{children:ReactNode;tone?:'light'|'dark'}){
 return (
  <p className={cx(
   'text-[12.5px] font-semibold uppercase tracking-[0.14em]',
   tone==='light'?'text-copper-500':'text-copper-700',
  )}>
   {children}
  </p>
 );
}

/**
 * `level` exists because a page needs exactly one first level heading, and on
 * a page whose opening section is also its title that heading is this one.
 */
export function SectionHead({
 eyebrow,title,body,align='start',tone='dark',level='h2',
}:{eyebrow?:string;title:string;body?:string;align?:'start'|'center';tone?:'light'|'dark';level?:'h1'|'h2'}){
 const Heading=level;
 return (
  <div className={cx('max-w-2xl',align==='center'&&'mx-auto text-center')}>
   {eyebrow?<Eyebrow tone={tone}>{eyebrow}</Eyebrow>:null}
   <Heading className={cx(
    level==='h1'?'text-[2.1rem] leading-[1.2] tracking-tight sm:text-[2.5rem]':'text-[1.85rem] leading-[1.25] tracking-tight sm:text-[2.15rem]',
    eyebrow&&'mt-3',
    tone==='light'&&'text-ivory-500',
   )}>
    {title}
   </Heading>
   {body?(
    <p className={cx(
     'mt-4 text-[15.5px] leading-relaxed',
     tone==='light'?'text-navy-300':'text-[var(--text-muted)]',
    )}>
     {body}
    </p>
   ):null}
  </div>
 );
}

/** The primary action. Used once per screenful at most. */
export function CtaLink({
 href,children,variant='primary',locale,
}:{href:string;children:ReactNode;variant?:'primary'|'secondary'|'ghost';locale?:Locale}){
 return (
  <Link
   href={href}
   className={cx(
    'inline-flex h-11 items-center justify-center gap-2 rounded-[11px] px-5 text-[14.5px] font-semibold transition-all',
    variant==='primary'&&'bg-copper-600 text-white shadow-[var(--shadow-subtle)] hover:bg-copper-700',
    variant==='secondary'&&'border border-[var(--line-strong)] text-[var(--text-strong)] hover:border-navy-400 hover:bg-[var(--surface-sunken)]',
    variant==='ghost'&&'border border-ivory-500/25 text-ivory-500 hover:bg-white/5',
   )}
  >
   {children}
  </Link>
 );
}

export function Card({children,className}:{children:ReactNode;className?:string}){
 return (
  <div className={cx('surface h-full p-6 transition-shadow hover:shadow-[var(--shadow-raised)]',className)}>
   {children}
  </div>
 );
}

/** A numbered step. The number is decoration; the heading carries the order. */
export function Step({index,title,body}:{index:number;title:string;body:string}){
 return (
  <li className="relative ps-12">
   <span
    aria-hidden
    className="absolute top-0 flex size-9 items-center justify-center rounded-[10px] bg-copper-100 text-[14px] font-semibold text-copper-700 start-0"
   >
    {index}
   </span>
   <h3 className="text-[15.5px] font-semibold">{title}</h3>
   <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-muted)]">{body}</p>
  </li>
 );
}

/** Accessible without a line of JavaScript, and keyboard operable by default. */
export function Faq({items}:{items:readonly {q:string;a:string}[]}){
 return (
  <div className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
   {items.map(item=>(
    <details key={item.q} className="group py-5">
     <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15.5px] font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
      {item.q}
      <span aria-hidden className="relative size-4 shrink-0 text-copper-600">
       <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current"/>
       <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-current transition-transform group-open:scale-y-0"/>
      </span>
     </summary>
     <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-[var(--text-muted)]">{item.a}</p>
    </details>
   ))}
  </div>
 );
}

/** A short factual claim with a mark beside it. */
export function Point({title,body,tone='dark'}:{title:string;body:string;tone?:'light'|'dark'}){
 return (
  <li className="flex gap-3">
   <span
    aria-hidden
    className={cx('mt-[9px] size-1.5 shrink-0 rounded-full',tone==='light'?'bg-copper-500':'bg-copper-600')}
   />
   <span>
    <span className={cx('block text-[15px] font-semibold',tone==='light'&&'text-ivory-500')}>{title}</span>
    <span className={cx(
     'mt-1 block text-[14px] leading-relaxed',
     tone==='light'?'text-navy-300':'text-[var(--text-muted)]',
    )}>
     {body}
    </span>
   </span>
  </li>
 );
}
