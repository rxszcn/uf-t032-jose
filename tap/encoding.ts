import type QUnit from 'qunit'
import type * as jose from '../src/index.js'
import {
  base64urlDecodeVectors,
  encodeVectors,
  tokenWithWhitespacePayload,
} from '../test/encoding-vectors.js'

/**
 * Cross-runtime encoding conformance. The exact same vectors run on Node.js, Deno, Bun, workerd,
 * Electron, LLRT and the Chromium/Firefox/WebKit browsers. They assert one outcome per input across
 * all of them, catching divergence between the native Uint8Array.fromBase64() implementation and
 * the atob()/btoa() fallback (notably ASCII whitespace, which atob() silently strips).
 */
export default (QUnit: QUnit, lib: typeof jose) => {
  const { module, test } = QUnit
  module('encoding.ts')

  test('base64url decode is identical across runtimes', (t) => {
    for (const { note, input, ok, bytes } of base64urlDecodeVectors) {
      if (ok) {
        t.deepEqual(Array.from(lib.base64url.decode(input)), bytes ?? [], note)
      } else {
        t.throws(
          () => lib.base64url.decode(input),
          (error: unknown) => error instanceof TypeError,
          note,
        )
      }
    }
  })

  test('base64url encode is identical across runtimes', (t) => {
    for (const { bytes, unpaddedBase64url } of encodeVectors) {
      const encoded = lib.base64url.encode(Uint8Array.from(bytes))
      t.equal(encoded, unpaddedBase64url, 'pinned unpadded base64url output')
      t.notOk(encoded.includes('='), 'output is unpadded')
      t.deepEqual(Array.from(lib.base64url.decode(encoded)), bytes, 'round trip')
    }
  })

  test('encode/decode round trip on random bytes', (t) => {
    const bytes = new Uint8Array(512)
    crypto.getRandomValues(bytes)
    const encoded = lib.base64url.encode(bytes)
    t.deepEqual(Array.from(lib.base64url.decode(encoded)), Array.from(bytes))
  })

  test('a token carrying whitespace in its payload segment is rejected', (t) => {
    t.throws(
      () => lib.decodeJwt(tokenWithWhitespacePayload),
      (error: unknown) => error instanceof lib.errors.JWTInvalid,
    )
  })
}
