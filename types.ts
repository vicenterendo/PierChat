import fs, { WriteStream } from "fs";

export type Message =
  | TextMessage
  | TransferMessage
  | TransferPacketMessage
  | TransferResponse
  | TransferConnectionMessage
  | BurnMessage
  | CloseMessage
  | ReceiveConfirmationMessage;

export interface GenericError {
  error: { message: string; code: string };
}

export interface TextMessage {
  type: "text";
  text: string;
}

export interface TransferMessage {
  type: "transfer";
  info: TransferInfo;
}

export interface TransferConnectionMessage {
  type: "transferconnection";
  address: Address;
  transfer_id: number;
}

export interface TransferPacketMessage {
  type: "transferpacket";
}

export interface TransferResponse {
  type: "transferresponse";
  accepted: boolean;
  transfer_id: number;
}

export interface BurnMessage {
  type: "burn";
}

export interface CloseMessage {
  type: "close";
}

export interface ReceiveConfirmationMessage {
  type: "receiveconfirmation";
  transfer_id: number;
}

export interface TransferInfo {
  id: number;
  total_packets: number;
  total_bytes: number;
  packet_size: number;
  encryption_token: string;
}

export interface TransferPacket {
  size: number;
  id: number;
  transfer_id: number;
}

export type ServerInfo = {
  hostname: string;
  api_port: number;
  socket_port: number;
};

export type Credentials = {
  authtoken?: string;
  userid?: number;
};

export type Address = {
  hostname: string;
  port: number;
};

export class GenericError {
  error: { message: string; code: string };

  constructor(message: string, code: string) {
    this.error = {
      message: message,
      code: code,
    };
  }
}
