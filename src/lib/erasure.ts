import {DomainError} from './domain';
/**
 * Removes every identifiable record of one beneficiary inside one tenant and
 * leaves a tombstone so a restored backup can re-apply the deletion. Aggregate
 * counts survive because report snapshots are frozen copies that never
 * reference a person.
 */
export async function eraseBeneficiary(tx:any,tenantId:string,beneficiaryId:string,actorId:string,reason:string){
 await tx.$queryRaw`SELECT id FROM "Beneficiary" WHERE id=${beneficiaryId} FOR UPDATE`;
 const b=await tx.beneficiary.findFirst({where:{id:beneficiaryId,tenantId}});if(!b)throw new DomainError('notFound',404);
 if(b.legalHold)throw new DomainError('legalHold',409);
 if(await tx.enrollment.count({where:{tenantId,application:{beneficiaryId},status:{in:['Enrolled','InProgress','Suspended']}}}))throw new DomainError('pending',409);
 const apps=await tx.application.findMany({where:{tenantId,beneficiaryId},select:{id:true}});const appIds=apps.map((x:{id:string})=>x.id);
 const enrollments=await tx.enrollment.findMany({where:{tenantId,applicationId:{in:appIds}},select:{id:true}});const ids=enrollments.map((x:{id:string})=>x.id);
 await tx.measurement.deleteMany({where:{tenantId,enrollmentId:{in:ids}}});
 await tx.attendance.deleteMany({where:{tenantId,enrollmentId:{in:ids}}});
 await tx.enrollment.deleteMany({where:{tenantId,id:{in:ids}}});
 await tx.evaluation.deleteMany({where:{tenantId,applicationId:{in:appIds}}});
 await tx.applicationRevision.deleteMany({where:{tenantId,applicationId:{in:appIds}}});
 await tx.operationalNote.deleteMany({where:{tenantId,beneficiaryId}});
 await tx.application.deleteMany({where:{tenantId,id:{in:appIds}}});
 await tx.attachment.deleteMany({where:{tenantId,userId:b.userId}});
 await tx.consentRecord.updateMany({where:{tenantId,beneficiaryId,withdrawnAt:null},data:{withdrawnAt:new Date()}});
 await tx.notification.deleteMany({where:{tenantId,userId:b.userId}});
 await tx.beneficiary.update({where:{id:b.id},data:{name:'محذوف',email:'',phone:null,status:'Anonymized'}});
 await tx.deletionTombstone.upsert({where:{tenantId_beneficiaryId:{tenantId,beneficiaryId:b.id}},create:{tenantId,beneficiaryId:b.id,approvedBy:actorId,reason},update:{}});
 await tx.deletionCandidate.updateMany({where:{tenantId,beneficiaryId:b.id,status:'Pending'},data:{status:'Approved',decidedBy:actorId,decidedAt:new Date()}});
 return {applications:appIds.length,enrollments:ids.length};
}
