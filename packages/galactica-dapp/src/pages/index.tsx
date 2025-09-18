import type { ZkCertProof } from '@galactica-net/snap-api';
import { generateZKProof, KnownZkCertStandard } from '@galactica-net/snap-api';
import { ethers } from 'ethers';
import { useContext } from 'react';
import styled from 'styled-components';

import {
  ConnectSnapButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  GeneralButton,
  ConnectWalletButton,
} from '../components';
import IAgeCitizenshipKYCVerifierABI from '../config/abi/IAgeCitizenshipKYCVerifier.json';
import kycRequirementsDemoDAppABI from '../config/abi/KYCRequirementsDemoDApp.json';
import mockDAppABI from '../config/abi/MockDApp.json';
import repeatableZKPTestABI from '../config/abi/RepeatableZKPTest.json';
import addresses from '../config/addresses';
import {
  defaultSnapOrigin,
  kycRequirementsDemoDAppPublicInputDescriptions,
  zkKYCPublicInputDescriptions,
} from '../config/snap';
import { MetamaskActions, MetaMaskContext } from '../hooks';
import {
  shouldDisplayReconnectButton,
  formatVerificationSBTs,
  getUserAddress,
  handleSnapConnectClick,
  handleWalletConnectClick,
  showVerificationSBTs,
} from '../utils';
import { processProof, processPublicSignals } from '../utils/proofProcessing';
import { getProver, prepareProofInput } from '../utils/zkp';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const Heading = styled.h1`
  margin-top: 0;
  margin-bottom: 2.4rem;
  text-align: center;
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary.default};
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error.muted};
  border: 1px solid ${({ theme }) => theme.colors.error.default};
  color: ${({ theme }) => theme.colors.error.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const InfoMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.info.muted};
  border: 1px solid ${({ theme }) => theme.colors.info.default};
  color: ${({ theme }) => theme.colors.info.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);

  const ageProofZKPClick = async () => {
    try {
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `ZK proof generation in Snap running...`,
      });

      const dateNow = new Date();
      const ageProofInputs = {
        // specific inputs to prove that the holder is at least 18 years old
        currentYear: dateNow.getUTCFullYear().toString(),
        currentMonth: (dateNow.getUTCMonth() + 1).toString(),
        currentDay: dateNow.getUTCDate().toString(),
        ageThreshold: '18',
        // specific inputs to prove that the holder is not a citizen of a sanctioned country
        countryExclusionList: [],
      };
      const proofInput = await prepareProofInput(
        addresses.mockDApp,
        [],
        ageProofInputs,
      );

      const res: any = await generateZKProof(
        {
          input: proofInput,
          prover: await getProver(
            'https://galactica-trusted-setup.s3.eu-central-1.amazonaws.com/ageCitizenshipKYC.0x01cBD5b467bA6C82d9A8BC6523a38Df0D677F817.prover.json',
          ),
          requirements: {
            zkCertStandard: KnownZkCertStandard.ZkKYC,
            registryAddress: addresses.zkKYCRegistry,
          },
          userAddress: getUserAddress(),
          description:
            'This proof discloses that you hold a valid zkKYC and that your age is at least 18.',
          publicInputDescriptions:
            kycRequirementsDemoDAppPublicInputDescriptions,
          zkInputRequiresPrivKey: true,
        },
        defaultSnapOrigin,
      );
      console.log('Response from snap', JSON.stringify(res));
      const zkp = res as ZkCertProof;

      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Proof generation successful.`,
      });
      dispatch({ type: MetamaskActions.SetProofData, payload: zkp });

      const [proofA, proofB, proofC] = processProof(zkp.proof);
      const publicInputs = processPublicSignals(zkp.publicSignals);

      console.log(`Sending proof for on-chain verification...`);
      // this is the on-chain function that requires a ZKP
      // @ts-expect-error https://github.com/metamask/providers/issues/200
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      // get contracts
      const exampleDAppSC = new ethers.Contract(
        addresses.mockDApp,
        mockDAppABI.abi,
        signer,
      );
      const tx = await exampleDAppSC.airdropToken(
        1,
        proofA,
        proofB,
        proofC,
        publicInputs,
      );
      console.log('tx', tx);
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Sent proof for on-chain verification`,
      });
      const receipt = await tx.wait();
      console.log('receipt', receipt);
      dispatch({ type: MetamaskActions.SetInfo, payload: `Verified on-chain` });

      console.log(`Updating verification SBTs...`);
      dispatch({
        type: MetamaskActions.SetVerificationSBT,
        payload: await showVerificationSBTs(
          addresses.sbtIssuingContracts,
          addresses.zkKYCRegistry,
        ),
      });
    } catch (error) {
      console.error(error);
      dispatch({ type: MetamaskActions.SetError, payload: error });
    }
  };

  const kycRequirementDemoClick = async () => {
    try {
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `ZK proof generation in Snap running...`,
      });

      const dateNow = new Date();
      const iranCountryHash =
        '1579299172692188755949140021063317367780202106533086885574412920637882772641';
      const usCountryHash =
        '4020996060095781638329708372473002493481697479140228740642027622801922135907';
      const specificProofInputs = {
        // specific inputs to prove that the holder is at least 18 years old
        currentYear: dateNow.getUTCFullYear().toString(),
        currentMonth: (dateNow.getUTCMonth() + 1).toString(),
        currentDay: dateNow.getUTCDate().toString(),
        ageThreshold: '18',
        // specific inputs to prove that the holder is not a citizen of a sanctioned country
        countryExclusionList: ['1', iranCountryHash, usCountryHash].concat(
          Array(17).fill('0'),
        ),
      };
      const proofInput = await prepareProofInput(
        addresses.kycRequirementsDemoDApp,
        [],
        specificProofInputs,
      );

      const res: any = await generateZKProof(
        {
          input: proofInput,
          prover: await getProver('provers/ageCitizenshipKYC.json'),
          requirements: {
            zkCertStandard: KnownZkCertStandard.ZkKYC,
            registryAddress: addresses.zkKYCRegistry,
          },
          userAddress: getUserAddress(),
          description:
            'This proof discloses that you hold a valid zkKYC, age >= 18, and non-US citizen.',
          publicInputDescriptions:
            kycRequirementsDemoDAppPublicInputDescriptions,
          zkInputRequiresPrivKey: true,
        },
        defaultSnapOrigin,
      );
      console.log('Response from snap', JSON.stringify(res));
      const zkp = res as ZkCertProof;

      const [proofA, proofB, proofC] = processProof(zkp.proof);
      const publicInputs = processPublicSignals(zkp.publicSignals);

      // get contracts
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const exampleDAppSC = new ethers.Contract(
        addresses.kycRequirementsDemoDApp,
        kycRequirementsDemoDAppABI.abi,
        signer,
      );
      const verifierAddr = await exampleDAppSC.verifierWrapper();
      const ageCitizenshipKYCVerifierSC = new ethers.Contract(
        verifierAddr,
        IAgeCitizenshipKYCVerifierABI.abi,
        signer,
      );

      // Check if the proof has an error code
      const errorFieldIndex = await ageCitizenshipKYCVerifierSC.INDEX_ERROR();
      const error = parseInt(publicInputs[errorFieldIndex], 10);
      if (error) {
        if (error & 1) {
          throw new Error('zkKYC is not valid');
        } else if (error & 2) {
          throw new Error('Age requirement not met');
        } else if (error & 4) {
          throw new Error('Sanction country exclusion not met');
        } else {
          throw new Error(`Proof generation failed with error code: ${error}`);
        }
      } else {
        dispatch({
          type: MetamaskActions.SetInfo,
          payload: `Proof generation successful.`,
        });
        dispatch({ type: MetamaskActions.SetProofData, payload: zkp });
      }

      console.log(`Sending proof for on-chain verification...`);
      // this is the on-chain function that requires a ZKP
      // @ts-expect-error https://github.com/metamask/providers/issues/200
      console.log('checkRequirements', proofA, proofB, proofC, publicInputs);
      const tx = await exampleDAppSC.checkRequirements(
        proofA,
        proofB,
        proofC,
        publicInputs,
      );
      console.log('tx', tx);
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Sent proof for on-chain verification`,
      });
      const receipt = await tx.wait();
      console.log('receipt', receipt);
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Passed all requirements, got Verification SBT`,
      });

      console.log(`Updating verification SBTs...`);
      dispatch({
        type: MetamaskActions.SetVerificationSBT,
        payload: await showVerificationSBTs(
          addresses.sbtIssuingContracts,
          addresses.zkKYCRegistry,
        ),
      });
    } catch (error) {
      console.error(error);
      dispatch({ type: MetamaskActions.SetError, payload: error });
    }
  };

  const resetDemoClick = async () => {
    try {
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `ZK proof generation in Snap running...`,
      });

      // get contracts
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const exampleDAppSC = new ethers.Contract(
        addresses.kycRequirementsDemoDApp,
        kycRequirementsDemoDAppABI.abi,
        signer,
      );

      console.log(`Resetting Verification SBT...`);
      // this is the on-chain function that requires a ZKP
      // @ts-expect-error https://github.com/metamask/providers/issues/200
      const tx = await exampleDAppSC.resetVerification();
      console.log('tx', tx);
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Reset TX submitted`,
      });
      const receipt = await tx.wait();
      console.log('receipt', receipt);
      dispatch({ type: MetamaskActions.SetInfo, payload: `Reset processed` });
    } catch (error) {
      console.error(error);
      dispatch({ type: MetamaskActions.SetError, payload: error });
    }
  };

  const repeatableZKPClick = async () => {
    try {
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `ZK proof generation in Snap running...`,
      });
      const proofInput = await prepareProofInput(
        addresses.repeatableZkKYCTest,
        [],
        {},
      );

      const res: any = await generateZKProof(
        {
          input: proofInput,
          prover: await getProver('provers/zkKYC.json'),
          requirements: {
            zkCertStandard: KnownZkCertStandard.ZkKYC,
            registryAddress: addresses.zkKYCRegistry,
          },
          userAddress: getUserAddress(),
          description:
            'This ZKP discloses that you hold a valid zkKYC. It has no other disclosures.',
          publicInputDescriptions: zkKYCPublicInputDescriptions,
          zkInputRequiresPrivKey: true,
        },
        defaultSnapOrigin,
      );

      console.log('Response from snap', JSON.stringify(res));
      const zkp = res as ZkCertProof;

      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Proof generation successful.`,
      });
      dispatch({ type: MetamaskActions.SetProofData, payload: zkp });

      // send proof directly on chain
      const [proofA, proofB, proofC] = processProof(zkp.proof);
      const publicInputs = processPublicSignals(zkp.publicSignals);

      console.log(`Sending proof for on-chain verification...`);
      // this is the on-chain function that requires a ZKP
      // @ts-expect-error https://github.com/metamask/providers/issues/200
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      // get contracts
      const repeatableZKPTestSC = new ethers.Contract(
        addresses.repeatableZkKYCTest,
        repeatableZKPTestABI.abi,
        signer,
      );
      const tx = await repeatableZKPTestSC.submitZKP(
        proofA,
        proofB,
        proofC,
        publicInputs,
      );
      console.log('tx', tx);
      dispatch({
        type: MetamaskActions.SetInfo,
        payload: `Sent proof for on-chain verification`,
      });
      const receipt = await tx.wait();
      console.log('receipt', receipt);
      dispatch({ type: MetamaskActions.SetInfo, payload: `Verified on-chain` });

      console.log(`Updating verification SBTs...`);
      dispatch({
        type: MetamaskActions.SetVerificationSBT,
        payload: await showVerificationSBTs(
          addresses.sbtIssuingContracts,
          addresses.zkKYCRegistry,
        ),
      });
    } catch (error) {
      console.error(error);
      dispatch({ type: MetamaskActions.SetError, payload: error });
    }
  };

  return (
    <Container>
      <Heading>
        Welcome to the <Span>Galactica zkKYC DApp</Span> example
      </Heading>
      <CardContainer>
        {state.error && (
          <ErrorMessage>
            <b>An error happened:</b> {state.error.message}
          </ErrorMessage>
        )}
        {state.info && <InfoMessage>{state.info}</InfoMessage>}
        {!state.isFlask && (
          <Card
            content={{
              title: 'Install',
              description:
                'Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.',
              button: <InstallFlaskButton />,
            }}
            fullWidth
          />
        )}
        {!state.installedSnap && (
          <Card
            content={{
              title: 'Connect to Galactica Snap',
              description:
                'Get started by connecting to and installing the Galactica proof generation snap.',
              button: (
                <ConnectSnapButton
                  onClick={async () => await handleSnapConnectClick(dispatch)}
                  disabled={!state.isFlask}
                  text={'Connect Snap'}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: 'Reconnect Snap',
              description: `You can reconnect to update the snap after making changes. Connected to snap "${state.installedSnap?.id}"`,
              button: (
                <ReconnectButton
                  onClick={async () => await handleSnapConnectClick(dispatch)}
                  disabled={!state.installedSnap}
                />
              ),
            }}
            disabled={!state.installedSnap}
          />
        )}
        {state.isFlask && state.installedSnap && (
          <Card
            content={{
              title: 'Connect Wallet',
              description: `Standard Metamask connection to send transactions. Connected to address "${state.signer}"`,
              button: (
                <ConnectWalletButton
                  onClick={async () => await handleWalletConnectClick(dispatch)}
                  id={'connectMM'}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        <Card
          content={{
            title: 'zkKYC Token Airdrop',
            description:
              '1. Call Metamask Snap to generate a proof that you hold a zkKYC and are above 18 years old. 2. Send proof tx for on-chain verification. 3. Every unique humanID gets the airdrop',
            button: (
              <GeneralButton
                onClick={ageProofZKPClick}
                disabled={false}
                text="Generate & Submit"
              />
            ),
          }}
          disabled={false}
          fullWidth={false}
        />
        <Card
          content={{
            title: 'simple zkKYC test (repeatable)',
            description:
              '1. Call Metamask Snap to generate a proof that you hold a zkKYC. 2. Send proof tx for on-chain verification.',
            button: (
              <GeneralButton
                onClick={repeatableZKPClick}
                disabled={false}
                text="Generate & Submit"
              />
            ),
          }}
          disabled={false}
          fullWidth={false}
        />
        <Card
          content={{
            title: 'KYC requirement Demo',
            description:
              'Checks zkKYC, age >= 18 and citizenship not in sanctioned country. Mints Verification SBT on success.',
            button: (
              <GeneralButton
                onClick={kycRequirementDemoClick}
                disabled={false}
                text="Generate & Submit"
              />
            ),
          }}
          disabled={false}
          fullWidth={false}
        />
        <Card
          content={{
            title: 'Reset verification state',
            description: 'Reset verification to show demo again.',
            button: (
              <GeneralButton
                onClick={resetDemoClick}
                disabled={false}
                text="Reset"
              />
            ),
          }}
          disabled={false}
          fullWidth={false}
        />
        <Card
          content={{
            title: 'Show valid Verification SBTs',
            description: formatVerificationSBTs(
              state.verificationSbts,
              state.guardianNameMap,
            ),
            button: (
              <GeneralButton
                onClick={async () =>
                  await showVerificationSBTs(
                    addresses.sbtIssuingContracts,
                    addresses.zkKYCRegistry,
                  )
                }
                disabled={false}
                text="Query"
              />
            ),
          }}
          disabled={false}
          fullWidth={false}
        />
        {/* <Notice>
          <p>
            Please note that the <b>snap.manifest.json</b> and{' '}
            <b>package.json</b> must be located in the server root directory and
            the bundle must be hosted at the location specified by the location
            field.
          </p>
        </Notice> */}
      </CardContainer>
    </Container>
  );
};

export default Index;
