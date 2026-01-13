import { ethers } from 'ethers';
import { GMMC_CONTRACT, ERC20_ABI, TREASURY_ADDRESS } from './constants.js';

export async function connectToBase() {
    if (!window.ethereum) throw new Error("Please install a Web3 wallet");
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    
    if (network.chainId !== 8453n) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }],
            });
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
            }
        }
    }
    return accounts[0];
}

export async function getGMMCBalance(address) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(GMMC_CONTRACT, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    return balance / (10n ** BigInt(decimals));
}

export async function transferFeeForMint() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(GMMC_CONTRACT, ERC20_ABI, signer);
    const decimals = await contract.decimals();
    
    // Check balance once more before attempting transfer
    const balance = await contract.balanceOf(await signer.getAddress());
    const feeInWei = 15000n * (10n ** BigInt(decimals));
    
    if (balance < feeInWei) {
        throw new Error("Insufficient $GMMC balance for minting fee.");
    }

    const tx = await contract.transfer(TREASURY_ADDRESS, feeInWei);
    await tx.wait();
    return tx.hash;
}