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
  Heading,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import { CertsSection } from './certs-section';

type Props = {
  error?: string;
  activeTab: ZkCertStandard;
  holders: string[];
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

  console.log(certs);
  return (
    <Box>
      <Box>
        <Heading>Galactica</Heading>
        <SnapText>Welcome to galactica</SnapText>
      </Box>

      <Box>
        <Form name="upload-cert-form">
          <Field label="Upload Cert">
            <FileInput accept={['application/json']} name="file-input" />
          </Field>
        </Form>
      </Box>

      {error ? (
        <Banner title="Error" severity="danger">
          <SnapText>{error}</SnapText>
        </Banner>
      ) : null}

      <Box direction="horizontal">
        <Button
          variant={
            activeTab === ZkCertStandard.ZkKYC ? 'primary' : 'destructive'
          }
          name={`go-to-${ZkCertStandard.ZkKYC}`}
        >
          KYC Certs
        </Button>
        <Button
          variant={
            activeTab === ZkCertStandard.Twitter ? 'primary' : 'destructive'
          }
          name={`go-to-${ZkCertStandard.Twitter}`}
        >
          Social Certs
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
          Other Certs
        </Button>
      </Box>

      <CertsSection certs={certs} holders={holders} />
    </Box>
  );
};
