/** SHA-256 hex digest (64 lowercase hex chars) — navigateur ou Node (Web Crypto). */
export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const buf =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes
      : new Uint8Array(bytes);
  const hash = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
