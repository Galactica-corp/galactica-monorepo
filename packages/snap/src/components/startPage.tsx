import {
  KnownZkCertStandard,
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

import { CertsSection } from './certsSection';
import type { TabType } from '../stores';

type Props = {
  isLoading?: boolean;
  error?: string;
  activeTab: TabType;
  holders: { holderCommitment: string; encryptionPubKey: string }[];
  zkCerts: ZkCertRegistered[];
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const StartPage: SnapComponent<Props> = ({
  isLoading,
  error,
  activeTab,
  holders,
  zkCerts,
}) => {
  const certs = zkCerts.filter((cert) => {
    if (activeTab === 'kyc') {
      return cert.zkCertStandard === KnownZkCertStandard.ZkKYC;
    }
    if (activeTab === 'social') {
      return (
        cert.zkCertStandard === KnownZkCertStandard.Twitter ||
        cert.zkCertStandard === KnownZkCertStandard.Telegram
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
          variant={activeTab === 'kyc' ? 'primary' : 'destructive'}
          name={`go-to-tab-kyc`}
        >
          KYC
        </Button>
        <SnapText>{' | '}</SnapText>
        <Button
          variant={activeTab === 'social' ? 'primary' : 'destructive'}
          name={`go-to-tab-social`}
        >
          Social
        </Button>
        <SnapText>{' | '}</SnapText>
        <Button
          variant={activeTab === 'all' ? 'primary' : 'destructive'}
          name="go-to-tab-all"
        >
          All
        </Button>
      </Box>

      <CertsSection isLoading={isLoading} certs={certs} holders={holders} />
    </Box>
  );
};
