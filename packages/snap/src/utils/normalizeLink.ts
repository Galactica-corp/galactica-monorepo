export const normalizeLink = (metaLink: string) => {
  if (metaLink.startsWith('ipfs')) {
    return metaLink.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }

  return metaLink;
};
