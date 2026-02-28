export function resolveIpfsUrl(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://cloudflare-ipfs.com/ipfs/${uri.replace("ipfs://", "")}`;
  }
  // Try to decode hex if it looks like a hex URI
  if (/^[0-9A-F]+$/i.test(uri)) {
    try {
      const bytes = new Uint8Array(
        uri.match(/../g)?.map((byte) => parseInt(byte, 16)) || [],
      );
      const decoded = new TextDecoder().decode(bytes);
      if (decoded.startsWith("ipfs://")) {
        return `https://cloudflare-ipfs.com/ipfs/${decoded.replace("ipfs://", "")}`;
      }
      if (decoded.startsWith("http")) {
        return decoded;
      }
    } catch {
      // Ignored
    }
  }
  return uri;
}
