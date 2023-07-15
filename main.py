import json
import ipfs_api
import base64
import argparse
import web3
from eth_abi.packed import encode_packed
from eth_account import Account
from web3.middleware import construct_sign_and_send_raw_middleware
import math


def download_abi() -> tuple:
    with open("abi/Factory.json") as f:
        factory = json.load(f)
    with open("abi/Lighthouse.json") as f:
        lighthouse = json.load(f)
    with open("abi/Liability.json") as f:
        liability = json.load(f)
    return factory, lighthouse, liability


class Provider:
    def __init__(self, config_path: str) -> None:
        self.config: dict = self._read_configuration(config_path)
        self.w3 = web3.Web3(web3.Web3.HTTPProvider(self.config["http_node_provider"]))
        self.provider_account = Account.from_key(self.config["provider_pk"])
        self.w3.middleware_onion.add(construct_sign_and_send_raw_middleware(self.provider_account))
        print(f"Your hot wallet address is {self.provider_account.address}")
        self.demand = ""
        self.offer = ""
        ipfs_api.pubsub_subscribe(self.config["ipfs_topic"], self.on_message)

    def _read_configuration(self, path: str) -> dict | None:
        """Internal method. Loads the configuration.
        :param config_path: Path to the configuration file.
        :return: Python dict with the config
        """

        try:
            with open(path) as f:
                content = f.read()
                config = json.loads(content)
                return config
        except Exception as e:
            print(f"Couldn't load the configuration file: {e}")

    def on_message(self, msg: dict) -> None:
        """IPFS Pubsub callback. Saves demand and offer."""
        print(msg)
        # if msg["senderID"] == self.config["ipfs_id_dapp"]:
        #     self.demand = json.loads(msg["data"])
        #     print(f"demand: {self.demand}")
        # elif msg["senderID"] == self.config["ipfs_id_agent"]:
        #     self.offer = json.loads(msg["data"])
        #     print(f"offer: {self.offer}")
        data = json.loads(msg["data"])
        if data["sender"] == self.config["spot_address"]:
            self.offer = data
        else:
            self.demand = data
        self.check_pair_messages()

    def check_pair_messages(self):
        """Creates liability if the demand and the offer are matched"""
        if self.demand and self.offer:
            if (
                (self.demand["model"] == self.offer["model"])
                and (self.demand["objective"] == self.offer["objective"])
                and (self.demand["deadline"] > self.w3.eth.get_block_number())
            ):
                self.factory_abi, self.lighthouse_abi, self.liability = download_abi()
                self.create_liability()

    def _encode_parameters(self, msg: dict) -> bytes:
        return encode_packed(
            [
                "bytes",
                "bytes",
                "address",
                "uint256",
                "address",
                "uint256",
                "address",
                "uint256",
                "uint256",
                "address",
                "bytes",
            ],
            (
                msg["model"].encode(),
                msg["objective"].encode(),
                msg["token"],
                int(msg["cost"]),
                msg["validator"],
                int(msg["validatorFee"]),
                msg["lighthouse"],
                int(msg["lighthouseFee"]),
                int(msg["deadline"]),
                msg["sender"],
                msg["signature"].encode(),
            ),
        )

    def create_liability(self) -> None:
        """Creates liability."""

        lighthouse = self.w3.eth.contract(address=self.config["lighthouse_contract_address"], abi=self.lighthouse_abi)
        factory = self.w3.eth.contract(address=self.config["factory_contract_address"], abi=self.factory_abi)
        encoded_demand = self._encode_parameters(self.demand)
        encoded_offer = self._encode_parameters(self.offer)
        print(self.w3.eth.get_transaction_count(self.config["provider_address"]))
        print(self.w3.eth.get_transaction_count(self.provider_account.address))

        tx = lighthouse.functions.createLiability(encoded_demand, encoded_offer).build_transaction(
            {"from": self.config["provider_address"], "nonce": 72, "gas": 1000000000, "gasPrice": self.w3.eth.gas_price}
        )
        print(tx)
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.config["provider_pk"])
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)


def run() -> None:
    """Main function of the script. Read the config path as the argument from the command line."""

    parser = argparse.ArgumentParser(description="Add config path.")
    parser.add_argument("config_path", type=str, help="config path")
    args = parser.parse_args()
    Provider(args.config_path)


if __name__ == "__main__":
    run()
