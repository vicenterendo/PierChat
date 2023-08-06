import dgram, { Socket } from "dgram";
import crypto, { createECDH } from "crypto";
import Terminal, { TerminalStyles } from "./insideterminal.js";
import https from "https";
import os, { type, userInfo } from "os";
import fs, { WriteStream, read, write } from "fs";
import net from "net";
import { Server, get } from "http";
import EventEmitter, { getMaxListeners } from "events";
import zlib from "zlib";
import {
  Message,
  ServerInfo,
  Credentials,
  Address,
  GenericError,
  TransferInfo,
} from "./types.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const compress_file = async (inputFile: string, outputFile: string) => {
  const inputStream = fs.createReadStream(inputFile);
  const outputStream = fs.createWriteStream(outputFile);
  const gzip = zlib.createGzip();

  const pipelinePromise = new Promise<void>((resolve, reject) => {
    inputStream.pipe(gzip).pipe(outputStream);

    inputStream.on("error", (error) => {
      reject(error);
    });

    gzip.on("error", (error) => {
      reject(error);
    });

    outputStream.on("error", (error) => {
      reject(error);
    });

    outputStream.on("finish", () => {
      resolve();
    });
  });

  await pipelinePromise;
};

const decompress_file = async (
  compressedFile: string,
  decompressedFile: string
) => {
  const inputStream = fs.createReadStream(compressedFile);
  const outputStream = fs.createWriteStream(decompressedFile);
  const gunzip = zlib.createGunzip();

  const pipelinePromise = new Promise<void>((resolve, reject) => {
    inputStream.pipe(gunzip).pipe(outputStream);

    inputStream.on("error", (error) => {
      reject(error);
    });

    gunzip.on("error", (error) => {
      reject(error);
    });

    outputStream.on("error", (error) => {
      reject(error);
    });

    outputStream.on("finish", () => {
      resolve();
    });
  });

  await pipelinePromise;
};

export class PierChat {
  static server: ServerInfo;
  static credentials: Credentials;
  static user: User;
  static session: Session | null;
  private static close_event_emitter: EventEmitter = new EventEmitter();

  static async end_current_session() {
    this.close_event_emitter.emit("cancel");
    this.close_event_emitter.emit("close");
  }

