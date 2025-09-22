import type { ZkCertRegistered } from '@galactica-net/galactica-types';
import type { Json } from '@metamask/snaps-sdk';
import {
  Address,
  Banner,
  Box,
  Button,
  Divider,
  Heading,
  Row,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';
import { ethers } from 'ethers';

import { getCertTitle } from '../utils/getCertTitle';
import { humanize } from '../utils/humanizeString';

type Props = {
  title?: string;
  cert: ZkCertRegistered<Record<string, Json>>;
  withDeleteBanner?: boolean;
};

export const Cert: SnapComponent<Props> = (props) => {
  const {
    cert,
    withDeleteBanner,
    title = getCertTitle(
      props.cert.zkCertStandard,
      cert.providerData.meta?.name,
    ),
  } = props;
  const fields = Object.entries(cert.content);

  const address =
    (cert.providerData.meta?.address as `0x${string}`) ??
    (ethers.ZeroAddress as `0x${string}`);

  return (
    <Box>
      <Box direction="horizontal" alignment="space-between">
        <Button variant="primary" name={`back-from-cert-page`}>
          Back
        </Button>
      </Box>
      <Heading size="lg">{title}</Heading>

      <Box>
        <SnapText>Issuer: {cert.providerData.meta?.name ?? '-'}</SnapText>
        <Address address={address} />
      </Box>
      <Divider />
      <Box>
        {fields.map(([key, value]) => {
          const str =
            typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value).toString();
          return (
            <Row key={`${key}`} label={`${humanize(key)}`}>
              <SnapText>{`${str || '-'}`}</SnapText>
            </Row>
          );
        })}
      </Box>

      <Divider />

      {withDeleteBanner ? (
        <Box>
          <Banner severity="danger" title="Confirm Delete">
            <SnapText>Click on "Confirm" button below</SnapText>
          </Banner>
          <Box alignment="space-around" direction="horizontal">
            <Button
              name={`delete-cert-id-${cert.leafHash}`}
              variant="destructive"
              size="md"
            >
              Confirm
            </Button>
            <Button
              name={`cancel-delete-cert-id-${cert.leafHash}`}
              variant="primary"
              size="md"
            >
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <Box direction="horizontal" alignment="end">
          <Button
            variant="destructive"
            name={`delete-preview-cert-id-${cert.leafHash}`}
          >
            Delete
          </Button>
        </Box>
      )}
    </Box>
  );
};
