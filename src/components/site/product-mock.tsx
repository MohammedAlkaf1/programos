import {getSiteCopy} from '@/i18n/site';
import type {Locale} from '@/i18n/dictionary';

/**
 * The product picture in the hero.
 *
 * Drawn in markup rather than shipped as a screenshot, for three reasons: it
 * stays sharp at any density, it follows the light and dark palettes the same
 * way the real interface does, and it can never leak a name or a figure from a
 * test workspace. The numbers in it are illustrative and the whole block is
 * hidden from assistive technology, since the text beside it carries the
 * meaning.
 */
export function ProductMock({locale}:{locale:Locale}){
 const t=getSiteCopy(locale).hero.mock;
 return (
  <div aria-hidden className="relative select-none">
   {/* The copper wash behind the frame, echoing the sign in panel. */}
   <div
    className="absolute -inset-6 -z-10 rounded-[2rem] opacity-70 blur-2xl"
    style={{backgroundImage:'radial-gradient(circle at 70% 20%, rgba(229,138,60,0.22), transparent 58%), radial-gradient(circle at 15% 85%, rgba(58,74,98,0.22), transparent 55%)'}}
   />
   <div className="surface overflow-hidden shadow-[var(--shadow-raised)]">
    {/* Window bar */}
    <div className="flex items-center gap-2 border-b border-[var(--line-soft)] bg-[var(--surface-sunken)] px-4 py-2.5">
     <span className="flex gap-1.5">
      <span className="size-2.5 rounded-full bg-[var(--line-strong)]"/>
      <span className="size-2.5 rounded-full bg-[var(--line-strong)]"/>
      <span className="size-2.5 rounded-full bg-[var(--line-strong)]"/>
     </span>
     <span className="mx-auto rounded-md bg-[var(--surface-card)] px-3 py-1 text-[11px] text-[var(--text-faint)]">{t.caption}</span>
    </div>

    <div className="grid sm:grid-cols-[120px_1fr]">
     {/* Sidebar */}
     <div className="hidden flex-col gap-2 border-e border-[var(--line-soft)] bg-navy-900 p-3 sm:flex">
      <span className="mb-2 flex items-center gap-2">
       <span className="size-5 rounded-md bg-copper-600"/>
       <span className="h-2 w-12 rounded-full bg-navy-600"/>
      </span>
      {[true,false,false,false,false,false].map((active,index)=>(
       <span key={index} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active?'bg-navy-800':''}`}>
        <span className={`size-3 rounded ${active?'bg-copper-500':'bg-navy-700'}`}/>
        <span className={`h-1.5 rounded-full ${active?'w-12 bg-navy-300':'w-10 bg-navy-700'}`}/>
       </span>
      ))}
     </div>

     {/* Panel */}
     <div className="p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
       {t.kpis.map(kpi=>(
        <div key={kpi.label} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-3">
         <p className="text-[10.5px] text-[var(--text-faint)]">{kpi.label}</p>
         <p className="mt-1 text-[19px] font-semibold tabular-nums tracking-tight">{kpi.value}</p>
        </div>
       ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
       <div className="rounded-xl border border-[var(--line-soft)] p-3.5">
        <p className="text-[11.5px] font-medium text-[var(--text-muted)]">{t.chart}</p>
        <ul className="mt-3 space-y-2.5">
         {t.bars.map(bar=>(
          <li key={bar.label}>
           <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="truncate text-[var(--text-muted)]">{bar.label}</span>
            <span className="tabular-nums text-[var(--text-faint)]">{bar.value}%</span>
           </div>
           <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{background:'var(--mark-track)'}}>
            <div className="h-full rounded-full" style={{width:`${bar.value}%`,background:'var(--mark-magnitude)'}}/>
           </div>
          </li>
         ))}
        </ul>
       </div>

       {/* The one place a diverging colour appears, always with a sign beside it. */}
       <div className="flex flex-col justify-between rounded-xl border border-[var(--line-soft)] bg-[var(--surface-sunken)] p-3.5">
        <p className="text-[11.5px] leading-snug text-[var(--text-muted)]">{t.change}</p>
        <p className="mt-2 flex items-baseline gap-1.5">
         <span className="text-[30px] font-semibold tabular-nums tracking-tight" style={{color:'var(--mark-up)'}}>{t.changeValue}</span>
         <span className="text-[12px] text-[var(--text-muted)]">{t.changeUnit}</span>
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-[var(--text-faint)]">{t.pairs}</p>
       </div>
      </div>
     </div>
    </div>
   </div>
  </div>
 );
}
