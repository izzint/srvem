/**
 * Yet another module to query valve-style game servers.
 * 
 * Currently only supports the {@link https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO|A2S_INFO} query type.
 * 
 * @module
 */

/**
 * Interface for the Valve server query response format.
 * @see {@link https://developer.valvesoftware.com/wiki/Server_queries}
 */
export interface ValveServer {
  /** Server protocol version */
  protocol: string;

  /** Pretty server name */
  name: string;

  /** Current map name */
  map: string;

  /** The folder name of the game being played */
  game: string;

  /** The display name of the game being played */
  game_pretty: string;

  /** The Steam AppId of the game being played */
  app_id: number;

  /** Total player count */
  players: number;

  /** Maximum player count */
  max_players: number;

  /** Total number of bot players */
  bots: number;

  /**
   * Indicates the type of server.
   * - 'd' for a dedicated server
   * - 'l' for a non-dedicated server
   * - 'p' for a SourceTV relay (proxy)
   */
  type: string;

  /** The operating system the server is running */
  os: string;

  /** Does the server require a password? */
  password: boolean;

  /** Is VAC enabled on this server? */
  secure: boolean;
  
  /** The engine(?) build number */
  game_version: number;
}

// from https://developer.valvesoftware.com/wiki/Server_queries#:~:text=Request%20Format
const BASE_HEADER = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x54, 0x53, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45,
  0x6e, 0x67, 0x69, 0x6e, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00,
]);

/**
 * Queries a Valve game server for information.
 *
 * @param address The server's IP address/hostname
 * @param port The server's port number
 * @param timeout Connection timeout in milliseconds
 * 
 * @returns A promise that resolves to server information
 */
export async function query(address: string,port: number = 27015,timeout: number = 2000,): Promise<ValveServer> {
  const conn = Deno.listenDatagram({
    hostname: "0.0.0.0",
    port: 0,
    transport: "udp",
  });

  const target: Deno.NetAddr = { transport: "udp", hostname: address, port };
  let payload = BASE_HEADER;

  try {
    await conn.send(payload, target);

    const timer = setTimeout(() => {
      conn.close();
    }, timeout);

    for await (const [buffer, _addr] of conn) {
      clearTimeout(timer);

      if (!buffer || buffer.length < 4) {
        throw new Error("Invalid response packet recieved");
      }

      if (buffer[4] === 0x41) {
        const challenge = buffer.slice(5, 9);
        payload = new Uint8Array([...BASE_HEADER, ...challenge]);
        await conn.send(payload, target);
        continue;
      }

      if (buffer[4] === 0x49) {
        return parse(buffer);
      }
    }

    throw new Error("Connection timeout");
  } catch (e) {
    throw new Error(`${e}`);
  } finally {
    conn.close();
  }

  function parse(bin: Uint8Array): ValveServer {
    const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const decoder = new TextDecoder();
    let offset = 5;

    function readString(): string {
      const start = offset;
      while (offset < bin.length && bin[offset] != 0x00) {
        offset++;
      }
      const str = decoder.decode(bin.subarray(start, offset));
      offset++;
      return str;
    }

    function readByte(): number {
      return view.getUint8(offset++);
    }

    function readShort(): number {
      const what = view.getUint16(offset, true);
      offset += 2;
      return what;
    }

    function readChar(): string {
      return String.fromCharCode(readByte());
    }

    return {
      protocol: readByte().toString(),
      name: readString(),
      map: readString(),
      game: readString(),
      game_pretty: readString(),
      app_id: readShort(),
      players: readByte(),
      max_players: readByte(),
      bots: readByte(),
      type: readChar(),
      os: readChar(),
      password: readByte() === 1,
      secure: readByte() === 1,
      game_version: readShort(),
    };
  }
}