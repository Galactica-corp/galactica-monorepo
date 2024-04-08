import { ComponentProps, ChangeEvent, useRef, useState } from 'react';
import styled from 'styled-components';
import { MetamaskState } from '../hooks';
import { ReactComponent as FlaskFox } from '../assets/flask_fox.svg';
import { shouldDisplayReconnectButton } from '../utils';

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

export const ConnectSnapButton = (props: ComponentProps<typeof Button>) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>{props.text}</ButtonText>
    </Button>
  );
};

export const ConnectMMButton = (props: ComponentProps<typeof Button>) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>{props.text}</ButtonText>
    </Button>
  );
};

export const ReconnectButton = (props: ComponentProps<typeof Button>) => {
  return (
    <Button {...props}>
      <FlaskFox />
      <ButtonText>Reconnect</ButtonText>
    </Button>
  );
};

export const GeneralButton = (props: ComponentProps<typeof Button>) => {
  return <Button {...props}>{props.text}</Button>;
};

/**
 * Button for importing a zkCert into Snap by first selecting it though a file input, reading it and passing the contents to the snap
 */
export const SelectAndImportButton = (props: ComponentProps<typeof Button>) => {
  const [file, setFile] = useState<File>();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      return;
    }
    setFile(e.target.files[0]);

    // call snap method with file contents
    props.fileSelectAction(await e.target.files[0]?.text());
  };

  // Redirect the click event onto the hidden input element to open the file selector dialog
  // The original click event is executed on the file selection event
  const handleClick = () => {
    // logic to make it react on reselecting the same file
    const pausedEvent = inputRef.current!.onchange;
    inputRef.current!.onchange = null;
    inputRef.current!.value = '';
    inputRef.current!.onchange = pausedEvent;

    // forward click event to hidden input, so that file dialog is opened
    inputRef.current?.click();
  };

  return (
    <div>
      <HiddenInput
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
      />
      <Button {...props} onClick={handleClick}>{props.text}</Button>
    </div>
  );
};

export const HeaderButtons = ({
  state,
  onConnectClick,
}: {
  state: MetamaskState;
  onConnectClick(): unknown;
}) => {
  if (!state.isFlask && !state.installedSnap) {
    return <InstallFlaskButton />;
  }

  if (!state.installedSnap) {
    return <ConnectSnapButton onClick={onConnectClick} />;
  }

  if (shouldDisplayReconnectButton(state.installedSnap)) {
    return <ReconnectButton onClick={onConnectClick} />;
  }

  return (
    <ConnectedContainer>
      <ConnectedIndicator />
      <ButtonText>Connected</ButtonText>
    </ConnectedContainer>
  );
};
