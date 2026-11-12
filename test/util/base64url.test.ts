import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'

import * as base64url from '../../src/util/base64url.js'
import {
  base64urlDecodeVectors,
  encodeVectors,
  tokenWithWhitespacePayload,
} from '../encoding-vectors.js'
import { decodeJwt } from '../../src/util/decode_jwt.js'

// RFC 4648 Section 5 defines the Base64URL alphabet as A-Z, a-z, 0-9, "-" and "_". "+" and "/"
// belong to the standard Base64 alphabet of Section 4 and are not part of it.
test('characters outside the Base64URL alphabet are rejected', () => {
  for (const input of ['a+b/', 'a+bc', 'ab/c', '+', '/', 'ab!c', 'ab.c']) {
    assert.throws(
      () => base64url.decode(input),
      (error) => {
        assert.ok(error instanceof TypeError)
        assert.strictEqual(error.message, 'The input to be decoded is not correctly encoded.')
        return true
      },
    )
  }
})

// "-" and "_" alias to "+" and "/" when translated to the standard alphabet, so accepting the
// latter would decode two distinct inputs to the same octets.
test('the Base64URL alphabet does not alias the standard one', () => {
  assert.deepStrictEqual([...base64url.decode('a-b_')], [107, 230, 255])
  assert.throws(() => base64url.decode('a+b/'), Error)
})

test('the Base64URL alphabet is accepted', () => {
  assert.deepStrictEqual([...base64url.decode('YWJj')], [97, 98, 99])
  assert.deepStrictEqual([...base64url.decode('YWJ')], [97, 98])
  assert.deepStrictEqual([...base64url.decode('YQ')], [97])
  assert.deepStrictEqual([...base64url.decode('YW==')], [97])
  assert.deepStrictEqual([...base64url.decode('')], [])
  assert.deepStrictEqual([...base64url.decode(new TextEncoder().encode('YWJj'))], [97, 98, 99])
})

test('a round trip preserves the input', () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096 }), (bytes) => {
      const encoded = base64url.encode(bytes)
      assert.match(encoded, /^[A-Za-z0-9_-]*$/)
      assert.deepStrictEqual(base64url.decode(encoded), bytes)
    }),
    { numRuns: 1000 },
  )
})

// The shared, runtime-independent conformance vectors. These run identically on Node, Deno, Bun,
// workerd, Electron, LLRT and the browsers via tap/encoding.ts, pinning one result per input so the
// native Uint8Array.fromBase64 path and the atob() fallback cannot drift apart again.
test('canonical cross-runtime decode vectors', () => {
  for (const { note, input, ok, bytes } of base64urlDecodeVectors) {
    if (ok) {
      assert.deepStrictEqual([...base64url.decode(input)], bytes ?? [], note)
    } else {
      assert.throws(
        () => base64url.decode(input),
        (error) => {
          assert.ok(error instanceof TypeError, note)
          assert.strictEqual(
            error.message,
            'The input to be decoded is not correctly encoded.',
            note,
          )
          return true
        },
        note,
      )
    }
  }
})

test('canonical cross-runtime encode vectors', () => {
  for (const { bytes, unpaddedBase64url } of encodeVectors) {
    const input = Uint8Array.from(bytes)
    const encoded = base64url.encode(input)
    assert.strictEqual(encoded, unpaddedBase64url)
    // Unpadded output uses only the base64url alphabet, even for full-range binary input.
    assert.match(encoded, /^[A-Za-z0-9_-]*$/)
    assert.deepStrictEqual([...base64url.decode(encoded)], bytes)
  }
})

// End-to-end: a token whose payload carries an ASCII whitespace must fail at the decoding stage on
// every runtime rather than silently decoding on the atob() fallback.
test('a compact token with whitespace in its payload is rejected end-to-end', () => {
  assert.throws(
    () => decodeJwt(tokenWithWhitespacePayload),
    (error) => {
      assert.strictEqual(error.name, 'JWTInvalid')
      assert.strictEqual(error.message, 'Failed to base64url decode the payload')
      return true
    },
  )
})

// Uint8Array input goes through decoder.decode() first; a whitespace byte must still be rejected.
test('whitespace supplied as UTF-8 bytes is rejected as well', () => {
  assert.throws(() => base64url.decode(new TextEncoder().encode('YWJj ')), TypeError)
})
