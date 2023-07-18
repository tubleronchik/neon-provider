import Web3 from 'web3';

class Web3Helper {
    constructor(httpProvider, providerAddress, providerPrivateKey) {
      this.w3 = new Web3(httpProvider);
      this.providerAddress = providerAddress;
      this.providerPrivateKey = providerPrivateKey;
    }

    async downloadABI(path) {
      const file = readFileSync(path, 'utf-8');
      return JSON.parse(file);
    }

    async getLighthouse(lighthouseAddress) {
      const lighthouseABI = this.downloadABI("../abi/Lighthouse.json")
      const lighthouse = await new this.w3.eth.Contract(lighthouseABI, lighthouseAddress)
      return lighthouse
    }

    async getNFTContract(contractAddress) {
      const nftABI = this.downloadABI("../abi/SpotNFT.json")
      const nft = await new this.w3.eth.Contract(nftABI, contractAddress)
      return nft
    }
  
    async getBlockNumber() {
      const blockNumber = await this.w3.eth.getBlockNumber()
      return blockNumber
    }
  
    async getTransactionCount(address) {
      const transactionCount = await this.w3.eth.getTransactionCount(address, "pending")
      return transactionCount
    }
  
    async signMessage(message, privateKey) {
      const signature = await this.w3.eth.accounts.sign(message, privateKey)
      return signature
    }
  
    async getTransactionReceipt(transactionHash) {
      const transactionReceipt = await this.w3.eth.getTransactionReceipt(transactionHash)
      return transactionReceipt
    }
  
    async encodeParameters(types, values) {
      return this.w3.eth.abi.encodeParameters(types, values)
    }

    async toChecksumAddress(address_dec) {
      return this.w3.utils.toChecksumAddress(address_dec)
    }

}

export default Web3Helper;
