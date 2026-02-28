import type { RequestHandler } from '@builder.io/qwik-city';
import { loadNfts, getD1 } from '~/lib/marketplace-data';

export const onGet: RequestHandler = async ({ url, json, platform }) => {
  const network = url.searchParams.get('network') || 'xrpl';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  
  const db = getD1(platform);
  try {
    const data = await loadNfts(network, limit, db);
    json(200, data);
  } catch (err: any) {
    json(500, { error: err.message || 'Failed to load global NFTs' });
  }
};
