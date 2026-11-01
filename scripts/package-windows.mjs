import { build } from 'esbuild';
import { cp, copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
if(process.platform!=='win32')throw new Error('Windows packaging requires the Windows .NET Framework compiler.');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const name=`Sirocco-Live-${pkg.version}-Windows-x64`;
const output=path.join(root,'release',name);
await mkdir(path.join(output,'app','dist'),{recursive:true});
await mkdir(path.join(output,'runtime'),{recursive:true});
await mkdir(path.join(output,'licenses'),{recursive:true});
await cp('dist',path.join(output,'app','dist'),{recursive:true,filter:source=>!source.endsWith('studio-v2.css')});
await cp('companion',path.join(output,'companion'),{recursive:true});
await build({entryPoints:['server.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:path.join(output,'app','server.mjs'),legalComments:'linked',banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"},external:['bufferutil','utf-8-validate']});
await copyFile(process.execPath,path.join(output,'runtime','node.exe'));
await copyFile('web/assets/sirocco.ico',path.join(output,'sirocco.ico'));
const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
execFileSync(compiler,['/nologo','/target:winexe','/platform:anycpu','/optimize+',`/win32icon:${path.join(root,'web/assets/sirocco.ico')}`,`/out:${path.join(output,'Sirocco Live.exe')}`,'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll',path.join(root,'desktop/Launcher.cs')],{stdio:'pipe'});
const licenses=new Set([...Object.keys(pkg.dependencies),'esbuild']);
// Bundled transitive packages also retain their copyright notices.
for(const entry of await readdir('node_modules',{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
  if(entry.name.startsWith('@'))for(const child of await readdir(path.join('node_modules',entry.name),{withFileTypes:true})){if(child.isDirectory())licenses.add(`${entry.name}/${child.name}`);}
  else licenses.add(entry.name);
}
for(const name of licenses){
  const directory=path.join(root,'node_modules',name);
  const files=(await readdir(directory)).filter(f=>/^licen[cs]e|^copying|^notice/i.test(f));
  for(const file of files)await copyFile(path.join(directory,file),path.join(output,'licenses',name.replaceAll('/','-').replace('@','')+'-'+file+'.txt'));
}
const runtimeLicense=await fetch(`https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`);
if(!runtimeLicense.ok)throw new Error('Cannot retrieve the official Node.js runtime license.');
await writeFile(path.join(output,'licenses','Node.js-LICENSE.txt'),await runtimeLicense.text());
await copyFile('desktop/QUICK-START.txt',path.join(output,'ĐỌC TRƯỚC.txt'));
await copyFile('README.md',path.join(output,'README.md'));
await copyFile('desktop/BRAND-NOTES.md',path.join(output,'BRAND-NOTES.md'));
await writeFile(path.join(output,'Sirocco Live.exe.config'),'<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>');
await writeFile(path.join(output,'build-info.json'),JSON.stringify({name:'Sirocco Live',version:pkg.version,platform:'Windows x64',node:process.versions.node,builtAt:new Date().toISOString()},null,2));
// A clean package must never contain the organiser's saved links or local assistant rules.
const forbidden=[];
async function check(dir){for(const e of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory()){if(['data','logs','.git','.codex'].includes(e.name))forbidden.push(full);await check(full);}else if(/^AGENTS\.md$|skill.*inventory|config\.json$|\.env/i.test(e.name))forbidden.push(full);}}
await check(output);if(forbidden.length)throw new Error('Private/local files found in package: '+forbidden.join(', '));
const zip=path.join(root,'release',name+'.zip');
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Compress-Archive -LiteralPath '${output.replaceAll("'","''")}' -DestinationPath '${zip.replaceAll("'","''")}' -CompressionLevel Optimal -Force`],{stdio:'pipe'});
console.log('Windows portable build: '+output);
console.log('Distribution ZIP: '+zip);
