import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { buildStartedState, type GameRow } from "@/lib/gameStart";
import type { GameState, MoveIntent } from "@capi/engine";

// An in-memory stand-in for the supabase-js query builder, covering exactly
// what the API routes use: select/insert/update/delete, eq filters, single and
// maybeSingle. Like supabase-js it never throws: failures come back as
// { data: null, error }. Unique indexes match supabase/migrations.

type Row = Record<string, any>;
type Op = "select" | "insert" | "update" | "delete";
export type Result = { data: any; error: { code: string; message: string } | null };

export interface Call {
  table: string;
  op: Op;
  filters: Array<[string, unknown]>;
  values?: Row | Row[];
}

const UNIQUE: Record<string, string[][]> = {
  games: [["invite_code"]],
  players: [["game_id", "seat"]],
};

const clone = <T>(v: T): T => structuredClone(v);

export class FakeDb {
  tables: Record<string, Row[]> = { games: [], players: [], moves: [], chat_emotes: [] };
  calls: Call[] = [];
  // Every update matches no row, as under RLS once migration 005 dropped the
  // public update policy and the server still runs on the publishable key.
  lockWrites = false;
  // Runs before each query; a returned result answers it instead of the tables.
  intercept?: (call: Call) => Result | undefined;

  // What the routes sent through the Realtime REST endpoint (httpSend).
  broadcasts: Array<{ topic: string; event: string; payload: any }> = [];

  from(table: string) {
    return new Query(this, table);
  }

  channel(topic: string) {
    return {
      httpSend: async (event: string, payload: any) => {
        this.broadcasts.push({ topic, event, payload: clone(payload) });
        return { success: true };
      },
    };
  }

  async removeChannel(_channel: unknown) {
    return "ok";
  }

  row(table: string, id: string): Row | undefined {
    return this.tables[table].find((r) => r.id === id);
  }

  insertRow(table: string, row: Row): Row {
    const full = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    this.tables[table].push(full);
    return full;
  }
}

class Query implements PromiseLike<Result> {
  private op: Op = "select";
  private filters: Array<[string, unknown]> = [];
  private values?: Row | Row[];
  private patch?: Row;
  private mode: "many" | "single" | "maybe" = "many";
  private returning = false;

  constructor(private db: FakeDb, private table: string) {}

  select(_columns?: string) {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.values = values;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onFulfilled, onRejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every(([c, v]) => row[c] === v);
  }

  private shape(rows: Row[], wrote: boolean): Result {
    if (wrote && !this.returning) return { data: null, error: null };
    const out = rows.map(clone);
    if (this.mode === "many") return { data: out, error: null };
    if (out.length === 1) return { data: out[0], error: null };
    if (this.mode === "maybe" && out.length === 0) return { data: null, error: null };
    return {
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
    };
  }

  private run(): Result {
    const call: Call = { table: this.table, op: this.op, filters: [...this.filters], values: this.values ?? this.patch };
    this.db.calls.push(call);
    const forced = this.db.intercept?.(call);
    if (forced) return forced;

    const rows = this.db.tables[this.table];
    if (this.op === "select") return this.shape(rows.filter((r) => this.matches(r)), false);

    if (this.op === "insert") {
      const list = Array.isArray(this.values) ? this.values : [this.values!];
      const added: Row[] = [];
      for (const v of list) {
        const full = { id: randomUUID(), created_at: new Date().toISOString(), ...clone(v) };
        const clash = (UNIQUE[this.table] ?? []).some((cols) =>
          rows.some((r) => cols.every((c) => r[c] === full[c]))
        );
        if (clash) return { data: null, error: { code: "23505", message: "duplicate key value" } };
        added.push(full);
      }
      rows.push(...added);
      return this.shape(added, true);
    }

    if (this.op === "update") {
      const hit = this.db.lockWrites ? [] : rows.filter((r) => this.matches(r));
      for (const r of hit) Object.assign(r, clone(this.patch));
      return this.shape(hit, true);
    }

    const keep = rows.filter((r) => !this.matches(r));
    this.db.tables[this.table] = keep;
    return this.shape([], true);
  }
}

// ---- fixtures ----

export function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function get(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

export const params = (id: string) => ({ params: { id } });

export interface Seeded {
  game: Row;
  players: Record<string, Row>;
  state: GameState;
}

// A dealt table at `version`, seated like the join route would seat it.
export function seedPlaying(
  db: FakeDb,
  opts: { mode?: "live" | "turn_based"; is2v2?: boolean; version?: number } = {}
): Seeded {
  const is2v2 = opts.is2v2 ?? false;
  const game = db.insertRow("games", {
    invite_code: "ABCDEF",
    mode: opts.mode ?? "live",
    theme: "barberia",
    status: "playing",
    state_version: opts.version ?? 1,
    settings: { targetScore: 100, is2v2 },
    game_state: null,
  });
  const seats = is2v2 ? ["n", "e", "s", "w"] : ["n", "s"];
  const names: Record<string, string> = { n: "Ana", e: "Beto", s: "Caro", w: "Dani" };
  const colors: Record<string, string> = { n: "#6366f1", e: "#ec4899", s: "#f59e0b", w: "#10b981" };
  const players: Record<string, Row> = {};
  for (const seat of seats) {
    players[seat] = db.insertRow("players", {
      game_id: game.id,
      seat,
      nickname: names[seat],
      avatar_color: colors[seat],
    });
  }
  const state = buildStartedState(game as GameRow, Object.values(players) as never);
  game.game_state = state;
  return { game, players, state: clone(state) };
}

// A move the engine accepts for the seat on turn: a matching tile, else a
// draw (1v1 deals leave a boneyard).
export function legalIntent(state: GameState): MoveIntent {
  const hand = state.hands[state.currentTurn];
  const left = state.board[0][0];
  const right = state.board[state.board.length - 1][1];
  for (const tile of hand) {
    if (tile.includes(left)) return { type: "play", tile, end: "left" };
    if (tile.includes(right)) return { type: "play", tile, end: "right" };
  }
  return { type: "draw" };
}
