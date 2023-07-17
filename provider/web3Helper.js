import Web3 from 'web3';

class Web3Helper {
    constructor(httpProvider, providerAddress, providerPrivateKey) {
      this.web3 = new Web3(httpProvider);
      this.providerAddress = providerAddress;
      this.providerPrivateKey = providerPrivateKey;
    }
  
    async getBlockNumber() {
      return this.web3.eth.getBlockNumber();
    }
  
    async getTransactionCount(address, transactionType) {
      return this.web3.eth.getTransactionCount(address, transactionType);
    }
  
    async signMessage(message) {
      return this.web3.eth.accounts.sign(message, this.providerPrivateKey);
    }
  
    async sendTransaction(options) {
      return this.web3.eth.sendTransaction(options);
    }
  
    async getTransactionReceipt(transactionHash) {
      return this.web3.eth.getTransactionReceipt(transactionHash);
    }
  
    async decodeLogs(abi, logs) {
      const contract = new this.web3.eth.Contract(abi);
      return logs.map((log) => contract.methods.decodeEventABI(log));
    }
  
    async encodeParameters(types, values) {
      return this.web3.eth.abi.encodeParameters(types, values);
    }
}

export default Web3Helper;
