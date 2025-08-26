/* eslint-disable @typescript-eslint/naming-convention */
import type {
  ProviderMeta,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import type { Address } from 'viem';
import { getContract } from 'viem';

import { getWalletClient } from './getWalletClient';
import { guardianRegistryABI } from '../config/abi/guardianRegistry';
import { kycRecordRegistryABI } from '../config/abi/kycRecordRegistry';

export const getGuardianInfo = async (cert: ZkCertRegistered) => {
  try {
    const wc = await getWalletClient();

    const kycRecordRegistryContract = getContract({
      client: wc,
      abi: kycRecordRegistryABI,
      address: cert.registration.address as Address,
    });

    const guardianRegistryAddress =
      await kycRecordRegistryContract.read._GuardianRegistry();

    const guardianRegistryContract = getContract({
      client: wc,
      abi: guardianRegistryABI,
      address: guardianRegistryAddress,
    });

    const guardianAddress = await guardianRegistryContract.read.pubKeyToAddress(
      [BigInt(cert.providerData.ax), BigInt(cert.providerData.ay)],
    );

    const [isWhitelisted, metaUrl] =
      await guardianRegistryContract.read.guardians([guardianAddress]);

    if (metaUrl) {
      const response = await fetch(metaUrl);
      // TODO: type
      const data = (await response.json()) as ProviderMeta;

      return { data: { ...data, address: guardianAddress }, isWhitelisted };
    }
  } catch (error) {
    console.error(error);
  }

  return undefined;
};