  static async new_session(
    host: true,
    listeningCallback: (code: string) => void
  ): Promise<{ session: Session; error: null } | GenericError>;
  static async new_session(
    host: false,
    code: string
  ): Promise<{ session: Session; error: null } | GenericError>;
  static async new_session(
    host: boolean,
    code_or_callback: ((code: string) => void) | string
  ): Promise<{ session: Session; error: null } | GenericError> {
    return new Promise(async (resolve) => {
      var canceled = false;
      const canceled_error = new GenericError(
        "Connection canceled by user.",
        "canceledbyuser"
      );
      this.close_event_emitter.on("cancel", async () => {
        canceled = true;
        if (this.session && !this.session.connection.socket.writableEnded) {
          try {
            this.session.connection.socket.write(
              this.session.connection.wrap({ type: "close" })
            );
            this.session.close();
          } catch {}
        }
        this.session = null;
        resolve(canceled_error);
      });
      if (host) {
        this.close_event_emitter.on("cancel", async () => {
          if (
            return_register_lobby &&
            !return_register_lobby.error &&
            !this.session
          )
            PierChat.close_lobby(return_register_lobby.code);
        });

        code_or_callback = code_or_callback as (code: string) => void;
        const _connection = await P2P.host(
          {
            hostname: this.server.hostname,
            port: this.server.socket_port,
          },
          this.close_event_emitter
        );

        _connection.on("cancel", () => {
          canceled = true;
        });

        const return_register_lobby:
          | GenericError
          | {
              error: null;
              code: any;
              encryption_token: any;
            } = await new Promise((resolve) => {
          _connection.once("start", async (address: Address) => {
            resolve(await PierChat.register_lobby(address));
          });
        });

        if (canceled) return;

        if (return_register_lobby.error) {
          resolve(return_register_lobby);
          return;
        }

        code_or_callback(return_register_lobby.code);

        const socket: net.Socket = await new Promise(async (resolve) => {
          _connection.once("connection", (socket) => {
            resolve(socket);
          });
        });

        if (canceled) return;

        const return_close_lobby = await PierChat.close_lobby(
          return_register_lobby.code
        );

        if (canceled) return;

        if (return_close_lobby.error) {
          resolve(return_close_lobby);
          return;
        }

        const return_get_user_pier = await this.get_user(
          return_close_lobby.pier_userid
        );

        if (canceled) return;

        if (return_get_user_pier.error) {
          resolve(return_get_user_pier);
          return;
        }

        var pier = new Pier(
          return_get_user_pier.user.id,
          return_get_user_pier.user.username,
          return_get_user_pier.user.created_at,
          { hostname: socket.remoteAddress!, port: socket.remotePort! }
        );

        this.session = new Session(
          pier,
          new P2PConnection(socket, {
            encryption_token: return_register_lobby.encryption_token,
          }),
          {
            hostname: this.server.hostname,
            port: this.server.socket_port,
          }
        );

        if (canceled) return;

        resolve({ session: this.session, error: null });
      } else {
        code_or_callback = code_or_callback as string;

        const return_auth_lobby = await this.auth_lobby(code_or_callback);

        if (canceled) return;

        if (return_auth_lobby.error) {
          resolve(return_auth_lobby);
          return;
        }

        const return_get_user_host = await this.get_user(
          return_auth_lobby.host_userid
        );

        if (canceled) return;

        if (return_get_user_host.error) {
          resolve(return_get_user_host);
          return;
        }

        const _connection = await P2P.client(return_auth_lobby.host);

        if (_connection.error) {
          resolve(_connection);
          return;
        }

        const pier = new Pier(
          return_get_user_host.user.id,
          return_get_user_host.user.username,
          return_get_user_host.user.created_at,
          return_auth_lobby.host
        );

        this.session = new Session(
          pier,
          new P2PConnection(_connection.socket, {
            encryption_token: return_auth_lobby.encryption_token,
          }),
          {
            hostname: this.server.hostname,
            port: this.server.socket_port,
          }
        );

        if (canceled) return;
        resolve({
          session: this.session,
          error: null,
        });
      }
    });
  }

  static async init(server: ServerInfo, credentials?: Credentials) {
    this.server = server;
    if (credentials) this.credentials = credentials;
  }

  static async login(email: string, password: string) {
    let res = await fetch(
      `https://${this.server.hostname}:${this.server.api_port}/auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      }
    );
    const data = await res.json();
    if (res.status === 200) {
      const return_user_info = await this.get_user(data.userid);
      if (return_user_info.error) return return_user_info;

      this.user = return_user_info.user;
      this.credentials = {
        authtoken: data.token,
        userid: parseInt(data.userid),
      };

      return { error: null };
    } else return new GenericError(data.message, data.code);
  }

  static async get_user(userid: number) {
    const res = await fetch(
      `https://${this.server.hostname}:${this.server.api_port}/user?userid=${userid}`,
      {
        method: "GET",
      }
    );
    const data = await res.json();
    if (res.status === 200) {
      return {
        error: null,
        user: new User(data.id, data.username, data.created_at),
      };
    } else return new GenericError(data.message, data.code);
  }

