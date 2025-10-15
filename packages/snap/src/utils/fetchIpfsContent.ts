import type { ProviderMeta } from '@galactica-net/galactica-types';

const ipfsPatterns = [
  /^ipfs:\/\/([^/?#]+)/iu,
  /^https?:\/\/[^/]+\/ipfs\/([^/?#]+)/iu,
  /^\/ipfs\/([^/?#]+)/iu,
];

const extractContentId = (ipfsUrl: string) => {
  if (!ipfsUrl) {
    return null;
  }

  const url = ipfsUrl.trim();

  for (const pattern of ipfsPatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

const gateways = [
  `https://ipfs.io/ipfs`,
  `https://cloudflare-ipfs.com/ipfs`,
  `https://gateway.pinata.cloud/ipfs`,
  `https://dweb.link/ipfs`,
];

/**
 *
 * @param contentId - Ipfs content id
 * @yields - Fetch response
 */
async function* fetchIpfsContentSequence(contentId: string) {
  for (const gateway of gateways) {
    const url = `${gateway}/${contentId}`;

    try {
      const response = await fetch(url);
      const data: ProviderMeta = await response.json();
      yield data;
    } catch (error) {
      console.warn(`Failed to fetch guardian info with url: ${url}. `, error);
    }

    yield undefined;
  }
}

export const fetchIpfsContent = async (link: string) => {
  const contentId = extractContentId(link);

  if (!contentId) {
    throw new Error(`Ipfs content id is null. link: ${link}`);
  }

  for await (const metadata of fetchIpfsContentSequence(contentId)) {
    if (metadata) {
      return metadata;
    }
  }

  throw new Error(`Failed to fetch guardian info. link: ${link}`);
};
