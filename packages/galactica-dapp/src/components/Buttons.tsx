import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import styled from 'styled-components';

import { ReactComponent as FlaskFox } from '../assets/flask_fox.svg';
import type { MetamaskState } from '../hooks';

const Link = styled.a`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.theme.fontSizes.small};
  border-radius: ${(props) => props.theme.radii.button};
  border: 1px solid ${(props) => props.theme.colors.background.inverse};
  background-color: ${(props) => props.theme.colors.background.inverse};
  color: ${(props) => props.theme.colors.text.inverse};
  text-decoration: none;
  font-weight: bold;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: transparent;
    border: 1px solid ${(props) => props.theme.colors.background.inverse};
    color: ${(props) => props.theme.colors.text.default};
  }

  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
    box-sizing: border-box;
  }
`;

const Button = styled.button`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
  }
`;

const ButtonText = styled.span`
  margin-left: 1rem;
`;

const HiddenInput = styled.input`
  display: none;
`;

const ConnectedContainer = styled.div`
  display: flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.theme.fontSizes.small};
  border-radius: ${(props) => props.theme.radii.button};
  border: 1px solid ${(props) => props.theme.colors.background.inverse};
  background-color: ${(props) => props.theme.colors.background.inverse};
  color: ${(props) => props.theme.colors.text.inverse};
  font-weight: bold;
  padding: 1.2rem;
`;

const ConnectedIndicator = styled.div`
  content: ' ';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: green;
`;

export const InstallFlaskButton = () => (
  <Link href="https://metamask.io/flask/" target="_blank">
    <FlaskFox />
    <ButtonText>Install MetaMask Flask</ButtonText>
  </Link>
);

export type ButtonProps = {
  text?: string;
  onClick?: (() => void) | (() => Promise<void>);
  children?: React.ReactNode;
  [key: string]: any;
};

export const ConnectSnapButton = (props: ButtonProps) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>{props.text}</ButtonText>
    </Button>
  );
};

export const ConnectWalletButton = (props: ButtonProps) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>Connect Wallet</ButtonText>
    </Button>
  );
};

export const ReconnectButton = (props: ButtonProps) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>Reconnect</ButtonText>
    </Button>
  );
};

export const GeneralButton = (props: ButtonProps) => {
  return <Button {...props}>{props.text}</Button>;
};

/**
 * Button for importing a zkCert into Snap by first selecting it though a file input, reading it and passing the contents to the snap
 *
 * @param props - The props for the button.
 * @returns The button component.
 */
type SelectAndImportButtonProps = {
  text: string;
  fileSelectAction: (text: string) => void | Promise<void>;
};

export const SelectAndImportButton = (props: SelectAndImportButtonProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [file, setFile] = useState<File>();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }
    setFile(event.target.files[0]);

    // call snap method with file contents
    if (event.target.files[0]) {
      event.target.files[0]
        .text()
        .then(async (text) => {
          try {
            await props.fileSelectAction(text);
          } catch (error) {
            console.error('Error in fileSelectAction:', error);
          }
          return undefined;
        })
        .catch((error) => {
          console.error('Error reading file:', error);
          return undefined;
        });
    }
  };

  // Redirect the click event onto the hidden input element to open the file selector dialog
  // The original click event is executed on the file selection event
  const handleClick = () => {
    // logic to make it react on reselecting the same file
    if (inputRef.current) {
      const pausedEvent = inputRef.current.onchange;
      inputRef.current.onchange = null;
      inputRef.current.value = '';
      inputRef.current.onchange = pausedEvent;
    }

    // forward click event to hidden input, so that file dialog is opened
    inputRef.current?.click();
  };

  return (
    <div>
      <HiddenInput type="file" ref={inputRef} onChange={handleFileChange} />
      <Button onClick={handleClick}>{props.text}</Button>
    </div>
  );
};

export const HeaderButtons = ({
  state,
  onSnapConnectClick,
  onWalletConnectClick,
}: {
  state: MetamaskState;
  onSnapConnectClick(): void | Promise<void>;
  onWalletConnectClick(): void | Promise<void>;
}) => {
  if (!state.isFlask && !state.installedSnap) {
    return <InstallFlaskButton />;
  }

  if (!state.installedSnap) {
    return (
      <ConnectSnapButton onClick={onSnapConnectClick} text={'Connect Snap'} />
    );
  }

  if (!state.signer) {
    return <ConnectWalletButton onClick={onWalletConnectClick} />;
  }

  return (
    <ConnectedContainer>
      <ConnectedIndicator />
      <ButtonText>Connected</ButtonText>
    </ConnectedContainer>
  );
};
