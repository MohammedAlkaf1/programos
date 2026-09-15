import {auth} from '@/auth';
import {redirect} from 'next/navigation';
import {SecuritySetup} from '@/components/views/security-setup';
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const session=await auth();if(!session?.user?.id)redirect(`/${locale}/login`);return <SecuritySetup/>;}
