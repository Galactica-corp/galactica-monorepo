import type {
  ProviderMeta,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { GuardianRegistry__factory as GuardianRegistryFactory } from '@galactica-net/zk-certificates/typechain-types';
import type { BaseProvider } from '@metamask/providers';
import { BrowserProvider, Contract } from 'ethers';

import zkCertificateRegistryArtifact from '@galactica-net/zk-certificates/artifacts/contracts/ZkCertificateRegistry.sol/ZkCertificateRegistry.json';

export const getGuardianInfo = async (
  cert: ZkCertRegistered<Record<string, unknown>>,
  ethereum: BaseProvider,
) => {
  try {
    const provider = new BrowserProvider(ethereum);
    const kycRecordRegistryContract = new Contract(
      cert.registration.address,
      zkCertificateRegistryArtifact.abi,
      provider,
    );

    const guardianRegistryAddress =
      await kycRecordRegistryContract.guardianRegistry();

    const guardianRegistryContract = new Contract(
      guardianRegistryAddress,
      GuardianRegistryFactory.abi,
      provider,
    );

    const guardianAddress = await guardianRegistryContract.pubKeyToAddress(
      BigInt(cert.providerData.ax),
      BigInt(cert.providerData.ay),
    );

    const [isWhitelisted, metaUrl] =
      await guardianRegistryContract.guardians(guardianAddress);
    console.log('trying to fetch guardian info for guardianAddress', metaUrl);
    if (metaUrl) {
      const response = await fetch(metaUrl);
      const data = (await response.json()) as ProviderMeta;

      return { data: { ...data, address: guardianAddress }, isWhitelisted };
    }
  } catch (error) {
    console.error(error);
  }

  return undefined;
};
