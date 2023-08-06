import dgram, { Socket } from "dgram";
import crypto from "crypto";
import Terminal, { TerminalMenu, TerminalStyles } from "./insideterminal.js";
import https from "https";
import os, { type, userInfo } from "os";
import fs, { WriteStream } from "fs";
import net from "net";
import { PierChat } from "./_main.js";
import { Address, Message } from "./types.js";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DEFAULT_TERMINAL_CONFIG = {
  title: " PierChat v0.1-alpha ",
  line_appendix: `${TerminalStyles.Style.Dim}   ${TerminalStyles.Reset}`,
  input_appendix: "> ",
  margins: {
    top: 1,
    bottom: 1,
  },
};

function session_start() {
  Terminal.settings.title = ` Chatting with ${
    PierChat.session!.pier.username
  } `;
  Terminal.clear(false);

  PierChat.session = PierChat.session!;

  PierChat.session.connection.socket.on("data", message_handler);
}

function session_close() {
  Terminal.settings = DEFAULT_TERMINAL_CONFIG;
  Terminal.log(
    `${PierChat.session!.connection.display_history ? "----\n" : ""}${
      TerminalStyles.Foreground.Cyan
    }Connection ${TerminalStyles.Style.Bright}closed${TerminalStyles.Reset}${
      TerminalStyles.Foreground.Cyan
    }.${TerminalStyles.Reset}`
  );
}

function format_message(username: string, _msg: any, islocal = false) {
  const msg = _msg.toString();
  return `${
    islocal
      ? TerminalStyles.Style.Dim
      : TerminalStyles.Style.Bright + TerminalStyles.Style.Underscore
  }${username}${TerminalStyles.Reset}${TerminalStyles.Style.Dim} > ${
    TerminalStyles.Reset
  }${msg}`;
}

async function message_handler(_data: Buffer) {
  if (!PierChat.session) return;
  const packet = await PierChat.session.connection.unwrap(_data);
  if (!packet) return;
  const metadata = JSON.parse(packet.metadata.toString()) as Message;
  if (metadata.type === "text") {
    Terminal.log(format_message(PierChat.session.pier.username, metadata.text));
  } else if (metadata.type === "close") {
    if (PierChat.session) {
      session_close();
      PierChat.end_current_session();
    }
  } else if (metadata.type === "transfer") {
    if (PierChat.session) {
      const terminal_line_index = await Terminal.log(
        format_message(
          `${TerminalStyles.Foreground.Cyan}${PierChat.session.pier.username}`,
          `${TerminalStyles.Foreground.Cyan}.transfer accept ${metadata.info.id} <path>${TerminalStyles.Reset} to accept.`,
          false
        )
      );
      PierChat.session.transfer_requests.incoming.push({
        id: metadata.info.id,
        cb: async (accepted, path) => {
          if (accepted) {
            const start_time = Date.now() / 1000;
            const return_recv_transfer = await PierChat.session!.recv_transfer(
              metadata.info,
              path,
              async () => {
                if (interval) clearInterval(interval);
                Terminal.lines[terminal_line_index] = format_message(
                  `${TerminalStyles.Foreground.Cyan}${
                    PierChat.session!.pier.username
                  }`,
                  `${TerminalStyles.Foreground.Cyan}Transfered ${
                    TerminalStyles.Style.Bright
                  }${path}${TerminalStyles.Reset}${
                    TerminalStyles.Foreground.Cyan
                  } in ${TerminalStyles.Style.Bright}${
                    Math.round((Date.now() / 1000 - start_time) * 100) / 100
                  }s${TerminalStyles.Reset}`,
                  false
                );
                Terminal.draw();
              }
            );
            if (return_recv_transfer.error) {
              Terminal.log(
                `${TerminalStyles.Foreground.Red}Transfer failed. ${TerminalStyles.Style.Bright}${return_recv_transfer.error.message}${TerminalStyles.Reset}`
              );
              return;
            }
            let interval = setInterval(async () => {
              Terminal.lines[terminal_line_index] = format_message(
                `${TerminalStyles.Foreground.Cyan}${PierChat.user.username}`,
                `${TerminalStyles.Foreground.Cyan}Transferred ${
                  Math.round(
                    (return_recv_transfer.transfer.bytes_transferred /
                      1000000) *
                      100
                  ) / 100
                }MB/${
                  Math.round(
                    (return_recv_transfer.transfer.transfer_size / 1000000) *
                      100
                  ) / 100
                }MB`,
                true
              );
              Terminal.draw();
            }, 100);
          } else {
            PierChat.session?.respond_transfer(metadata.info.id, false);
          }
        },
      });
    }
  } else if (metadata.type === "transferresponse") {
    PierChat.session = PierChat.session!;
    if (metadata.accepted) {
      const request = PierChat.session.transfer_requests.outgoing.find(
        (request) => request.id === metadata.transfer_id
      );
      if (request) {
        request.cb(metadata.accepted);
      }
    }
  } else if (metadata.type === "transferconnection") {
    const request = PierChat.session.transfer_requests.connections.find(
      (request) => request.id === metadata.transfer_id
    );
    if (request) {
      request.cb(metadata.address);
    }
  }
}

