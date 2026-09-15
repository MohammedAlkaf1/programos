'use client';

import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {cx} from '@/lib/cx';
import {useApp} from '@/components/app-provider';

/**
 * Switches between the light and dark palettes.
 *
 * It lives on its own rather than inside the application shell because the
 * public pages need the same control, and a visitor who lands in a palette they
 * cannot change is stuck with it.
 *
 * The cookie is what makes the choice stick: the server reads it and stamps the
 * attribute on the first byte of HTML, so a return visit paints the right
 * palette with no flash and no script.
 */
export function ThemeToggle({className}:{className?:string}){
 const {t}=useApp();
 const [dark,setDark]=useState(false);

 useEffect(()=>{
  // With no explicit choice the attribute is absent and CSS is following the
  // system, so read the painted result rather than the attribute.
  const chosen=document.documentElement.getAttribute('data-theme');
  setDark(chosen?chosen==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches);
 },[]);

 function toggle(){
  const next=!dark;
  setDark(next);
  // Apply now for an instant response, and persist so the server renders the
  // same palette on the next request.
  document.documentElement.setAttribute('data-theme',next?'dark':'light');
  document.cookie=`programos.theme=${next?'dark':'light'}; path=/; max-age=31536000; samesite=lax`;
 }

 return (
  <button
   type="button"
   onClick={toggle}
   title={dark?t.theme.light:t.theme.dark}
   aria-label={dark?t.theme.light:t.theme.dark}
   className={cx(
    'rounded-[10px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]',
    className,
   )}
  >
   {dark?<Sun size={17}/>:<Moon size={17}/>}
  </button>
 );
}
