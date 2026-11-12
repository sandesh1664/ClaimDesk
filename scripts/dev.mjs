import http from 'node:http';
import {localDatabase} from './sqlite.mjs';
import './build.mjs';
const {default:worker}=await import('../dist/server/index.js');
const DB=await localDatabase();
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag===-1?process.env.PORT||3000:process.argv[portFlag+1]);
http.createServer(async(req,res)=>{
  const origin='http://'+req.headers.host;
  const init={method:req.method,headers:req.headers};
  if(req.method==='POST'){const body=[];for await(const chunk of req)body.push(chunk);init.body=Buffer.concat(body);}
  const result=await worker.fetch(new Request(origin+req.url,init),{DB});
  const headers=Object.fromEntries(result.headers);
  const cookies=result.headers.getSetCookie();
  if(cookies.length) headers['set-cookie']=cookies;
  res.writeHead(result.status,headers);
  res.end(Buffer.from(await result.arrayBuffer()));
}).listen(port,'0.0.0.0',()=>console.log('ClaimDesk preview on port '+port));
