/**
 * @description Shortens an EVM address to the form 0x123..456 (better for size limited logs)
 * @param addr Full EVM address
 * @returns Shortened address
 */
export function shortenAddrStr(addr: string): string {
    return addr.slice(0, 5) + ".." + addr.slice(-3);
}
