import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
export async function localDatabase(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of (await fs.readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort()) sqlite.exec(await fs.readFile('drizzle/'+file,'utf8'));
  return {
    prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {first:async()=>stmt.get(...args),run:async()=>({meta:stmt.run(...args)})};}};},
    async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
  };
}
