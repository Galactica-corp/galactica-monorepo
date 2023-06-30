import { useContext } from 'react';
import styled from 'styled-components';
import { MetamaskActions, MetaMaskContext } from '../hooks';
import {
  connectSnap,
  getSnap,
  generateProof,
  shouldDisplayReconnectButton,
  queryVerificationSBTs,
  formatVerificationSBTs,
} from '../utils';
import {
  ConnectSnapButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  GeneralButton,
  SelectAndImportButton,
  ConnectMMButton,
} from '../components';
import { BigNumber, ethers } from 'ethers';
import { processProof, processPublicSignals } from '../utils/proofProcessing';

import addresses from '../config/addresses';
import mockDAppABI from '../config/abi/MockDApp.json';
import galacticaInstitutionABI from '../config/abi/IGalacticaInstitution.json';

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

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.large};
  font-weight: 500;
  margin-top: 0;
  margin-bottom: 0;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
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

const Notice = styled.div`
  background-color: ${({ theme }) => theme.colors.background.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  color: ${({ theme }) => theme.colors.text.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;

  & > * {
    margin: 0;
  }
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    padding: 1.6rem;
  }
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

  const handleSnapConnectClick = async () => {
    try {
      await connectSnap();
      const installedSnap = await getSnap();

      dispatch({
        type: MetamaskActions.SetInstalled,
        payload: installedSnap,
      });
      dispatch({ type: MetamaskActions.SetInfo, payload: `Connected to Galactica Snap` });
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleMMConnectClick = async () => {
    try {
      //@ts-ignore https://github.com/metamask/providers/issues/200
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // Will open the MetaMask UI
      window.ethereum.request({ method: 'eth_requestAccounts' });
      // TODO: You should disable this button while the request is pending!
      const signer = provider.getSigner();
      console.log('Connected with Metamask to', await signer.getAddress());

      dispatch({
        type: MetamaskActions.SetConnected,
        payload: await signer.getAddress(),
      });
      dispatch({ type: MetamaskActions.SetInfo, payload: `Connected to Metamask` });
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const proofGenerationClick = async () => {
    try {
      // get prover data (separately loaded because the large json should not slow down initial site loading)
      const proverText = await fetch("/provers/exampleMockDApp.json");
      const parsedFile = JSON.parse(await proverText.text());

      //@ts-ignore https://github.com/metamask/providers/issues/200
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      // get contracts
      const exampleDAppSC = new ethers.Contract(addresses.mockDApp, mockDAppABI.abi, signer);
      // fetch institution pubkey from chain because it is needed as proof input
      let institutionPubKeys: [string, string][] = [];
      for (let addr of addresses.galacticaInstitutions) {
        const institutionContract = new ethers.Contract(addr, galacticaInstitutionABI.abi, signer);
        institutionPubKeys.push([
          BigNumber.from(await institutionContract.institutionPubKey(0)).toString(),
          BigNumber.from(await institutionContract.institutionPubKey(1)).toString(),
        ]);
      }

      const userAddress = window.ethereum.selectedAddress;
      if (userAddress === null) {
        throw new Error('Please connect a metamask account first.');
      }

      dispatch({ type: MetamaskActions.SetInfo, payload: `ZK proof generation in Snap running...` });
      console.log('sending request to snap...');
      const res: any = await generateProof(parsedFile, addresses.mockDApp, institutionPubKeys, userAddress);
      console.log('Response from snap', res);

      if (res === undefined || res === null) {
        throw new Error('Proof generation failed: empty response');
      }
      dispatch({ type: MetamaskActions.SetInfo, payload: `Proof generation successful.` });
      console.log(JSON.stringify(res, null, 2));
      dispatch({ type: MetamaskActions.SetProofData, payload: res });

      // send proof directly on chain
      let [a, b, c] = processProof(res.proof);
      let publicInputs = processPublicSignals(res.publicSignals);
      console.log(`Formated proof: ${JSON.stringify({ a: a, b: b, c: c }, null, 2)}`);
      console.log(`Formated publicInputs: ${JSON.stringify(publicInputs, null, 2)}`);

      console.log(`Sending proof for on-chain verification...`);
      // this is the on-chain function that requires a ZKP
      let tx = await exampleDAppSC.airdropToken(1, a, b, c, publicInputs);
      console.log("tx", tx);
      dispatch({ type: MetamaskActions.SetInfo, payload: `Sent proof for on-chain verification` });
      const receipt = await tx.wait();
      console.log("receipt", receipt);
      dispatch({ type: MetamaskActions.SetInfo, payload: `Verified on-chain` });

      console.log(`Updating verification SBTs...`);
      await showVerificationSBTs();
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const showVerificationSBTs = async () => {
    try {
      //@ts-ignore https://github.com/metamask/providers/issues/200
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const sbts = await queryVerificationSBTs(addresses.verificationSBT, provider, await signer.getAddress());
      console.log(`Verification SBTs:\n ${formatVerificationSBTs(sbts)} `);

      dispatch({ type: MetamaskActions.SetVerificationSBT, payload: sbts });
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
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
        {state.info && (
          <InfoMessage>
            {state.info}
          </InfoMessage>
        )}
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
                  onClick={handleSnapConnectClick}
                  disabled={!state.isFlask}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: 'Reconnect to Galactica Snap',
              description:
                'While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.',
              button: (
                <ReconnectButton
                  onClick={handleSnapConnectClick}
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
              title: 'Connect to Metamask',
              description:
                `Standard Metamask connection to send transactions.`,
              button: (
                <ConnectMMButton
                  onClick={handleMMConnectClick}
                  id={"connectMM"}
                  text={state.signer}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        <Card
          content={{
            title: 'zkKYC + age proof',
            description:
              '1. Call Metamask Snap to generate a proof that you hold a zkKYC and are above 18 years old. 2. Send proof tx for on-chain verification.',
            button: (
              <GeneralButton
                onClick={proofGenerationClick}
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
            title: 'Show valid Verification SBTs',
            description: formatVerificationSBTs(state.verificationSbts),
            button: (
              <GeneralButton
                onClick={showVerificationSBTs}
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
