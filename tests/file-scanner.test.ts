import {expect,it} from 'vitest';
import {fileType} from '../src/lib/file-scanner';
it('checks both extension and signature',()=>{expect(fileType(Buffer.from('%PDF-1.7'),'test.pdf')).toBe('application/pdf');expect(fileType(Buffer.from('executable'),'test.pdf')).toBeNull();expect(fileType(Buffer.from('%PDF-1.7'),'test.png')).toBeNull();expect(fileType(Buffer.from([255,216,255]),'test.jpg')).toBe('image/jpeg');});
