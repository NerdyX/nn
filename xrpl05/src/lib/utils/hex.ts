export const toHex = (str: string): string => {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

export const fromHex = (hex: string): string => {
  try {
    const bytes = new Uint8Array(
      hex.match(/../g)?.map((byte) => parseInt(byte, 16)) || [],
    );
    // Remove null bytes at the end for currency codes
    const str = new TextDecoder().decode(bytes);
    return str.replace(/\0/g, '');
  } catch {
    return hex;
  }
};

export const parseCurrencyCode = (currency: string): string => {
  if (currency.length === 40) {
    const decoded = fromHex(currency);
    return decoded || currency;
  }
  return currency;
};
