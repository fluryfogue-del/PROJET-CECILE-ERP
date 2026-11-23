export interface DbResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
  };
}

export interface DbPreparedStatement {
  bind(...values: unknown[]): DbPreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}

export interface DbClient {
  prepare(sql: string): DbPreparedStatement;
  batch(statements: DbPreparedStatement[]): Promise<DbResult[]>;
}
