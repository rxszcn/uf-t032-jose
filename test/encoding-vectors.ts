/**
 * Canonical, runtime-independent conformance vectors for base64url/base64 token encoding and
 * decoding.
 *
 * The same vectors are consumed by:
 *
 * - The Node.js unit tests (`test/util/base64url.test.ts`)
 * - The cross-runtime QUnit suite (`tap/encoding.ts`, run on Node, Deno, Bun, workerd, Electron, LLRT
 *   and the Chromium/Firefox/WebKit browsers)
 *
 * They pin down the acceptance rules that every supported runtime MUST agree on, regardless of
 * whether `Uint8Array.fromBase64()` is available or the `atob()`/`btoa()` fallback is used. Keeping
 * a single shared source guarantees that "the same input yields the same result everywhere" is
 * actually tested rather than assumed.
 *
 * @module
 */

/** A decoding vector and the required cross-runtime outcome. */
export interface DecodeVector {
  /** Human-readable description of what the vector probes. */
  note: string
  /** Input as given to the decoder. */
  input: string
  /** `true` when decoding must succeed, `false` when it must throw. */
  ok: boolean
  /** Expected decoded octets when {@link DecodeVector.ok} is `true`. */
  bytes?: number[]
}

// The five ASCII whitespace code points the HTML spec makes `atob()` silently ignore. Native
// `Uint8Array.fromBase64()` never skips them, so a token containing any of them must be rejected on
// every runtime. These were the exact inputs that passed on fallback runtimes and failed elsewhere.
const whitespace = [
  ['space', ' '],
  ['tab', '\t'],
  ['line feed', '\n'],
  ['carriage return', '\r'],
  ['form feed', '\f'],
] as const

/** Base64url decode vectors. Each entry states the single result every runtime must produce. */
export const base64urlDecodeVectors: DecodeVector[] = [
  { note: 'empty string decodes to empty bytes', input: '', ok: true, bytes: [] },
  { note: 'canonical 4-char chunk', input: 'YWJj', ok: true, bytes: [97, 98, 99] },
  { note: 'unpadded 3-char tail (2 bytes)', input: 'YWJ', ok: true, bytes: [97, 98] },
  { note: 'unpadded 2-char tail (1 byte)', input: 'YQ', ok: true, bytes: [97] },
  { note: 'correctly padded input is accepted (loose tail)', input: 'YQ==', ok: true, bytes: [97] },
  { note: 'base64url alphabet - and _', input: 'a-b_', ok: true, bytes: [107, 230, 255] },

  // Standard-alphabet characters are not part of base64url and must never be aliased.
  { note: 'standard alphabet + and / are rejected', input: 'a+b/', ok: false },
  { note: 'lone + rejected', input: '+', ok: false },
  { note: 'lone / rejected', input: '/', ok: false },
  { note: 'other non-alphabet character !', input: 'ab!c', ok: false },
  { note: 'other non-alphabet character .', input: 'ab.c', ok: false },
  { note: 'other non-alphabet character @', input: 'YWJj@', ok: false },

  // Malformed length / padding.
  { note: 'single character tail is malformed', input: 'Y', ok: false },
  { note: '5-character input is malformed', input: 'YWJjZ', ok: false },
  { note: 'wrong padding count (one =)', input: 'YQ=', ok: false },
  { note: 'superfluous padding (three =)', input: 'YQ===', ok: false },
  { note: 'padding-only input', input: '===', ok: false },
  {
    note: '3-char tail with one = is a valid loose tail',
    input: 'YWJ=',
    ok: true,
    bytes: [97, 98],
  },

  // Whitespace: rejected uniformly even though atob() would strip it.
  ...whitespace.map(([name, char]): DecodeVector => ({
    note: `trailing ${name} is rejected, not stripped`,
    input: `YWJj${char}`,
    ok: false,
  })),
  ...whitespace.map(([name, char]): DecodeVector => ({
    note: `leading ${name} is rejected, not stripped`,
    input: `${char}YWJj`,
    ok: false,
  })),
  { note: 'inner space is rejected', input: 'YW Jj', ok: false },
  { note: 'a mix of ASCII whitespace is rejected', input: '  Y\tW\nJ\rj\f ', ok: false },
  { note: 'inner line feed is rejected', input: 'AB\nCD', ok: false },
]

/** Raw byte sequences whose base64url encoding is pinned (the producer side of the contract). */
export const encodeVectors: Array<{ bytes: number[]; unpaddedBase64url: string }> = [
  { bytes: [], unpaddedBase64url: '' },
  { bytes: [97], unpaddedBase64url: 'YQ' },
  { bytes: [97, 98], unpaddedBase64url: 'YWI' },
  { bytes: [97, 98, 99], unpaddedBase64url: 'YWJj' },
  { bytes: [107, 230, 255], unpaddedBase64url: 'a-b_' },
  // Every byte value round-trips; guards against alphabet/whitespace assumptions on binary data.
  {
    bytes: Array.from({ length: 256 }, (_, i) => i),
    unpaddedBase64url:
      'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn-AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq-wsbKztLW2t7i5uru8vb6_wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t_g4eLj5OXm5-jp6uvs7e7v8PHy8_T19vf4-fr7_P3-_w',
  },
]

/**
 * A compact token whose base64url payload segment carries a literal ASCII space inside the encoded
 * character stream (not merely inside the decoded JSON text). It must fail at the base64url
 * decoding stage on every runtime instead of being silently accepted where `atob()` strips
 * whitespace.
 */
export const tokenWithWhitespacePayload = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ .c2ln'
