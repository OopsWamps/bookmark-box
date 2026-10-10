// Playwright CLI's isolated run-code scope cannot import Node modules.
// Resolve the local standalone URL here, keeping machine paths out of sources.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(__dirname,'advanced-motion-qa.js'),'utf8');
const token='__STANDALONE_FILE_URL__';
if(source.split(token).length!==2)throw Error('Expected one standalone URL marker');
fs.mkdirSync(path.join(root,'output'),{recursive:true});
fs.writeFileSync(path.join(root,'output','advanced-motion-qa.js'),source.replace(token,JSON.stringify(pathToFileURL(path.join(root,'书签收纳盒-凸轮倾斜高级版.html')).href)));
console.log('Prepared output/advanced-motion-qa.js');
