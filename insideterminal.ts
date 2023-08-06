import readline from "readline";
//@ts-expect-error
import kp from "keypress";
import fs from "fs";

function compareArrays<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    const element1 = arr1[i];
    const element2 = arr2[i];

    if (Array.isArray(element1) && Array.isArray(element2)) {
      // Recursively compare nested arrays
      if (!compareArrays(element1, element2)) {
        return false;
      }
    } else if (element1 !== element2) {
      // Elements at the same index are not equal
      return false;
    }
  }

  return true;
}

function zeroPadNumber(number: number, desiredLength: number): string {
  const numberStr: string = number.toString();
  const zerosNeeded: number = Math.max(0, desiredLength - numberStr.length);
  const paddedNumberStr: string = "0".repeat(zerosNeeded) + numberStr;
  return paddedNumberStr;
}

interface ICodePosition {
  start: number;
  displayStart: number;
  end: number;
  code: string;
}

export class TerminalStyles {
  static readonly Reset = "\x1b[0m";

  static Foreground = class {
    static Black = "\x1b[30m";
    static readonly Red = "\x1b[31m";
    static readonly Green = "\x1b[32m";
    static readonly Yellow = "\x1b[33m";
    static readonly Blue = "\x1b[34m";
    static readonly Magenta = "\x1b[35m";
    static readonly Cyan = "\x1b[36m";
    static readonly White = "\x1b[37m";
  };

  static Background = class {
    static readonly Black = "\x1b[40m";
    static readonly Red = "\x1b[41m";
    static readonly Green = "\x1b[42m";
    static readonly Yellow = "\x1b[43m";
    static readonly Blue = "\x1b[44m";
    static readonly Magenta = "\x1b[45m";
    static readonly Cyan = "\x1b[46m";
    static readonly White = "\x1b[47m";
    static readonly Gray = "\x1b[100m";
  };

  static Style = class {
    static readonly Bright = "\x1b[1m";
    static readonly Dim = "\x1b[2m";
    static readonly Underscore = "\x1b[4m";
    static readonly Blink = "\x1b[5m";
    static readonly Reverse = "\x1b[7m";
    static readonly Hidden = "\x1b[8m";
  };
}

async function keypress(): Promise<string> {
  process.stdin.setRawMode(true);
  return new Promise((resolve, reject) => {
    process.stdin.once("data", (data) => {
      if (data.toString() === "[A") {
        resolve("up");
      } else if (data.toString() === "[B") {
        resolve("down");
      } else if (data.toString() === "[C") {
        resolve("right");
      } else if (data.toString() === "[D") {
        resolve("left");
      } else if (data[0] === 13) {
        resolve("return");
      } else {
        resolve(data.toString());
      }
    });
  });
}

