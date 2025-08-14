import {
  ZkCertStandard,
  type ZkCertRegistered,
} from '@galactica-net/galactica-types';
import {
  Banner,
  Box,
  Button,
  Field,
  FileInput,
  Form,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { CertsSection } from './certs-section';

type Props = {
  error?: string;
  activeTab: ZkCertStandard;
  holders: { holderCommitment: string; encryptionPubKey: string }[];
  zkCerts: ZkCertRegistered[];
};

export const StartPage: SnapComponent<Props> = ({
  error,
  activeTab,
  holders,
  zkCerts,
}) => {
  const certs = zkCerts.filter((cert) => {
    if (activeTab === ZkCertStandard.ZkKYC) {
      return cert.zkCertStandard === ZkCertStandard.ZkKYC;
    }
    if (activeTab === ZkCertStandard.Twitter) {
      return cert.zkCertStandard === ZkCertStandard.Twitter;
    }
    if (
      activeTab === ZkCertStandard.ArbitraryData ||
      ZkCertStandard.Exchange ||
      ZkCertStandard.Rey
    ) {
      return (
        cert.zkCertStandard !== ZkCertStandard.ZkKYC &&
        cert.zkCertStandard !== ZkCertStandard.Twitter
      );
    }

    return true;
  });

  return (
    <Box>
      <Box>
        <Form name="upload-cert-form">
          <Field label="Upload Certificate">
            <FileInput accept={['application/json']} name="file-input" />
          </Field>
        </Form>
      </Box>

      {error ? (
        <Banner title="Error" severity="danger">
          <SnapText>{error}</SnapText>
        </Banner>
      ) : null}

      <Box direction="horizontal" alignment="center">
        <Button
          variant={
            activeTab === ZkCertStandard.ZkKYC ? 'primary' : 'destructive'
          }
          name={`go-to-${ZkCertStandard.ZkKYC}`}
        >
          KYC
        </Button>
        <Button
          variant={
            activeTab === ZkCertStandard.Twitter ? 'primary' : 'destructive'
          }
          name={`go-to-${ZkCertStandard.Twitter}`}
        >
          Social
        </Button>
        <Button
          variant={
            activeTab !== ZkCertStandard.ZkKYC &&
            activeTab !== ZkCertStandard.Twitter
              ? 'primary'
              : 'destructive'
          }
          name="go-to-other-certs"
        >
          All
        </Button>
      </Box>

      <CertsSection certs={certs} holders={holders} />
    </Box>
  );
};
