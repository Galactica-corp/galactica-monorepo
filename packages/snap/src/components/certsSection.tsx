import type {
  KYCCertificateContent,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { KnownZkCertStandard } from '@galactica-net/galactica-types';
import {
  Box,
  Button,
  Heading,
  Link,
  Section,
  Skeleton,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { getCertTitle } from '../utils/getCertTitle';

const getValue = (cert: ZkCertRegistered<Record<string, unknown>>) => {
  if (cert.zkCertStandard === KnownZkCertStandard.ZkKYC) {
    const certificate =
      cert as unknown as ZkCertRegistered<KYCCertificateContent>;
    return `${`${certificate.content.forename} ${certificate.content.surname}`.slice(
      0,
      10,
    )}`;
  }
  if (cert.zkCertStandard === KnownZkCertStandard.Twitter) {
    return 'Twitter cert';
  }

  return 'Other Cert';
};

export const CertsSection: SnapComponent<{
  isLoading?: boolean;
  certs: ZkCertRegistered<Record<string, unknown>>[];
  holders: { holderCommitment: string; encryptionPubKey: string }[];
}> = ({ certs, holders, isLoading }) => {
  if (!certs.length) {
    const holder = holders[0];
    const url = `https://kyc-reticulum.galactica.com/?holderCommitment=${holder.holderCommitment}&encryptionPubKey=${holder.encryptionPubKey}`;
    return (
      <Box>
        <Box alignment="center" center>
          <SnapText>You have no ZK certificates yet</SnapText>
          <Link href={url}>Start KYC</Link>
        </Box>
      </Box>
    );
  }
  return (
    <Box>
      <Box>
        <Heading>Your Certificates</Heading>
        {certs.map((cert) => {
          return (
            <Section key={cert.did}>
              <Box
                alignment="space-between"
                crossAlignment="start"
                direction="horizontal"
              >
                <Heading>
                  {getCertTitle(
                    cert.zkCertStandard as KnownZkCertStandard,
                    cert.providerData.meta?.name,
                  )}
                </Heading>
                <Button
                  variant="primary"
                  name={`view-cert-id-${cert.leafHash}`}
                >
                  View
                </Button>
              </Box>
              <SnapText>{getValue(cert)}</SnapText>
              <SnapText>{`Expiration date: ${new Date(
                cert.expirationDate * 1000,
              ).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })}`}</SnapText>
            </Section>
          );
        })}
        {isLoading ? (
          <Skeleton height={140} width="100%" borderRadius="medium" />
        ) : null}
      </Box>
    </Box>
  );
};