function getCodePositions(inputString: string): ICodePosition[] {
  const codePattern = /\x1b\[[0-9;]*m/g;
  const codePositions: ICodePosition[] = [];

  let match: any;
  while ((match = codePattern.exec(inputString)) !== null) {
    let lastCodesLength = 0;
    for (let codePos of codePositions) {
      lastCodesLength += codePos.code.length;
    }
    const codePosition = {
      start: match.index,
      displayStart: match.index - lastCodesLength,
      end: match.index + match[0].length - 1,
      code: match[0],
    };
    codePositions.push(codePosition);
  }

  return codePositions;
}

function chunkString(inputString: string, lineWidth: number): string {
  var linePos = 0;
  var charPos = 0;
  var outputString = "";
  var codesInserted = 0;
  const codePattern = /\x1b\[[0-9;]*m/g;
  var codePositions = getCodePositions(inputString);
  inputString = " " + inputString.replace(codePattern, "");

  for (let char of inputString) {
  }

  for (let char of inputString) {
    let newChars = 1;

    const terminalCodeIndex = codePositions.findIndex(
      (code) => code.start === charPos
    );
    var terminalCode = codePositions[terminalCodeIndex];

    outputString += char;

    if (terminalCode) {
      newChars = 0;
      var lastEnd = terminalCode.start - 1;
      for (let terminalCode of codePositions.slice(codesInserted)) {
        if (lastEnd + 1 === terminalCode.start) {
          outputString += terminalCode.code;
          newChars += terminalCode.code.length + 1;
          lastEnd = terminalCode.end;
          codesInserted++;
        } else break;
      }
    } else linePos++;

    if (linePos + (1 % lineWidth) === 0) {
      outputString += "\n";
      linePos = 1;
    }
    charPos += newChars;
  }

  if (codesInserted !== codePositions.length) {
    for (let code of codePositions.slice(codesInserted)) {
      outputString += code.code;
    }
  }

  return outputString.slice(1);
}

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

interface cursorCoords {
  row: number;
  column: number;
}

export class TerminalEvent {
  type: string = "";
}

export class TerminalInputEvent extends TerminalEvent {
  type = "input";
  content: string | null;

  constructor(content: string | null = null) {
    super();
    this.content = content;
  }
}

export class TerminalClearEvent extends TerminalEvent {
  type = "clear";
  silent: boolean;

  constructor(silentClear = false) {
    super();
    this.silent = silentClear;
  }
}

export class TerminalMenuSeparator {
  length: number;
  char: string;

  constructor(length: number = 16, char: string = "─") {
    this.length = length;
    this.char = char;
  }
}

export class TerminalMenuOption<ValueType> {
  content: string;
  value: ValueType;

  constructor(content: string, value: ValueType) {
    this.content = content;
    this.value = value;
  }
}

export class TerminalMenuTitle {
  content: string;
  constructor(content = "") {
    this.content = content;
  }
}

export type TerminalMenuItemList<ValueType> = (
  | TerminalMenuOption<ValueType>
  | TerminalMenuSeparator
  | TerminalMenuTitle
)[];

export class TerminalMenu<ValueType> {
  private body: string;
  private selected: number;
  private items: TerminalMenuItemList<ValueType>;
  private hasCompleted: boolean = false;
  private destroyed: boolean = false;
  private moveHandler: (
    value: ValueType,
    self: TerminalMenu<ValueType>
  ) => void = () => {};
  private selectHandler: (
    value: ValueType,
    self: TerminalMenu<ValueType>
  ) => void = () => {};

  constructor(
    items: TerminalMenuItemList<ValueType> = [],
    body: string = "",
    selected: number = 0
  ) {
    this.items = items;
    this.body = body;
    this.selected = selected;
    this.run();
  }

  onMove(
    callback: (
      value: ValueType,
      self: TerminalMenu<ValueType>
    ) => void | Promise<void>
  ): void {
    this.moveHandler = callback;
  }

  onSelect(
    callback: (
      value: ValueType,
      self: TerminalMenu<ValueType>
    ) => void | Promise<void>
  ): void {
    this.selectHandler = callback;
  }

  private hideCursor() {
    process.stdout.write("\x1B[?25l");
  }

  private showCursor() {
    process.stdout.write("\x1B[?25h");
  }

  private async run() {
    console.clear();
    this.hideCursor();
    await this.draw();
    while (true) {
      if (this.destroyed) break;
      const key = await keypress();
      if (this.destroyed) break;
      switch (key) {
        case "up":
          if (this.selected > 0) {
            const nextAhead = await this.checkNextClear(0);
            if (nextAhead !== null) this.selected = nextAhead;
            this.draw();
            this.moveHandler(
              (this.items[this.selected] as TerminalMenuOption<ValueType>)
                .value,
              this
            );
          }
          break;
        case "down":
          if (this.selected < this.items.length - 1) {
            const nextAhead = await this.checkNextClear(1);
            if (nextAhead) this.selected = nextAhead;
            this.draw();
            this.moveHandler(
              (this.items[this.selected] as TerminalMenuOption<ValueType>)
                .value,
              this
            );
          }
          break;
        case "return":
          if (this.items[this.selected]) {
            this.draw();
            this.selectHandler(
              (this.items[this.selected] as TerminalMenuOption<ValueType>)
                .value,
              this
            );
            break;
          }
      }
      process.stdout.write("\b");
      process.stdout.write(" ");
      process.stdout.write("\b");
      if (this.destroyed) break;
    }
  }

  private async checkNextClear<I>(direction: 0 | 1) {
    let jump = 0;
    do {
      if (
        direction === 1
          ? this.selected + jump >= this.items.length - 1
          : this.selected + jump <= 0
      )
        return null;
      direction === 1 ? jump++ : jump--;
    } while (!(this.items[this.selected + jump] instanceof TerminalMenuOption));
    return this.selected + jump;
  }

  async draw() {
    this.hideCursor();
    console.clear();
    readline.cursorTo(process.stdout, 0, 0);
    console.log(this.body + TerminalStyles.Reset);
    for (var _itemIndex in this.items) {
      const itemIndex = parseInt(_itemIndex);
      const entry = this.items[itemIndex];
      if (entry instanceof TerminalMenuTitle) console.log(entry.content);
      else if (entry instanceof TerminalMenuOption)
        console.log(
          `${itemIndex === this.selected ? "" : TerminalStyles.Style.Dim}> ${itemIndex === this.selected ? TerminalStyles.Style.Underscore : ""}${entry.content}${TerminalStyles.Reset}` //prettier-ignore
        );
      else if (entry instanceof TerminalMenuSeparator)
        console.log(entry.char.repeat(entry.length));
    }
    readline.cursorTo(process.stdout, 0, process.stdout.columns - 1);
  }

  async destroy() {
    this.destroyed = true;
    this.showCursor();
  }
}

export interface KeyboardKey {
  ctrl: boolean;
  meta: boolean;
  name: string;
  sequence: string;
  shift: string;
}

export interface TerminalSettings {
  title?: string;
  line_appendix: string;
  input_appendix: string;
  obfuscate?: string;
  margins: TerminalMargins;
}

export interface TerminalMargins {
  top: number;
  bottom: number;
}

class Events {
  input: {
    render: {
      middleware: CallbackGroup<{ content: string }, string>;
    };
    content: {
      event: CallbackGroup<{ content: string }>;
      middleware: CallbackGroup<{ content: string }, string>;
    };
  };
  enter: {
    event: CallbackGroup<EnterMiddlewareEvent>;
    middleware: CallbackGroup<EnterMiddlewareEvent, string>;
  };
  clear: {
    event: CallbackGroup<{ disclaimer: boolean }>;
  };

  constructor() {
    this.input = {
      render: {
        middleware: new CallbackGroup((event) => {
          return event.content;
        }),
      },
      content: {
        event: new CallbackGroup(() => {}),
        middleware: new CallbackGroup((event) => event.content),
      },
    };
    this.enter = {
      event: new CallbackGroup(() => {}),
      middleware: new CallbackGroup((event) => event.content),
    };
    this.clear = {
      event: new CallbackGroup(() => {}),
    };
  }
}

class CallbackGroup<EventType, ReturnType = any> {
  on: (event: EventType) => ReturnType;
  once?: (event: EventType) => ReturnType;
  readonly call: (event: EventType) => ReturnType = (event: EventType) => {
    if (this.once) {
      return this.once(event);
    } else {
      return this.on(event);
    }
  };

  constructor(
    on: (event: EventType) => ReturnType,
    once?: (event: EventType) => ReturnType
  ) {
    this.on = on;
    this.once = once;
  }
}

interface EnterMiddlewareEvent {
  content: string;
  index: number;
}

export default class Terminal {
  static lines: string[] = [];
  static oldLines: string[] = [];
  static height: number = -1;
  static width: number = -1;
  static isClosed: boolean = false;
  static settings: TerminalSettings;
  static on: Events = new Events();
  private static bufferHistory: string[] = [];
  private static bufferHistoryEntryIndex: number = -1;
  private static mode: "console" | "menu" = "console";
  private static currMenu: TerminalMenu<any>;
  private static inputCursorPos = 0;
  private static drawing = false;
  private static _inputBuffer = "";
  private static inputStyleCodes: ICodePosition[] = [];
  private static drawQueue: number = 0;
  private static offset: number = 0;

  private static get inputBuffer() {
    return this._inputBuffer;
  }
  private static set inputBuffer(value: string) {
    value = this.on.input.content.middleware.call({ content: value });
    const codePositions = getCodePositions(value);
    this.inputStyleCodes = codePositions;
    codePositions.forEach((codePosition) => {
      value = value.replace(codePosition.code, "");
    });

    this._inputBuffer = value;
  }

  static async init(
    options: {
      title?: string;
      line_appendix?: string;
      input_appendix?: string;
      margins?: TerminalMargins;
      obfuscate?: string;
    } = {}
  ) {
    const {
      title = undefined,
      margins = { top: 1, bottom: 1 },
      line_appendix = "",
      input_appendix = "> ",
      obfuscate = undefined,
    } = options;
    this.settings = {
      title: title,
      margins: margins,
      line_appendix: line_appendix,
      input_appendix: input_appendix,
      obfuscate: obfuscate,
    };
    this.hideCursor();
    kp(process.stdin);
    process.stdin.setRawMode(true);
    process.stdout.write("\x1B[?7l"); // Disable line wrapping
    setInterval(this.updateDimensions, 100);
    process.stdin.on("keypress", async (str, key: KeyboardKey) => {
      if (!key) {
        key = {
          ctrl: false,
          meta: false,
          name: "",
          sequence: "",
          shift: "",
        };
      }
      if (this.mode === "menu") {
      } else if (this.mode === "console") {
        if (key.name === "left") {
          if (Terminal.inputCursorPos > 0) Terminal.inputCursorPos--;
        } else if (key.name === "right") {
          if (Terminal.inputCursorPos < Terminal.inputBuffer.length)
            Terminal.inputCursorPos++;
        } else if (key.name === "backspace") {
          if (Terminal.inputCursorPos > 0) {
            let _inputBufferChars = [...Terminal.inputBuffer];
            _inputBufferChars.splice(Terminal.inputCursorPos - 1, 1);
            Terminal.inputBuffer = _inputBufferChars.join("");
            Terminal.inputCursorPos--;
          }
        } else if (key.name === "return") {
          this.hideCursor();
          this.on.enter.event.call({
            content: this.inputBuffer,
            index: this.lines.length,
          });
          if (this.inputBuffer !== "") {
            this.bufferHistory.reverse();
            this.bufferHistory.push(this.inputBuffer);
            this.bufferHistory.reverse();
          }
          this.bufferHistoryEntryIndex = -1;
          this.inputBuffer = "";
          this.inputCursorPos = 0;
          this.draw();
        } else if (key.name === "up") {
          if (key.shift) {
            this.offset--;
          } else {
            if (
              this.bufferHistoryEntryIndex ===
              this.bufferHistory.length - 1
            ) {
              Terminal.bufferHistoryEntryIndex++;
              Terminal.inputBuffer = "";
              Terminal.inputCursorPos = 0;
            } else if (
              this.bufferHistory.length > 0 &&
              this.bufferHistoryEntryIndex < this.bufferHistory.length - 1
            ) {
              this.bufferHistoryEntryIndex++;
              this.inputBuffer =
                this.bufferHistory[this.bufferHistoryEntryIndex];
              this.inputCursorPos =
                this.bufferHistory[this.bufferHistoryEntryIndex].length;
            }
          }
        } else if (key.name === "down") {
          if (key.shift) {
            if (this.offset < 0) this.offset++;
          } else {
            if (this.bufferHistoryEntryIndex === 0) {
              this.bufferHistoryEntryIndex--;
              this.inputBuffer = "";
              this.inputCursorPos = 0;
            } else if (
              this.bufferHistory.length > 0 &&
              this.bufferHistoryEntryIndex > 0
            ) {
              this.bufferHistoryEntryIndex--;
              this.inputBuffer =
                this.bufferHistory[this.bufferHistoryEntryIndex];
              this.inputCursorPos =
                this.bufferHistory[this.bufferHistoryEntryIndex].length;
            }
          }
        } else if (str) {
          let _inputBufferChars = [...this.inputBuffer];
          _inputBufferChars.splice(this.inputCursorPos, 0, str);
          this.inputCursorPos++;
          this.inputBuffer = _inputBufferChars.join("");
          this.draw(false, { inputOnly: true });
        }
        this.draw(true, { inputOnly: false, scroll: false });
      }
    });
    process.stdin.resume();
    this.height = process.stdout.rows;
    this.width = process.stdout.columns;
    const keepRefreshed = async () => {
      while (true) {
        await new Promise((resolve) => {
          setTimeout(() => {
            if (!(this.isClosed || this.mode != "console")) null;
            resolve(null);
          }, 100);
        });
      }
    };
    const keepInput = async () => {
      while (true) {
        await new Promise(async (resolve) => {
          setTimeout(async () => {
            if (!(this.isClosed || this.mode != "console")) resolve(null);
          }, 100);
        });
      }
    };
    Terminal.draw();
  }

  static async input(
    msg: string,
    mode: string | null = "console"
  ): Promise<string | null> {
    rl.close();
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        if (mode && this.mode !== mode) {
          clearInterval(interval);
          rl.close();
          resolve(null);
        }
      });
      rl.question(msg, (userRes) => {
        resolve(userRes);
        rl.close();
      });
    });
  }

  static async refresh() {
    await this.draw(true);
  }

  static async menu<T>(
    body: string,
    items: TerminalMenuItemList<T>
  ): Promise<T> {
    this.mode = "menu";
    const currMenu: TerminalMenu<T> = new TerminalMenu<T>(items, body);

    return new Promise((resolve) => {
      currMenu.onSelect((value, self) => {
        self.destroy();
        this.mode = "console";
        this.draw(true);
        resolve(value);
      });
    });
  }

  private static async updateDimensions() {
    var hasChanged = false;
    if (Terminal.height != process.stdout.rows) {Terminal.height = process.stdout.rows; hasChanged = true;} //prettier-ignore
    if (Terminal.width != process.stdout.columns) {Terminal.width = process.stdout.columns; hasChanged = true;} //prettier-ignore
    if (hasChanged) {
      Terminal.draw(true);
    }
    return hasChanged;
  }

  private static hideCursor() {
    process.stdout.write("\x1B[?25l");
  }

  private static showCursor() {
    process.stdout.write("\x1B[?25h");
  }

  static async drawInput() {
    this.hideCursor();
    readline.cursorTo(process.stdout, 0, Terminal.height);
    readline.clearLine(process.stdout, 0);
    readline.clearLine(process.stdout, 1);
    // let inputBuffer = this.useInputRenderCallback(Terminal.inputBuffer);
    let inputBuffer = this.on.input.render.middleware.call({
      content: Terminal.inputBuffer,
    });
    if (this.settings.obfuscate)
      inputBuffer = this.settings.obfuscate.repeat(Terminal.inputBuffer.length);
    const toWrite = this.settings.input_appendix + inputBuffer;
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 1);
    let display = "";
    let inputStyleCodes = structuredClone(this.inputStyleCodes);
    for (let index in [...toWrite]) {
      const _inputStyleCodes = structuredClone(inputStyleCodes);
      _inputStyleCodes.forEach((code, i) => {
        if (
          code.displayStart ===
          parseInt(index) - this.settings.input_appendix.length
        ) {
          display += code.code;
          inputStyleCodes.splice(
            inputStyleCodes.findIndex(
              (originalCode) => originalCode.start === code.start
            ),
            1
          );
        }
      });
      display += toWrite[index];
    }
    inputStyleCodes.forEach((remainingCode) => (display += remainingCode.code));
    process.stdout.write(display);
    readline.cursorTo(process.stdout, 0);
    readline.cursorTo(
      process.stdout,
      this.settings.input_appendix.length + Terminal.inputCursorPos,
      Terminal.height
    );
  }

  private static formatLine(line: string, width: number, showlast = 2) {
    let codes = getCodePositions(line); // Codes in the original line

    let _line = [...line];

    let displayCount = 0; // Count the characters actually displayed on screen
    let modificationLength = 0; // Buffer for the joined length of all modifications done during the processing
    let outputLine = ""; // Used as board for rewriting the processed string
    let codeBuffer: ICodePosition[] = []; // Used to store the codes already written

    for (let _fullCount in _line) {
      let fullCount = parseInt(_fullCount);
      let char = _line[fullCount];
      let matchingCode = codes.find(
        (code) => code.start <= fullCount && fullCount <= code.end
      ); // Know if any codes correspond to this position

      if (matchingCode) {
        outputLine += matchingCode.code;
        codeBuffer.push(matchingCode);
      } else {
        if (displayCount > width) {
          outputLine += "\n";
          for (let code of codeBuffer) outputLine += code.code;
          displayCount = 0;
        }
        if (char === "\n") {
          outputLine += char;
          for (let code of codeBuffer) outputLine += code.code;
          displayCount = 0;
        } else {
          outputLine += char;
          displayCount++;
        }
      }
    }

    return outputLine;
  }

  static async draw(
    force = false,
    options: {
      margins?: TerminalMargins;
      scroll?: boolean;
      inputOnly?: boolean;
    } = {}
  ) {
    let {
      margins = this.settings.margins,
      inputOnly = false,
      scroll = false,
    } = options;

    if (this.drawing) {
      this.drawQueue++;
      return;
    }
    if (this.isClosed || this.mode != "console") return;
    else this.drawing = true;

    Terminal.hideCursor();
    await this.updateDimensions();

    var consoleStart = margins.top;
    if (this.settings.title) consoleStart = consoleStart + 1;

    const screenHeight = Terminal.height - 1 - margins.bottom - consoleStart;

    const ajusted_for_minimum =
      this.lines.length < screenHeight ? screenHeight : this.lines.length;

    if (ajusted_for_minimum + this.offset < screenHeight) {
      this.offset = -(ajusted_for_minimum - screenHeight);
    }

    var displayLines = structuredClone(Terminal.lines)
      .slice(
        -(Terminal.height - consoleStart - 1) + this.offset,
        0 + this.offset ? 0 + this.offset : undefined
      )
      .map((line) => line);

    for (let idx = displayLines.length - 1; idx >= 0; idx--) {
      if (idx === -1) break;
      const line = structuredClone(displayLines[idx]);
      displayLines.splice(idx, 1);
      const chunkedString = this.formatLine(
        line,
        Terminal.width - Terminal.settings.line_appendix.length
      ).split("\n");
      displayLines.splice(idx, 0, ...chunkedString);
    }

    for (let i = displayLines.length; i < screenHeight; i++)
      displayLines.push("");

    displayLines = displayLines.slice(-screenHeight);

    if (scroll) readline.cursorTo(process.stdout, 0, Terminal.height);
    else readline.cursorTo(process.stdout, 0, 0);

    if (inputOnly) await Terminal.drawInput();
    else {
      if (this.settings.title) {
        readline.clearLine(process.stdout, 0);
        console.log(
          TerminalStyles.Background.White +
            TerminalStyles.Foreground.Black +
            this.settings.title +
            TerminalStyles.Reset
        );
      }

      for (let i = 0; i < margins.top; i++) {
        readline.clearLine(process.stdout, 1);
        console.log();
      }

      let lineIndex = 0;
      let numberLength = displayLines.length.toString().length;
      for (let line of displayLines) {
        readline.clearLine(process.stdout, 1);
        console.log(
          TerminalStyles.Reset +
            this.settings.line_appendix.replaceAll(
              "$%n%$",
              zeroPadNumber(lineIndex, numberLength)
            ) +
            line
        );
        lineIndex++;
      }

      for (let i = 0; i < this.settings.margins.bottom; i++) {
        readline.clearLine(process.stdout, 0);
        console.log();
      }

      await Terminal.drawInput();
    }

    Terminal.showCursor();
    Terminal.oldLines = displayLines;
    displayLines = [];
    this.drawing = false;
    if (this.drawQueue > 0) {
      this.drawQueue--;
      this.draw();
    }
  }

  static async close() {
    if (this.isClosed) return;
    this.showCursor();
    rl.close();
    this.isClosed = true;
  }

  static async log(_content: any, timestamp = false): Promise<number> {
    if (this.isClosed) return -1;
    const content = _content.toString();
    const line_index = this.lines.push(content) - 1;
    await this.draw();
    return line_index;
  }

  static clear(disclaimer = false) {
    this.lines = [];
    disclaimer ? Terminal.log("\x1b[2mTerminal cleared\x1b[0m") : undefined;
    this.draw();
    this.on.clear.event.call({ disclaimer: disclaimer });
  }
}

type TerminalOnParams = TerminalOnParamsEnter | TerminalOnParamsInput;

interface TerminalOnParamsEnter {
  type: "enter";
  callback: (event: { text: string }, ...args: any[]) => any;
}

interface TerminalOnParamsInput {
  type: "input";
  callback: (event: { new: string; content: string }, ...args: any[]) => any;
}
