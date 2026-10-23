import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import ts from "typescript";

const files=execFileSync("git",["ls-files","app"],{encoding:"utf8"}).split(/\r?\n/).filter(file=>/\.(?:tsx?|mjs)$/.test(file));
const changed=new Set(execFileSync("git",["-c","core.safecrlf=false","diff","--name-only","--relative","HEAD","--","app"],{encoding:"utf8"}).split(/\r?\n/));
const logicChanges=new Set(["app/lib/email/email-center-render.ts","app/lib/email/email-center-resend.ts","app/lib/email/growvelt-email-template.ts","app/dashboard/admin/emails/workspace.tsx"]);
function scan(file,text){
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS),structure=[],technical=[],copy=[];
  const visit=node=>{
    structure.push([node.kind,ts.isIdentifier(node)?node.text:""]);
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)||ts.isJsxText(node)){
      const value=node.text;
      if(/^(?:\/|\.\.?\/|https?:\/\/|@\/)/.test(value))technical.push(value);
      else if(!ts.isJsxText(node)||value.trim())copy.push(value);
    }
    ts.forEachChild(node,visit);
  };visit(source);return{structure,technical,copy};
}
let checked=0;
for(const file of files){
  const after=scan(file,readFileSync(file,"utf8"));
  if(!file.endsWith("email-center-legacy.ts"))for(const value of after.copy)assert.doesNotMatch(value,/\bGrowvelt Learning\b|\bLearning\b|Teach on Growvelt|My Learning|Company learning|Paystack (?:transaction )?[Rr]eference|[—–]/,`${file}: old visible brand/labels or long dash`);
  if(!changed.has(file))continue;
  const before=scan(file,execFileSync("git",["show",`HEAD:learning-app/${file}`],{encoding:"utf8"}));
  if(!logicChanges.has(file)){
    assert.deepEqual(after.structure,before.structure,`${file}: copy migration must not change program structure or identifiers`);
    assert.deepEqual(after.technical,before.technical,`${file}: routes, URLs and imports must remain unchanged`);
  }
  checked++;
}
const i18n=readFileSync("app/lib/i18n.ts","utf8");
assert.match(i18n,/"nav\.learning": "My Courses"/);
assert.match(i18n,/"nav\.company": "Team Training"/);
assert.match(i18n,/"nav\.teach": "Become Instructor"/);
assert.match(readFileSync("app/dashboard/admin/emails/workspace.tsx","utf8"),/Check delivery status/);
console.log(`PASS visible-copy audit: ${checked} changed sources, stable program structure/technical destinations outside the explicit renderer/UI changes, approved menu labels, no old brand or long dashes in tracked UI copy.`);
