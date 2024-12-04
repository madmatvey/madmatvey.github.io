export class CryptoUser {
    constructor() {
        this.address = null;
        this.encryptedTestResults = [];
        this.abi = null;
        this.contractAddress = "0x438cFd691017711468fcE90c57907A7d637A5033";
    }
    async createAsync() {
        this.abi = await fetchABI();
        this.address = await connectWallet();
        if (this.address) {
            await this.readTestResults();
        }
    }
    async writeTestResult(hash, amount) {
        if (!this.address) {
            console.log("Please connect wallet first.");
            return;
        }
        if (!hash) {
            console.log("Can't write null result to blockchain");
            return;
        }
        if (!amount) {
            console.log("Can't write zero value, sorry! We need to develop motivation test dapp :)");
            return;
        }
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(this.contractAddress, this.abi, signer);
            const tx = await contract.writeTestResult(hash, {
                value: ethers.parseEther(amount),
            });
            await tx.wait();
            console.log('Test result written:', hash);
        }
        catch (error) {
            console.error('Error writing test result:', error);
        }
    }
    async readTestResults(address) {
        try {
            // Use a read-only provider (e.g., Infura or Alchemy)
            const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/d3e6fd8a7c33469cb6c3fe729eca9d3d');
            const contract = new ethers.Contract(this.contractAddress, this.abi, provider);
            const addressToUse = address || this.address;
            if (!addressToUse) {
                throw new Error('No address provided or available');
            }
            this.encryptedTestResults = await contract.readTestResults(addressToUse);
            return;
        }
        catch (error) {
            console.error('Error reading test result:', error);
            return;
        }
    }
    async withdrawFunds() {
        await fetchABI();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(this.contractAddress, this.abi, signer);
        try {
            const owner = await contract.owner();
            const signerAddress = await signer.getAddress();
            if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
                throw new Error("Only the contract owner can withdraw funds");
            }
            const tx = await contract.withdrawFunds();
            await tx.wait();
            console.log('Funds withdrawn successfully');
        }
        catch (error) {
            console.error('Error withdrawing funds:', error);
        }
    }
    async checkContractBalance() {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(this.contractAddress);
        console.log(`Contract balance: ${ethers.formatEther(balance)} ETH`);
    }
}
async function fetchABI() {
    try {
        const response = await fetch('/assets/js/motivation-test-contract-abi.json');
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching ABI:', error);
    }
}
async function connectWallet() {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const userAddress = await signer.getAddress();
            console.log("Wallet connected, address:", userAddress);
            return userAddress;
        }
        catch (error) {
            console.error("Error connecting wallet:", error);
            return null;
        }
    }
    else {
        console.log("Please install MetaMask!");
        return null;
    }
}
