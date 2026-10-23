/* eslint-disable @typescript-eslint/no-require-imports */
module.exports=function(source){
  if(this.resourcePath.endsWith('.css'))return 'export default new Proxy({}, {get:(_target,key)=>String(key)});';
  return require('typescript').transpileModule(source,{compilerOptions:{jsx:require('typescript').JsxEmit.ReactJSX,module:require('typescript').ModuleKind.ESNext,target:require('typescript').ScriptTarget.ES2022}}).outputText;
};
