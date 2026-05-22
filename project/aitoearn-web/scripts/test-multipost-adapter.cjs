const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

function loadTsModule(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText

  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(output, filename)
  return mod.exports
}

const {
  buildMultiPostSyncData,
  buildMultiPostXhsAccountData,
} = loadTsModule('src/store/plugin/multipost.adapter.ts')

const imageSyncData = buildMultiPostSyncData({
  platform: 'xhs',
  type: 'image',
  title: '测试标题',
  desc: '正文内容',
  images: ['https://cdn.example.com/assets/photo-one.png?token=abc'],
  topics: ['AIGC', '营销'],
})

assert.deepEqual(imageSyncData.platforms, [
  {
    name: 'DYNAMIC_REDNOTE',
    injectUrl: 'https://creator.xiaohongshu.com/publish/publish?target=image',
    extraConfig: {},
  },
])
assert.equal(imageSyncData.isAutoPublish, true)
assert.deepEqual(imageSyncData.data, {
  title: '测试标题',
  content: '正文内容',
  images: [
    {
      name: 'photo-one.png',
      url: 'https://cdn.example.com/assets/photo-one.png?token=abc',
      type: 'image/png',
    },
  ],
  videos: [],
  tags: ['AIGC', '营销'],
})

const videoSyncData = buildMultiPostSyncData({
  platform: 'xhs',
  type: 'video',
  title: '视频标题',
  desc: '视频正文',
  video: 'https://cdn.example.com/video.mp4',
  cover: 'https://cdn.example.com/cover.jpg',
  topics: ['Seedance'],
  scheduledTime: 1800000000000,
})

assert.deepEqual(videoSyncData.platforms, [
  {
    name: 'VIDEO_REDNOTE',
    injectUrl: 'https://creator.xiaohongshu.com/publish/publish?target=video',
    extraConfig: {},
  },
])
assert.deepEqual(videoSyncData.data, {
  title: '视频标题',
  content: '视频正文',
  video: {
    name: 'video.mp4',
    url: 'https://cdn.example.com/video.mp4',
    type: 'video/mp4',
  },
  cover: {
    name: 'cover.jpg',
    url: 'https://cdn.example.com/cover.jpg',
    type: 'image/jpeg',
  },
  tags: ['Seedance'],
  scheduledPublishTime: 1800000000000,
})

assert.throws(
  () => buildMultiPostSyncData({ platform: 'wxSph', type: 'image', images: ['https://cdn.example.com/a.png'] }),
  /only supports Xhs/,
)

assert.deepEqual(buildMultiPostXhsAccountData('space-1'), {
  type: 'xhs',
  uid: 'multipost-rednote',
  account: 'multipost-rednote',
  loginCookie: 'multipost-extension',
  avatar: '',
  nickname: 'Rednote (MultiPost)',
  fansCount: 0,
  status: 1,
  clientType: 'web',
  groupId: 'space-1',
})

console.log('multipost adapter tests passed')
