// Mechanical copy-only migration. No URLs, keys, routes, SQL identifiers,
// stored campaign documents or unrelated untracked UI experiments are changed.
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import ts from "typescript";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

export function updatedCopy(text) {
  return text.replace(/GROWVELT LEARNING/g,"GROWVELT").replace(/Growvelt Learning/g,"Growvelt")
    .replace(/MY LEARNING/g,"MY COURSES").replace(/My Learning/g,"My Courses").replace(/My learning/g,"My Courses")
    .replace(/COMPANY LEARNING/g,"TEAM TRAINING").replace(/Company Learning/g,"Team Training").replace(/Company learning/g,"Team Training").replace(/company learning/g,"team training")
    .replace(/Teach on Growvelt/g,"Become Instructor").replace(/Teach on growvelt/g,"Become Instructor")
    .replace(/Paystack (?:transaction )?[Rr]eference/g,"Reference")
    .replace(/\bLearning account/g,"Growvelt account").replace(/\bLearning team/g,"Growvelt team")
    .replace(/\bLearning Support/g,"Growvelt Support").replace(/\bLearning assistant/g,"Growvelt assistant")
    .replace(/\bLearning users/g,"Growvelt users").replace(/\bLearning contacts/g,"Growvelt contacts")
    .replace(/\bLearning community/g,"Growvelt community").replace(/\bLearning email/g,"Growvelt email")
    .replace(/\bLearning eligibility/g,"account eligibility").replace(/\bLearning opt-in/g,"marketing opt-in")
    .replace(/\bLearning consent/g,"marketing consent").replace(/Replies in Learning/g,"Replies from Growvelt")
    .replace(/Enseigner sur Growvelt/g,"Devenir formateur").replace(/Enseña en Growvelt|Enseñar en Growvelt/g,"Hazte instructor")
    .replace(/Mon apprentissage/g,"Mes cours").replace(/Mi aprendizaje/g,"Mis cursos")
    .replace(/Apprentissage en entreprise/g,"Formation en équipe").replace(/Aprendizaje empresarial/g,"Formación de equipos")
    .replace(/Growvelt (?:Careers &|Carrières &|Careers y) Learning/g,"Growvelt")
    .replace(/Learning with a specific goal/g,"Build skills for a specific goal").replace(/Learning at your pace/g,"Learn at your pace")
    .replace(/Learning for every person/g,"Training for every person").replace(/Learning that stays/g,"Practical training that stays")
    .replace(/Learning is more useful/g,"Studying is more useful").replace(/Learning can support/g,"Practical skills can support")
    .replace(/Learning strategy/g,"Study strategy").replace(/Learning progress/g,"Course progress").replace(/Learning path/g,"Course path")
    .replace(/Learning milestones/g,"Course milestones").replace(/Learning resources/g,"Course resources")
    .replace(/Learning and certificates/g,"Courses and certificates").replace(/Learning, certificates/g,"Courses, certificates")
    .replace(/Learning, careers|Learning · careers/g,"Skills, careers").replace(/Learning, teaching/g,"Courses, teaching")
    .replace(/Instructor Learning Analytics/g,"Instructor Course Analytics").replace(/Continue Learning/g,"Continue course")
    .replace(/Explore Learning/g,"Explore courses").replace(/Learning with/g,"Study with")
    .replace(/(["'`])Learning\1/g,"$1Courses$1")
    .replace(/\bLearning\b/g,"Growvelt")
    .replace(/Reconcile — no resend/g,"Check delivery status")
    .replace(/^[—–]$/,"Not available").replace(/\s*—\s*/g,", ").replace(/\s*–\s*/g," to ");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const files=execFileSync("git",["ls-files","app"],{encoding:"utf8"}).split(/\r?\n/).filter(file=>/\.(?:tsx?|mjs)$/.test(file)&&!file.endsWith("email-center-legacy.ts"));
let changed=0;
for(const file of files){
  const before=readFileSync(file,"utf8"),source=ts.createSourceFile(file,before,ts.ScriptTarget.Latest,true,file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[];
  const visit=node=>{
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)||ts.isJsxText(node)){
      const start=node.getStart(source),end=node.end,text=before.slice(start,end),after=updatedCopy(text);
      if(text!==after)edits.push({start,end,after});
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
  if(!edits.length)continue;
  let after=before;for(const edit of edits.sort((a,b)=>b.start-a.start))after=after.slice(0,edit.start)+edit.after+after.slice(edit.end);
  writeFileSync(file,after);console.log(`${file}: ${edits.length} copy updates`);changed++;
}
console.log(`${changed} tracked source files updated; technical identifiers and untracked work preserved.`);
}
