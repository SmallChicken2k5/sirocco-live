import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await rm('dist/studio-v2.css', { force: true });
await build({ entryPoints: ['web/app.js'], bundle: true, format: 'esm', target: 'chrome110', outfile: 'dist/app.js', minify: true, legalComments: 'linked' });
for (const file of ['index.html', 'style.css', 'studio.css']) await copyFile(`web/${file}`, `dist/${file}`);
await mkdir('dist/assets', { recursive: true });
for(const file of ['sirocco-symbol.png','sirocco-favicon.png','sirocco-original.png'])await copyFile(`web/assets/${file}`,`dist/assets/${file}`);
for(const subset of ['vietnamese','latin-ext','latin'])await copyFile(`node_modules/@fontsource-variable/geist/files/geist-${subset}-wght-normal.woff2`,`dist/assets/geist-${subset}.woff2`);
const names=['broadcast','squares-four','columns','sidebar-simple','arrows-clockwise','sliders-horizontal','arrows-out','question','users','plus','copy','link','check','star','trash','circle-notch','x','chart-line','plugs-connected','arrow-up-right','check-circle','arrow-right','key'];
const symbols=await Promise.all(names.map(async name=>{
  const svg=await readFile(`node_modules/@phosphor-icons/core/assets/regular/${name}.svg`,'utf8');
  return `<symbol id="${name}" viewBox="0 0 256 256">${svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')}</symbol>`;
}));
await writeFile('dist/assets/icons.svg',`<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor">${symbols.join('')}</svg>`);
console.log('Built Sirocco Live → dist/');
