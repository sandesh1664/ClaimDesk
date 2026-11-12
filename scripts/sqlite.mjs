import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';

export async function localDatabase({bounded=false}={}){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  if(bounded) sqlite.exec('PRAGMA page_size=4096; PRAGMA max_page_count=16384');
  for(const file of (await fs.readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort()){
    sqlite.exec(await fs.readFile('drizzle/'+file,'utf8'));
  }
  return {
    prepare(sql){
      return {bind(...args){
        const statement=sqlite.prepare(sql);
        const runSync=()=>({meta:statement.run(...args)});
        return {first:async()=>statement.get(...args),run:async()=>runSync(),runSync};
      }};
    },
    async batch(statements){
      sqlite.exec('BEGIN');
      try{
        const results=statements.map(statement=>statement.runSync());
        sqlite.exec('COMMIT');
        return results;
      }catch(error){
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
