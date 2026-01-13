import { ethers } from 'ethers';
import { GMMC_CONTRACT, ERC20_ABI, TREASURY_ADDRESS } from './constants.js';

let provider = null;
let currentAccount = null;
let currentChainId = null;

export function setWalletChangeCallback(callback) {
  if (!window.ethereum) return;

  window.ethereum.on('accountsChanged', (accounts) => {
    currentAccount = accounts[0] || null;
    callback({ type: 'accountsChanged', account: currentAccount });
  });

  window.ethereum.on('chainChanged', (chainId) => {
    currentChainId = parseInt(chainId, 16);
    callback({ type: 'chainChanged', chainId: currentChainId });
  });

  window.ethereum.on('disconnect', () => {
    currentAccount = null;
    currentChainId = null;
    callback({ type: 'disconnect' });
  });
}

export async function connectToBase() {
    if (!window.ethereum) throw new Error("Please install a Web3 wallet (MetaMask, Coinbase Wallet, etc.)");

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        currentAccount = accounts[0];

        const network = await provider.getNetwork();
        currentChainId = Number(network.chainId);

        if (currentChainId !== 8453) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x2105' }],
                });
                currentChainId = 8453;
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x2105',
                            chainName: 'Base Mainnet',
                            rpcUrls: ['https://mainnet.base.org'],
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://basescan.org']
                        }],
                    });
                    currentChainId = 8453;
                } else {
                    throw switchError;
                }
            }
        }
        return currentAccount;
    } catch (error) {
        throw new Error(error.message || "Failed to connect wallet. Please try again.");
    }
}

export async function getGMMCBalance(address) {
    try {
        if (!provider) {
            provider = new ethers.BrowserProvider(window.ethereum);
        }
        const contract = new ethers.Contract(GMMC_CONTRACT, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        return balance / (10n ** BigInt(decimals));
    } catch (error) {
        console.error('Error fetching balance:', error);
        throw new Error("Failed to fetch balance. Please try again.");
    }
}

export async function transferFeeForMint() {
    try {
        if (!provider) {
            provider = new ethers.BrowserProvider(window.ethereum);
        }

        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        const contract = new ethers.Contract(GMMC_CONTRACT, ERC20_ABI, signer);
        const decimals = await contract.decimals();

        const balance = await contract.balanceOf(signerAddress);
        const feeInWei = 15000n * (10n ** BigInt(decimals));

        if (balance < feeInWei) {
            throw new Error("Insufficient $GMMC balance for minting fee.");
        }

        const tx = await contract.transfer(TREASURY_ADDRESS, feeInWei);
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
            throw new Error("Transaction failed. Please try again.");
        }

        return tx.hash;
    } catch (error) {
        console.error('Minting error:', error);
        throw new Error(error.message || "Transaction failed. Please try again.");
    }
}

export function getCurrentAccount() {
    return currentAccount;
}

export function getCurrentChainId() {
    return currentChainId;
}