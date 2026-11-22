import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const name=`Dkkf-Launcher-${version}-Setup.exe`;
const hash=createHash('sha256').update(await fs.readFile(`release/${version}/${name}`)).digest('hex');
await fs.writeFile(`release/${version}/SHA256SUMS.txt`,hash+'  '+name+'\n');
console.log('Prepared installer-only release checksums. Source ZIP remains local.');
