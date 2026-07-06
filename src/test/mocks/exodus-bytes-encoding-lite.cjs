// CJS shim for @exodus/bytes/encoding-lite (ESM) so jsdom can load it in Node 20 CJS mode
module.exports = {
  TextDecoder: globalThis.TextDecoder,
  TextDecoderStream: globalThis.TextDecoderStream,
  TextEncoder: globalThis.TextEncoder,
  TextEncoderStream: globalThis.TextEncoderStream,
  getBOMEncoding: () => null,
  labelToName: (label) => label,
  legacyHookDecode: () => null,
  normalizeEncoding: (enc) => enc,
}
