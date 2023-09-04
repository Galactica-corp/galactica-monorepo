// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {

    constructor(address owner) ERC20("MockToken", "MockToken") {
        _mint(owner, 100_000 * 10 ** 18);
    }
}