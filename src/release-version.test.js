import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import packageMetadata from '../package.json' with {type:'json'};

test('renders the package release version in the global footer',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
  assert.match(html,/data-release-version/);
  assert.match(html,new RegExp(`v${packageMetadata.version.replaceAll('.','\\.')}`));
  assert.match(app,/packageMetadata\.version/);
});
