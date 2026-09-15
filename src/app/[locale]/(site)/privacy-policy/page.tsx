import type {Metadata} from 'next';
import {LegalPage} from '@/components/site/legal-page';
import {getSiteCopy} from '@/i18n/site';
import {isLocale,type Locale} from '@/i18n/dictionary';

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale:raw}=await params;
 const t=getSiteCopy(isLocale(raw)?raw:'ar');
 return {title:t.legal.privacy.title,description:t.legal.privacy.intro};
}

export default async function PrivacyPolicyPage({params}:{params:Promise<{locale:string}>}){
 const {locale:raw}=await params;
 const locale:Locale=isLocale(raw)?raw:'ar';
 return <LegalPage locale={locale} document={getSiteCopy(locale).legal.privacy}/>;
}