PierChat.init({
  hostname: "192.168.1.74",
  api_port: 8000,
  socket_port: 55555,
});

await Terminal.init(DEFAULT_TERMINAL_CONFIG);

Terminal.on.input.render.middleware.on = (event) => {
  if (event.content.startsWith(".login")) {
    let parts = event.content.split(" ");
    if (parts[2]) parts[2] = "*".repeat(parts[2].length);
    return parts.join(" ");
  }
  return event.content;
};

Terminal.on.enter.event.on = async (event) => {
  if (event.content?.split(" ")[0] === ".code") {
    const return_new_session = await PierChat.new_session(true, (code) =>
      Terminal.log(
        `${TerminalStyles.Foreground.Green}Lobby started successfully. ${TerminalStyles.Style.Bright}${code}${TerminalStyles.Reset}`
      )
    );
    if (return_new_session.error) {
      Terminal.log(
        `${TerminalStyles.Foreground.Red}Failed to create to lobby. ${TerminalStyles.Style.Bright}${return_new_session.error.message}${TerminalStyles.Reset}`
      );
      return;
    }
    session_start();
  } else if (event.content.split(" ")[0] === ".login") {
    const credentials: { email: string; password: string } = {
      email: event.content.split(" ")[1],
      password: event.content.split(" ")[2],
    };
    const result_login = await PierChat.login(
      credentials.email,
      credentials.password
    );
    if (result_login.error) {
      Terminal.log(
        `${TerminalStyles.Foreground.Red}Failed to login. ${TerminalStyles.Style.Bright}${result_login.error.message}${TerminalStyles.Reset}`
      );
    } else {
      Terminal.log(
        `${TerminalStyles.Foreground.Green}Successfully logged in as ${TerminalStyles.Style.Bright}${PierChat.user.username}${TerminalStyles.Reset}${TerminalStyles.Foreground.Green}.${TerminalStyles.Reset}`
      );
    }
  } else if (event.content.split(" ")[0] === ".close") {
    if (PierChat.session) session_close();
    PierChat.end_current_session();
  } else if (event.content.split(" ")[0] === ".connect") {
    if (PierChat.session) PierChat.end_current_session();
    var code = event.content.split(" ")[1];
    if (!code) {
      Terminal.log(
        `${TerminalStyles.Foreground.Red}Failed to connect to session. ${TerminalStyles.Style.Bright}No code was provided.${TerminalStyles.Reset}`
      );
      return;
    }
    code = code.toUpperCase();
    const return_new_session = await PierChat.new_session(false, code);
    if (return_new_session.error) {
      Terminal.log(
        `${TerminalStyles.Foreground.Red}Failed to connect to session. ${TerminalStyles.Style.Bright}${return_new_session.error.message}${TerminalStyles.Reset}`
      );
      return;
    }
    session_start();
  } else if (event.content.split(" ")[0] === ".exit") {
    await PierChat.end_current_session();
    process.kill(0);
  } else if (PierChat.session) {
    if (event.content.split(" ")[0] === ".transfer") {
      if (event.content.split(" ")[1] === "file") {
        const filepath = event.content.split(" ")[2];
        if (!filepath) {
          Terminal.log(
            `${TerminalStyles.Foreground.Red}Transfer failed. ${TerminalStyles.Style.Bright}No source file was provided.${TerminalStyles.Reset}`
          );
          return;
        }
        const exists = await new Promise((resolve) => {
          fs.stat(filepath, (err) => {
            if (err) resolve(false);
            else resolve(true);
          });
        });
        if (!exists) {
          Terminal.log(
            `${TerminalStyles.Foreground.Red}Transfer failed. ${TerminalStyles.Style.Bright}File does not exist or is not accessible.${TerminalStyles.Reset}`
          );
          return;
        }
        const terminal_line_index = await Terminal.log(
          format_message(
            `${TerminalStyles.Foreground.Cyan}${PierChat.user.username}`,
            `Transfer requested, waiting for pier to accept...`,
            true
          )
        );
        var start_time = 0;
        var interval: NodeJS.Timer;
        const return_new_send_transfer = await PierChat.session.send_transfer(
          filepath,
          async () => {
            start_time = Date.now() / 1000;
          },
          async () => {
            if (interval) clearInterval(interval);
            Terminal.lines[terminal_line_index] = format_message(
              `${TerminalStyles.Foreground.Cyan}${PierChat.user.username}`,
              `${TerminalStyles.Foreground.Cyan}Transfered ${
                TerminalStyles.Style.Bright
              }${filepath}${TerminalStyles.Reset}${
                TerminalStyles.Foreground.Cyan
              } in ${TerminalStyles.Style.Bright}${
                Math.round((Date.now() / 1000 - start_time) * 100) / 100
              }s${TerminalStyles.Reset}`,
              true
            );
            Terminal.draw();
          }
        );

        interval = setInterval(async () => {
          if (!return_new_send_transfer || return_new_send_transfer.error)
            return;
          Terminal.lines[terminal_line_index] = format_message(
            `${TerminalStyles.Foreground.Cyan}${PierChat.user.username}`,
            `${TerminalStyles.Foreground.Cyan}Transferred ${
              Math.round(
                (return_new_send_transfer.transfer.bytes_transferred /
                  1000000) *
                  100
              ) / 100
            }MB/${
              Math.round(
                (return_new_send_transfer.transfer.transfer_size / 1000000) *
                  100
              ) / 100
            }MB`,
            true
          );
          Terminal.draw();
        }, 100);

        if (return_new_send_transfer.error) {
          Terminal.log(
            `${TerminalStyles.Foreground.Red}Transfer failed. ${TerminalStyles.Style.Bright}${return_new_send_transfer.error.message}${TerminalStyles.Reset}`
          );
          clearInterval(interval);
          return;
        }
      } else if (event.content.split(" ")[1] === "accept") {
        const request = PierChat.session.transfer_requests.incoming.find(
          (request) => request.id === parseInt(event.content.split(" ")[2])
        );
        if (!request) {
          Terminal.log(
            `${TerminalStyles.Foreground.Red}Failed to accept transfer. ${TerminalStyles.Style.Bright}Transfer not found.${TerminalStyles.Reset}`
          );
          return;
        }
        request.cb(true, event.content.split(" ")[3]);
      }
    } else if (event.content.replaceAll(" ", "")) {
      PierChat.session.connection.socket.write(
        PierChat.session.connection.wrap({
          type: "text",
          text: event.content,
        })
      );
      Terminal.log(format_message(PierChat.user.username, event.content, true));
    }
  }
};

await Terminal.log(
  TerminalStyles.Foreground.Blue +
    'Type ".connect <code>" to connect to a lobby.'
);
