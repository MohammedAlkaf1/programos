import 'dotenv/config';
import {db} from '../src/lib/db';
import {scan} from '../src/lib/file-scanner';
try{const pending=await db.attachment.findMany({where:{status:'Pending'},take:20});for(const f of pending){const status=await scan(Buffer.from(f.bytes));await db.attachment.updateMany({where:{id:f.id,status:'Pending'},data:{status}});}console.log('File scan batch completed');}finally{await db.$disconnect();}
