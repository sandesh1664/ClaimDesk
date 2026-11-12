import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const files={
  '/':['index.html','text/html; charset=utf-8'],
  '/app.js':['app.js','text/javascript; charset=utf-8'],
  '/styles.css':['styles.css','text/css; charset=utf-8']
};
const assets=Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url,[file,type]])=>[url,{type,body:await fs.readFile('ui/'+file,'utf8')}])));
try{assets['/hero.webp']={type:'image/webp',base64:true,body:(await fs.readFile('ui/hero.webp')).toString('base64')};}
catch(error){if(error.code!=='ENOENT') throw error;}
const catalog=stripTypeScriptTypes(await fs.readFile('server/catalog.ts','utf8'));
assets['/catalog.js']={type:'text/javascript; charset=utf-8',body:catalog};
const worker=(await fs.readFile('server/worker.js','utf8')).replace(/^import .*\n/gm,'');
const domain=(await fs.readFile('server/domain.js','utf8')).replace(/^import .*\n/gm,'').replace(/^export /gm,'');
const auth=stripTypeScriptTypes(await fs.readFile('server/auth.ts','utf8'));
const policy=stripTypeScriptTypes(await fs.readFile('server/policy.ts','utf8'));
await fs.mkdir('dist/server',{recursive:true});
await fs.writeFile('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+auth+'\n'+policy+'\n'+catalog.replace(/^export /gm,'')+'\n'+domain+'\n'+worker);
