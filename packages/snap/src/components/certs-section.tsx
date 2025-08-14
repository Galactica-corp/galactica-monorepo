import type { ZkCertRegistered } from '@galactica-net/galactica-types';
import { ZkCertStandard } from '@galactica-net/galactica-types';
import {
  Box,
  Button,
  Card,
  Heading,
  Link,
  Section,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

const getTitle = (standard: ZkCertStandard) => {
  if (standard === ZkCertStandard.ZkKYC) {
    return 'KYC Certs';
  }

  if (standard === ZkCertStandard.Twitter) {
    return 'Social Certs';
  }

  return 'Other Certs';
};

const getValue = (cert: ZkCertRegistered) => {
  if (cert.zkCertStandard === ZkCertStandard.ZkKYC) {
    return `${cert.content.forename} ${cert.content.surname}`.slice(0, 10);
  }
  if (cert.zkCertStandard === ZkCertStandard.Twitter) {
    return 'Twitter cert';
  }

  return 'Other Cert';
};

export const CertsSection: SnapComponent<{
  certs: ZkCertRegistered[];
  holders: { holderCommitment: string; encryptionPubKey: string }[];
}> = ({ certs, holders }) => {
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
        <Heading>{getTitle(certs[0].zkCertStandard)}</Heading>
        {certs.map((cert) => {
          return (
            <Section key={cert.did}>
              <Card
                title={getTitle(cert.zkCertStandard)}
                description={`Expiration date: ${new Date(cert.expirationDate * 1000).toLocaleString().slice(0, 10)}`}
                value={getValue(cert)}
                extra={
                  cert.zkCertStandard === ZkCertStandard.ZkKYC
                    ? cert.content.country.slice(0, 10)
                    : ''
                }
              />
              <Box alignment="end" direction="horizontal">
                <Button
                  variant="destructive"
                  name={`delete-cert-id-${cert.leafHash}`}
                >
                  Delete
                </Button>
              </Box>
            </Section>
          );
        })}
      </Box>
    </Box>
  );
};