  static async register_lobby(address: Address): Promise<
    | GenericError
    | {
        error: null;
        code: any;
        encryption_token: any;
      }
  > {
    if (!this.is_loggedin()) {
      return { error: { message: "Not logged in yet.", code: "notloggedin" } };
    }

    const res = await fetch(
      `https://${this.server.hostname}:${this.server.api_port}/lobby?hostname=${address.hostname}&port=${address.port}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: this.credentials.authtoken!,
          userid: this.credentials.userid!.toString(),
        },
      }
    );

    const data = await res.json();

    if (res.status === 200) {
      return {
        error: null,
        code: data.code,
        encryption_token: data.crypt_token,
      };
    } else {
      return new GenericError(data.message, data.code);
    }
  }

  static async auth_lobby(code: string) {
    if (!this.is_loggedin()) {
      return { error: { message: "Not logged in yet.", code: "notloggedin" } };
    }

    const res = await fetch(
      `https://${this.server.hostname}:${this.server.api_port}/lobby?code=${code}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: this.credentials.authtoken!,
          userid: this.credentials.userid!.toString(),
        },
      }
    );

    const data = await res.json();

    if (res.status !== 200) {
      if (data.message && data.code)
        return {
          error: { message: data.message, code: data.code },
        };
      else
        return {
          error: {
            message: "Invalid request.",
            code: "invalidrequest",
          },
        };
    } else {
      return {
        error: null,
        encryption_token: data!.crypt_token!,
        host_userid: parseInt(data!.host_userid!),
        host: {
          hostname: data!.host[0]!,
          port: parseInt(data!.host[1]!),
        },
      } as {
        error: null;
        encryption_token: string;
        host_userid: number;
        host: Address;
      };
    }
  }

  static async close_lobby(code: string) {
    if (!this.is_loggedin()) {
      return { error: { message: "Not logged in yet.", code: "notloggedin" } };
    }

    let res = await fetch(
      `https://${this.server.hostname}:${this.server.api_port}/lobby?code=${code}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: this.credentials.authtoken!,
          userid: this.credentials.userid!.toString(),
        },
      }
    );

    const data = await res.json();

    if (res.status !== 200) {
      return { error: { message: data.message, code: data.code } };
    } else {
      return { error: null, pier_userid: data.pier_userid };
    }
  }

  static is_loggedin(): boolean {
    if (
      this.credentials &&
      this.credentials.authtoken &&
      this.credentials.userid
    )
      return true;
    else return false;
  }

  static is_innitialized(strict: boolean = true): ("server_info" | "login")[] {
    var missing: ("server_info" | "login")[] = [];
    if (!this.server) missing.push("server_info");
    if (strict) {
      if (!this.is_loggedin()) missing.push("login");
    }
    return missing;
  }
}

class User {
  id: number;
  username: string;
  created_at: number;

  constructor(id: number, username: string, created_at: number) {
    this.id = id;
    this.username = username;
    this.created_at = created_at;
  }
}

class Pier extends User {
  address: Address;

  constructor(
    id: number,
    username: string,
    created_at: number,
    address: Address
  ) {
    super(id, username, created_at);
    this.address = address;
  }
}

class Session {
  pier: Pier;
  translation_server: Address;
  connection: P2PConnection;
  transfers: {
    outgoing: SendTransfer[];
    incoming: ReceiveTransfer[];
  } = { outgoing: [], incoming: [] };
  transfer_requests: {
    outgoing: { id: number; cb: (accepted: boolean) => any }[]; // Accept / reject transfer
    incoming: { id: number; cb: (accepted: boolean, path: string) => any }[]; // Accept / reject transfer
    connections: { id: number; cb: (address: Address) => any }[]; // Connection data
  } = {
    outgoing: [],
    incoming: [],
    connections: [],
  };
  started_at: number;
  closed: boolean = false;

  constructor(
    pier: Pier,
    connection: P2PConnection,
    translation_server: Address
  ) {
    this.pier = pier;
    this.connection = connection;
    this.started_at = Date.now() / 1000;
    this.translation_server = translation_server;
  }

  async respond_transfer(transfer_id: number, accept: boolean) {
    this.connection.socket.write(
      this.connection.wrap({
        type: "transferresponse",
        accepted: accept,
        transfer_id: transfer_id,
      })
    );
  }

  async send_transfer(
    path: string,
    start_callback: () => any,
    end_callback: () => any
  ): Promise<{ error: null; transfer: SendTransfer } | GenericError> {
    const file_stats = fs.statSync(path);
    const PACKET_SIZE = 50000;
    const id = Math.ceil(Math.random() * 99999999999999);
    const encryption_token = crypto.randomBytes(32).toString("hex");

    this.connection.socket.write(
      this.connection.wrap({
        type: "transfer",
        info: {
          id: id,
          total_packets: Math.ceil(file_stats.size / PACKET_SIZE),
          packet_size: PACKET_SIZE,
          total_bytes: file_stats.size,
          encryption_token: encryption_token,
        },
      })
    );

    const accepted: boolean = await new Promise((resolve) => {
      this.transfer_requests.outgoing.push({
        id: id,
        cb: (accepted) => resolve(accepted),
      });
    });

    if (!accepted)
      return new GenericError(
        "Transfer was refused by pier.",
        "transferrefused"
      );

    const _connection = await P2P.host(this.translation_server);
    const address: Address = await new Promise(async (resolve) => {
      _connection.once("start", (addr: Address) => resolve(addr));
    });
    const socket: net.Socket = await new Promise(async (resolve) => {
      _connection.on("connection", (socket: net.Socket) => {
        resolve(socket);
      });
      this.connection.socket.write(
        this.connection.wrap({
          type: "transferconnection",
          address: address,
          transfer_id: id,
        })
      );
    });
    const connection = new P2PConnection(socket, {
      encryption_token: encryption_token,
      stay_alive: false,
    });

    const transfer = new SendTransfer(path, connection, PACKET_SIZE, id);
    this.transfers.outgoing.push(transfer);
    transfer.transfer(end_callback);
    start_callback();
    return { error: null, transfer: transfer };
  }

  async recv_transfer(
    info: TransferInfo,
    path: string,
    end_callback: () => any
  ): Promise<GenericError | { error: null; transfer: ReceiveTransfer }> {
    const address: Address = await new Promise(async (resolve) => {
      this.transfer_requests.connections.push({
        id: info.id,
        cb: (address) => resolve(address),
      });
      this.respond_transfer(info.id, true);
    });
    const _socket = await P2P.client(address);
    if (_socket.error) return _socket;
    const socket = _socket.socket;
    const connection = new P2PConnection(socket, {
      encryption_token: info.encryption_token,
      stay_alive: false,
    });
    const transfer = new ReceiveTransfer(
      path,
      connection,
      info.total_packets,
      info.total_bytes,
      info.packet_size,
      info.id
    );
    this.transfers.incoming.push(transfer);
    transfer.transfer(end_callback);
    return { error: null, transfer: transfer };
  }

  close() {
    this.connection.close();
    this.closed = true;
  }
}

class Transfer {
  path: string;
  id: number | null;
  connection: P2PConnection;
  packet_size: number;
  bytes_transferred: number = 0;
  transfer_size: number = 0;

  constructor(
    path: string,
    connection: P2PConnection,
    packet_size: number,
    id: number | null
  ) {
    this.packet_size = packet_size;
    this.path = path;
    this.connection = connection;
    this.id = id;
  }
}

class SendTransfer extends Transfer {
  async transfer(end_callback: () => any) {
    const file_size = fs.statSync(this.path).size;
    this.transfer_size = file_size;
    const path = this.path;

    const read_stream = fs.createReadStream(path);

    read_stream.on("readable", () => {
      let data;
      while ((data = read_stream.read(this.packet_size))) {
        data = data as Buffer;
        if (this.connection.options.encryption_token)
          data = P2P.encrypt(data, this.connection.options.encryption_token);
        this.connection.socket.write(data);
        this.bytes_transferred += data.byteLength;
      }
    });

    read_stream.on("end", async () => {
      this.connection.close();
      end_callback();
    });
  }
}

class ReceiveTransfer extends Transfer {
  total_packets: number;

  constructor(
    path: string,
    connection: P2PConnection,
    total_packets: number,
    transfer_size: number,
    packet_size: number,
    id: number | null
  ) {
    super(path, connection, packet_size, id);
    this.transfer_size = transfer_size;
    this.total_packets = total_packets;
  }

  async transfer(end_callback: () => any) {
    const path = this.path;
    const write_stream = fs.createWriteStream(path);
    this.connection.socket.on("data", async (data) => {
      if (this.connection.options.encryption_token)
        data = P2P.decrypt(data, this.connection.options.encryption_token);
      write_stream.write(data);
      this.bytes_transferred += data.byteLength;
      if (this.bytes_transferred >= this.transfer_size) {
        end_callback();
        this.connection.close();
      }
    });
  }
}

class TransferEventEmitter {
  send_callback: (transfer: Transfer, data: Buffer) => any = () => {};
  recv_callback: (transfer: Transfer, data: Buffer) => any = () => {};
  start_callback: (transfer: Transfer) => any = () => {};
  end_callback: (transfer: Transfer) => any = () => {};

  send_callback_once: ((transfer: Transfer, data: Buffer) => any) | null =
    () => {};
  recv_callback_once: ((transfer: Transfer, data: Buffer) => any) | null =
    () => {};
  start_callback_once: ((transfer: Transfer) => any) | null = () => {};
  end_callback_once: ((transfer: Transfer) => any) | null = () => {};

  on(
    event: "send" | "recv",
    callback: (transfer: Transfer, data: Buffer) => any
  ): void;
  on(event: "start" | "end", callback: (transfer: Transfer) => any): void;
  on(
    event: "send" | "recv" | "start" | "end",
    callback:
      | ((transfer: Transfer) => any)
      | ((transfer: Transfer, data: Buffer) => any)
  ): void {
    if (event === "send") {
      this.send_callback = callback as (
        transfer: Transfer,
        data: Buffer
      ) => any;
    } else if (event === "recv") {
      this.recv_callback = callback as (
        transfer: Transfer,
        data: Buffer
      ) => any;
    } else if (event === "start") {
      this.start_callback = callback as (transfer: Transfer) => any;
    } else if (event === "end") {
      this.end_callback = callback as (transfer: Transfer) => any;
    }
  }

  once(
    event: "send" | "recv",
    callback: (transfer: Transfer, data: Buffer) => any
  ): void;
  once(event: "start" | "end", callback: (transfer: Transfer) => any): void;
  once(
    event: "send" | "recv" | "start" | "end",
    callback:
      | ((transfer: Transfer) => any)
      | ((transfer: Transfer, data: Buffer) => any)
  ): void {
    if (event === "send") {
      this.send_callback = callback as (
        transfer: Transfer,
        data: Buffer
      ) => any;
    } else if (event === "recv") {
      this.recv_callback = callback as (
        transfer: Transfer,
        data: Buffer
      ) => any;
    } else if (event === "start") {
      this.start_callback = callback as (transfer: Transfer) => any;
    } else if (event === "end") {
      this.end_callback = callback as (transfer: Transfer) => any;
    }
  }

  emit(
    event: "send" | "recv" | "start" | "end",
    transfer: Transfer,
    data?: Buffer
  ) {
    if (event === "send") {
      if (this.send_callback_once) {
        this.send_callback_once(transfer, data!);
        this.send_callback_once = null;
      } else {
        this.send_callback(transfer, data!);
      }
    } else if (event === "recv") {
      if (this.recv_callback_once) {
        this.recv_callback_once(transfer, data!);
        this.recv_callback_once = null;
      } else {
        this.recv_callback(transfer, data!);
      }
    } else if (event === "start") {
      if (this.start_callback_once) {
        this.start_callback_once(transfer);
        this.start_callback_once = null;
      } else {
        this.start_callback(transfer);
      }
    } else if (event === "end") {
      if (this.end_callback_once) {
        this.end_callback_once(transfer);
        this.end_callback_once = null;
      } else {
        this.end_callback(transfer);
      }
    }
  }
}

class P2PConnection {
  socket: net.Socket;
  buffer: Buffer;
  last_message: number = Date.now() / 1000;
  display_history: number = 0;
  closed: boolean = false;
  options: {
    encryption_token: string | null;
    start_bytes: Buffer;
    end_bytes: Buffer;
    metadata_separator: Buffer;
  } = {
    encryption_token: null,
    start_bytes: Buffer.from([
      218, 247, 155, 198, 167, 142, 255, 51, 83, 225, 86, 96, 42, 210, 55, 4, 2,
      64, 63, 31, 76, 241, 50, 72, 162, 99, 24, 16, 141, 180, 186, 33, 196, 124,
      194, 151, 104, 110, 102, 61, 11, 142, 44, 192, 136, 186, 247, 81, 239,
      134, 3, 8, 188, 215, 214, 225, 120, 171, 196, 227, 200, 3, 242, 253, 90,
      219, 118, 117, 28, 96,
    ]),
    end_bytes: Buffer.from([
      15, 169, 250, 98, 40, 147, 182, 162, 180, 100, 249, 210, 212, 107, 151,
      107, 138, 171, 226, 190, 213, 141, 19, 143, 42, 241, 124, 203, 160, 109,
      72, 239, 163, 237, 128, 199, 171, 92, 21, 215, 87, 253, 235, 153, 162,
      153, 8, 58, 13, 27, 238, 159, 122, 110, 82, 176, 197, 142, 24, 51, 32,
      159, 151, 86, 147, 53, 98, 131, 230, 218,
    ]),
    metadata_separator: Buffer.from([
      105, 215, 53, 82, 196, 30, 148, 123, 18, 10, 21, 9, 166, 1, 35, 133, 48,
      50, 63, 173, 26, 99, 194, 40, 49, 120, 91, 90, 22, 20, 238, 223, 175, 216,
      191, 23, 195, 151, 64, 188, 242, 238, 72, 37, 26, 63, 128, 207, 224, 119,
      160, 96, 25, 188, 42, 228, 215, 205, 70, 182, 9, 64, 247, 74, 235, 169,
      161, 111, 224, 211,
    ]),
  };

  constructor(
    socket: net.Socket,
    options: {
      encryption_token?: string | null;
      start_bytes?: Buffer;
      end_bytes?: Buffer;
      metadata_separator?: Buffer;
      stay_alive?: boolean;
    } = {}
  ) {
    const {
      encryption_token = null,
      metadata_separator = Buffer.from([
        105, 215, 53, 82, 196, 30, 148, 123, 18, 10, 21, 9, 166, 1, 35, 133, 48,
        50, 63, 173, 26, 99, 194, 40, 49, 120, 91, 90, 22, 20, 238, 223, 175,
        216, 191, 23, 195, 151, 64, 188, 242, 238, 72, 37, 26, 63, 128, 207,
        224, 119, 160, 96, 25, 188, 42, 228, 215, 205, 70, 182, 9, 64, 247, 74,
        235, 169, 161, 111, 224, 211,
      ]),
      start_bytes = Buffer.from([
        218, 247, 155, 198, 167, 142, 255, 51, 83, 225, 86, 96, 42, 210, 55, 4,
        2, 64, 63, 31, 76, 241, 50, 72, 162, 99, 24, 16, 141, 180, 186, 33, 196,
        124, 194, 151, 104, 110, 102, 61, 11, 142, 44, 192, 136, 186, 247, 81,
        239, 134, 3, 8, 188, 215, 214, 225, 120, 171, 196, 227, 200, 3, 242,
        253, 90, 219, 118, 117, 28, 96,
      ]),
      end_bytes = Buffer.from([
        15, 169, 250, 98, 40, 147, 182, 162, 180, 100, 249, 210, 212, 107, 151,
        107, 138, 171, 226, 190, 213, 141, 19, 143, 42, 241, 124, 203, 160, 109,
        72, 239, 163, 237, 128, 199, 171, 92, 21, 215, 87, 253, 235, 153, 162,
        153, 8, 58, 13, 27, 238, 159, 122, 110, 82, 176, 197, 142, 24, 51, 32,
        159, 151, 86, 147, 53, 98, 131, 230, 218,
      ]),
      stay_alive = true,
    } = options;
    this.socket = socket;
    this.socket.on("error", () => {
      this.close();
    });
    this.buffer = Buffer.alloc(0);
    this.options.encryption_token = encryption_token;
    this.options.metadata_separator = metadata_separator;
    this.options.start_bytes = start_bytes;
    this.options.end_bytes = end_bytes;

    if (stay_alive) {
      const stay_up_interval = setInterval(async () => {
        if (this.closed) clearInterval(stay_up_interval);

        try {
          if (Date.now() / 1000 - this.last_message > 10) {
            this.socket.write(this.wrap({ type: "burn" }));
          }
        } catch {}
      }, 500);
    }
  }

  close() {
    this.closed = true;
    this.socket.end();
  }

  wrap(_metadata: Message, _data?: Buffer): Buffer {
    if (_data) {
      var data = Buffer.concat([
        Buffer.from(JSON.stringify(_metadata)),
        this.options.metadata_separator,
        _data,
      ]);
    } else {
      var data = Buffer.from(JSON.stringify(_metadata));
    }
    if (this.options.encryption_token)
      data = P2P.encrypt(data, this.options.encryption_token);
    const output = Buffer.concat([
      this.options.start_bytes,
      data,
      this.options.end_bytes,
    ]);
    this.last_message = Date.now() / 1000;
    if (
      _metadata.type === "text" ||
      _metadata.type === "transfer" ||
      _metadata.type === "transferpacket" ||
      _metadata.type === "receiveconfirmation" ||
      _metadata.type === "transferresponse"
    )
      this.display_history++;
    return output;
  }

  unwrap(_data: Buffer): {
    metadata: Buffer;
    data?: Buffer;
  } | null {
    this.buffer = Buffer.concat([this.buffer, _data]);
    const startIndex = this.buffer.indexOf(this.options.start_bytes);
    const endIndex = this.buffer.indexOf(this.options.end_bytes);
    if (startIndex == -1 || endIndex == -1) return null; // If no complete packet was found

    var packet_data = this.buffer.subarray(
      startIndex + this.options.start_bytes.byteLength,
      endIndex
    ); // Grab the data between the start and end marks

    this.buffer = this.buffer.subarray(
      endIndex + this.options.end_bytes.byteLength
    ); // Clear used data (data behind the end mark + the end mark)

    if (this.options.encryption_token)
      packet_data = P2P.decrypt(packet_data, this.options.encryption_token); // Decrypt the data if an encryption key is available

    const separator_index = packet_data.indexOf(this.options.end_bytes); // Find the position of the separator between metadata and data

    if (separator_index === -1) {
      const __metadata = JSON.parse(packet_data.toString()).type;
      if (
        __metadata === "text" ||
        __metadata === "transfer" ||
        __metadata === "transferpacket" ||
        __metadata === "receiveconfirmation" ||
        __metadata === "transferresponse"
      )
        this.display_history++;
      return { metadata: packet_data }; // Return just metadata if no separator was found (no separator = no data)
    } else {
      const __metadata = JSON.parse(
        packet_data.subarray(0, separator_index).toString()
      ).type;
      if (
        __metadata === "text" ||
        __metadata === "file" ||
        __metadata === "filepacket" ||
        __metadata === "receiveconfirmation" ||
        __metadata === "transferresponse"
      )
        this.display_history++;
      return {
        metadata: packet_data.subarray(0, separator_index), // Data before the separator's start
        data: packet_data.subarray(
          separator_index + this.options.metadata_separator.byteLength
        ), // Data after the the separator itself (start + length)
      };
    }
  }
}

class P2P {
  static encrypt(buffer: Buffer, token: string) {
    return buffer;
    const algorithm = "aes-256-cbc";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(token, "hex"),
      iv
    );

    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return Buffer.concat([iv, encrypted]);
  }

  static decrypt(buffer: Buffer, token: string) {
    return buffer;
    const algorithm = "aes-256-cbc";
    const iv = buffer.subarray(0, 16);
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(token, "hex"),
      iv
    );

    let decrypted = decipher.update(buffer.subarray(16));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  static async host(
    server: Address,
    cancel_event_emitter?: EventEmitter
  ): Promise<EventEmitter> {
    return new Promise<EventEmitter>(async (resolve) => {
      var canceled = false;
      if (cancel_event_emitter)
        cancel_event_emitter.on("cancel", () => {
          if (s) s.close();
          if (c) c.end();
          event_emitter.emit("canceled");
        });
      const event_emitter = new EventEmitter();
      resolve(event_emitter);
      var c: net.Socket;
      await new Promise((resolve) => {
        c = net.createConnection(
          { host: server.hostname, port: server.port },
          function () {
            resolve(null);
          }
        );
      });
      c = c!;
      const s = net.createServer();
      s.listen(c.localPort, c.localAddress);
      if (canceled) return;
      event_emitter.emit("start", {
        hostname: c.localAddress,
        port: c.localPort,
      } as Address);
      const socket: net.Socket = await new Promise((resolve) => {
        s.once("connection", (_socket) => {
          resolve(_socket);
        });
      });
      if (canceled) return;
      event_emitter.emit("connection", socket);
    });
  }

  static async client(host_address: Address) {
    var output: { error: null; socket: net.Socket } | GenericError;
    await new Promise((resolve, reject) => {
      try {
        output = {
          error: null,
          socket: net.createConnection(
            { host: host_address.hostname, port: host_address.port },
            () => resolve(null)
          ),
        };
      } catch (e) {
        output = new GenericError(
          "Failed to connect to host.",
          "hostconnectionfailed"
        );
        resolve(null);
      }
    });
    return output!;
  }
}
