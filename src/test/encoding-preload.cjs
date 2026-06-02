// Preload: patch require() so html-encoding-sniffer/jsdom can load @exodus/bytes (ESM) in CJS mode
const Module = require('module')
const _original = Module.prototype.require
Module.prototype.require = function (id) {
  if (id === '@exodus/bytes/encoding-lite.js' || id === '@exodus/bytes/encoding.js') {
    return {
      TextDecoder: globalThis.TextDecoder,
      TextDecoderStream: globalThis.TextDecoderStream,
      TextEncoder: globalThis.TextEncoder,
      TextEncoderStream: globalThis.TextEncoderStream,
      getBOMEncoding: () => null,
      labelToName: (label) => label,
      legacyHookDecode: () => null,
      normalizeEncoding: (enc) => enc,
    }
  }
  return _original.apply(this, arguments)
}
