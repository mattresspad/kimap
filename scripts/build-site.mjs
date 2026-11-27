import { build } from 'esbuild';
import { copyNotices } from '../checks/notices.mjs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const origin = new URL(process.env.KIM_ASSET_ORIGIN || 'https://kim-assets.kenshi.wiki');
if (origin.href !== origin.origin + '/' || (origin.protocol !== 'https:' && origin.hostname !== '127.0.0.1')) {
  throw new Error('KIM_ASSET_ORIGIN must be an HTTPS origin or loopback HTTP origin.');
}
const site = process.env.KIM_SITE_DIR || path.join(root, 'dist/site');
const output = file => path.join(site, file);
const source = file => path.join(root, file);
await mkdir(site, { recursive:true });
await build({
  absWorkingDir: root, entryPoints:['script.js'], bundle:true, minify:true, format:'esm',
  outfile:output('dist/bundle.js'), loader:{'.woff2':'file'}, assetNames:'assets/[name]-[hash]',
  define:{__KIM_ASSET_ORIGIN__:JSON.stringify(origin.origin)},
  plugins:[{ name:'shared-artwork', setup(builder) {
    builder.onResolve({filter:/^kim-asset:\//}, args => ({
      path:origin.origin + args.path.slice('kim-asset:'.length), external:true,
    }));
  }}],
});
await writeFile(output('index.html'), (await readFile(source('index.html'),'utf8')).replaceAll('%KIM_ASSET_ORIGIN%',origin.origin));
for (const file of ['favicon.ico','libs/tga-codec-main/tga.js']) await cp(source(file),output(file));
for (const file of ['leaflet.js','leaflet.css','images']) {
  await cp(source('node_modules/leaflet/dist/' + file),output('vendor/leaflet/' + file),{recursive:true});
}
await cp(source('node_modules/d3/dist/d3.min.js'),output('vendor/d3/d3.min.js'));
for (const name of ['d3','leaflet']) await cp(source('node_modules/' + name + '/LICENSE'),output('vendor/' + name + '/LICENSE'));
await copyNotices(root,site);
console.log('KiMap static application:',site,' | Shared assets:',origin.origin);
