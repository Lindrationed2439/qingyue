const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'release', 'lite-stage');
fs.mkdirSync(stage, { recursive: true });
const generatedDist = path.resolve(stage, 'dist');
if (path.dirname(generatedDist) !== stage) throw new Error('Invalid staging directory');
fs.rmSync(generatedDist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist-lite'), path.join(stage, 'dist'), { recursive: true });
fs.mkdirSync(path.join(stage, 'electron'), { recursive: true });
for (const name of fs.readdirSync(path.join(root, 'electron'))) {
  if (name.endsWith('.cjs') && name !== 'office.cjs') fs.copyFileSync(path.join(root, 'electron', name), path.join(stage, 'electron', name));
}
fs.mkdirSync(path.join(stage, 'build'), { recursive: true });
for (const name of ['icon.png', 'icon.ico', 'QingYue-Portable.txt']) fs.copyFileSync(path.join(root, 'build', name), path.join(stage, 'build', name));
// Copy only the text encoding dependency and its single transitive dependency.
const iconv = path.dirname(require.resolve('iconv-lite/package.json'));
const safer = path.dirname(require.resolve('safer-buffer/package.json', { paths: [iconv] }));
for (const [name, source] of [['iconv-lite', iconv], ['safer-buffer', safer]]) {
  fs.cpSync(fs.realpathSync(source), path.join(stage, 'node_modules', name), { recursive: true });
}
const metadata = {
  name: 'qingyue-lite', version: '0.1.1', qingyueEdition: 'lite', private: true,
  // electron-builder's offline collector traverses the two copied dependencies.
  packageManager: 'traversal',
  description: '轻阅 Lite', author: 'Local Software', license: 'MIT', main: 'electron/main.cjs',
  dependencies: { 'iconv-lite': require(path.join(iconv, 'package.json')).version },
  build: {
    appId: 'com.local.qingyue.lite', productName: '轻阅 Lite', executableName: 'QingYueLite',
    electronDist: path.join(root, 'node_modules', 'electron', 'dist'),
    electronVersion: require('electron/package.json').version,
    asar: true, npmRebuild: false,
    directories: { output: path.join(root, 'release', 'lite') },
    files: ['dist/**/*', 'electron/**/*', 'build/icon.png', 'package.json'],
    extraFiles: [{ from: 'build/QingYue-Portable.txt', to: 'QingYue-Portable.txt' }],
    win: { icon: 'build/icon.ico', target: ['portable'] },
    portable: { artifactName: 'QingYue-Lite-0.1.1-Portable-${arch}.${ext}', requestExecutionLevel: 'user' },
  },
};
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(metadata, null, 2));
console.log(stage);
