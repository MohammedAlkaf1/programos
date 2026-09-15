import {pageState} from '@/lib/guard';
import {BeneficiariesView} from '@/components/views/beneficiaries-view';
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {state,permitted}=await pageState(params,['Admin','Manager','Coordinator','Beneficiary']);
 return permitted?<BeneficiariesView state={state}/>:null;
}
