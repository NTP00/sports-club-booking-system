'use strict';
const fs=require('node:fs');
function batches(text) {
  // Project scripts use GO alone on a line, never inside a SQL string literal.
  return text.replace(/^\uFEFF/,'').split(/^\s*go\s*;?\s*$/gim).filter(s=>s.trim());
}
async function runFile(pool,file) {
  const results=[];
  for(const [i,statement] of batches(fs.readFileSync(file,'utf8')).entries()) {
    try {
      const result=await pool.request().batch(statement);
      for(const recordset of result.recordsets||[])results.push(recordset);
    } catch(error) {error.message=`${file}, batch ${i+1}: ${error.message}`;throw error;}
  }
  return results;
}
module.exports={batches,runFile};
