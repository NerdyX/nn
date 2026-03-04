export const toHex = (str: string): string => {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

export const fromHex = (hex: string): string => {
  const bytes = new Uint8Array(
    hex.match(/../g)?.map((byte) => parseInt(byte, 16)) || [],
  );
  return new TextDecoder().decode(bytes);
};
