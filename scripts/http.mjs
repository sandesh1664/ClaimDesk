import http from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {localDatabase} from './sqlite.mjs';
import worker from '../dist/server/index.js';

const DB=await localDatabase({bounded:Boolean(process.env.RENDER_EXTERNAL_URL)});
const publicOrigin=process.env.RENDER_EXTERNAL_URL
  ? new URL(process.env.RENDER_EXTERNAL_URL).origin
  : null;
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag===-1?process.env.PORT||3000:process.argv[portFlag+1]);

const server=http.createServer({requestTimeout:20000,headersTimeout:10000},async(req,res)=>{
  try{
    const origin=publicOrigin??new URL('http://'+req.headers.host).origin;
    const target=new URL(req.url,origin);
    if(target.origin!==origin){
      res.writeHead(400).end();
      return;
    }
    const init={method:req.method,headers:req.headers};
    if(req.method==='POST'){
      init.body=Readable.toWeb(req);
      init.duplex='half';
    }
    const result=await worker.fetch(new Request(target,init),{DB});
    const headers=Object.fromEntries(result.headers);
    const cookies=result.headers.getSetCookie();
    if(cookies.length) headers['set-cookie']=cookies;
    res.writeHead(result.status,headers);
    if(result.body) await pipeline(Readable.fromWeb(result.body),res);
    else res.end();
  }catch(error){
    if(res.destroyed) return;
    console.error('ClaimDesk HTTP request failed:',error.message);
    if(!res.headersSent) res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end('{"error":"The demo could not complete your request."}');
  }
});
server.listen(port,'0.0.0.0',()=>console.log('ClaimDesk listening on port '+port));
process.once('SIGTERM',()=>server.close());
