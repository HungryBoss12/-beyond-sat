// The subset of sql.js the Anki importer uses. The package ships no typings.
declare module "sql.js" {
  export interface Statement {
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    prepare(sql: string): Statement;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}

declare module "sql.js/dist/sql-wasm.js" {
  import initSqlJs from "sql.js";
  export default initSqlJs;
}
