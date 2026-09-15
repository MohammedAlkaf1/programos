/**
 * Numeric claim checking for the results summary (FR-056).
 *
 * The rule the specification sets is that every numeric claim must trace to a
 * verifiable source. Asking a model to behave is not a control, so the control
 * is mechanical: we compute the figures ourselves, hand them over as a numbered
 * fact table, and then check the text that comes back. Any number in the
 * summary that is not one of the facts, a figure quoted from the question, or a
 * plain ordinal fails the check and the summary is refused.
 *
 * This is deliberately strict. A refused summary costs a retry; a plausible
 * invented number in an impact report costs the credibility of the whole
 * measurement.
 */

export type Fact={id:string;label:string;value:number|null;unit?:string};

/** Arabic-Indic digits appear in pasted text; normalise before reading numbers. */
const ARABIC_DIGITS=/[٠-٩۰-۹]/g;
export function normaliseDigits(text:string){
 return text.replace(ARABIC_DIGITS,d=>{
  const code=d.charCodeAt(0);
  return String(code>=0x06F0?code-0x06F0:code-0x0660);
 });
}

/** Every number appearing in the text, as written. */
export function numbersIn(text:string){
 const out:number[]=[];
 for(const match of normaliseDigits(text).matchAll(/-?\d+(?:[.,]\d+)?/g)){
  const value=Number(match[0].replace(',',''));
  if(Number.isFinite(value))out.push(value);
 }
 return out;
}

const near=(a:number,b:number)=>Math.abs(a-b)<=Math.max(0.05,Math.abs(b)*0.005);

/**
 * Returns the numbers the summary states that no fact supports. Whole numbers
 * up to 12 are allowed through as ordinary prose ("the three programs"), and a
 * rounded form of a fact counts as that fact.
 */
export function unsupportedNumbers(summary:string,facts:Fact[]){
 const allowed=facts.flatMap(f=>f.value===null?[]:[f.value,Math.round(f.value),Number(f.value.toFixed(1))]);
 return numbersIn(summary).filter(n=>{
  if(Number.isInteger(n)&&Math.abs(n)<=12)return false;
  if(n>=1900&&n<=2200&&Number.isInteger(n))return false; // a year
  return !allowed.some(value=>near(n,value));
 });
}

/** The fact table the model is given. Nulls are stated, never silently dropped. */
export function renderFacts(facts:Fact[]){
 return facts.map(f=>`${f.id}: ${f.label} = ${f.value===null?'not available':`${f.value}${f.unit?` ${f.unit}`:''}`}`).join('\n');
}

/** Which fact ids a summary cites, so a claim can be traced back. */
export function citationsIn(summary:string,facts:Fact[]){
 return facts.filter(f=>summary.includes(f.id)).map(f=>f.id);
}
