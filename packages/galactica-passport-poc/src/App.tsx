import type { FunctionComponent, ReactNode } from 'react';
import { useContext } from 'react';
import styled from 'styled-components';

import { ToggleThemeContext } from './Root';
import { Footer, Header } from '../../galactica-dapp/src/components';
import { GlobalStyle } from '../../galactica-dapp/src/config/theme';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  max-width: 100vw;
`;

export type AppProps = {
  children: ReactNode;
};

export const App: FunctionComponent<AppProps> = ({ children }) => {
  const toggleTheme = useContext(ToggleThemeContext);

  return (
    <>
      <GlobalStyle />
      <Wrapper>
        <Header handleToggleClick={toggleTheme} />
        {children}
        <Footer />
      </Wrapper>
    </>
  );
};
