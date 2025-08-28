import { KnownZkCertStandard } from '@galactica-net/galactica-types';

export const getCertTitle = (standard: string, guardianName?: string) => {
  let certName = 'Certificate';
  if (standard === KnownZkCertStandard.ZkKYC) {
    certName = 'zkKYC';
  }

  if (standard === KnownZkCertStandard.ArbitraryData) {
    certName = 'Certificate';
  }

  if (standard === KnownZkCertStandard.Twitter) {
    certName = 'X.com Data';
  }

  if (standard === KnownZkCertStandard.Rey) {
    certName = 'Rey.xyz Data';
  }

  if (standard === KnownZkCertStandard.DEX) {
    certName = 'DEX Data';
  }

  if (standard === KnownZkCertStandard.CEX) {
    certName = 'CEX Data';
  }

  if (standard === KnownZkCertStandard.Telegram) {
    certName = 'Telegram Data';
  }

  return `${certName}${guardianName ? ` by ${guardianName}` : ''}`;
};
