export { };

/*
 * Window type extension to support ethereum
 */
declare global {
  interface Window {
    ethereum: any;
  };
}
