// =============================================================================
// 1-Million AI Tournament Runner
// =============================================================================
// Runs a Swiss-system chess tournament with configurable AI personas.
// Each AI has unique personality traits (depth, aggression, opening preference).
// Supports A/B testing: half get reward bonuses, half don't.
//
// Usage:
//   cargo run --release --bin tournament -- --players 1000 --rounds 10
//   cargo run --release --bin tournament -- --players 1000000 --rounds 20
// =============================================================================

use chess_engine::movegen::{generate_legal_moves, MoveList};
use chess_engine::position::Position;
use chess_engine::search::search;
use chess_engine::types::Move;

use clap::Parser;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use rand::distributions::WeightedIndex;
use rand::prelude::*;
use rayon::prelude::*;
use rusqlite::{params, Connection};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

// =============================================================================
// CLI ARGUMENTS
// =============================================================================

#[derive(Parser, Debug)]
#[command(name = "tournament", about = "1M AI Chess Tournament Runner")]
struct Args {
    /// Number of AI players
    #[arg(short, long, default_value_t = 1000)]
    players: u32,

    /// Number of Swiss rounds
    #[arg(short, long, default_value_t = 10)]
    rounds: u32,

    /// Output database path
    #[arg(short, long, default_value = "tournament_results.db")]
    output: String,

    /// Random seed for reproducibility
    #[arg(short, long, default_value_t = 42)]
    seed: u64,

    /// Max moves per game before declaring draw
    #[arg(long, default_value_t = 200)]
    max_moves: u32,

    /// Number of threads (0 = all cores)
    #[arg(short, long, default_value_t = 0)]
    threads: usize,
}

// =============================================================================
// AI PERSONA
// =============================================================================

/// Opening preference — which first move the AI favors
#[derive(Debug, Clone, Copy, PartialEq)]
enum OpeningStyle {
    KingPawn,  // 1. e4  (tactical, open games)
    QueenPawn, // 1. d4  (positional, closed games)
    English,   // 1. c4  (flexible, hypermodern)
    Nf3,       // 1. Nf3 (transpositional)
    Random,    // Pick any legal first move
}

impl OpeningStyle {
    fn preferred_first_move(&self) -> &str {
        match self {
            OpeningStyle::KingPawn => "e2e4",
            OpeningStyle::QueenPawn => "d2d4",
            OpeningStyle::English => "c2c4",
            OpeningStyle::Nf3 => "g1f3",
            OpeningStyle::Random => "",
        }
    }

    fn name(&self) -> &str {
        match self {
            OpeningStyle::KingPawn => "King's Pawn",
            OpeningStyle::QueenPawn => "Queen's Pawn",
            OpeningStyle::English => "English",
            OpeningStyle::Nf3 => "Reti",
            OpeningStyle::Random => "Random",
        }
    }
}

/// AI personality traits
#[derive(Debug, Clone)]
struct AiPersona {
    id: u32,
    name: String,
    elo: f64,
    search_depth: u8,
    aggression: f64,
    opening_style: OpeningStyle,
    blunder_rate: f64,
    group: Group,

    // Accumulated stats
    wins: u32,
    losses: u32,
    draws: u32,
    total_moves_played: u64,
    total_game_length: u64,
    games_as_white: u32,
    games_as_black: u32,
    blunders_made: u32,
    points: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Group {
    Control,
    Rewards,
}

// =============================================================================
// NAME GENERATOR
// =============================================================================

const FIRST_NAMES: &[&str] = &[
    "Ada", "Alan", "Alice", "Atlas", "Aurora", "Axel", "Blaze", "Boris", "Cass", "Chess",
    "Clara", "Cosmo", "Cyrus", "Dante", "Echo", "Elara", "Felix", "Freya", "Garry", "Gemma",
    "Hank", "Hugo", "Iris", "Ivan", "Jade", "Juno", "Kai", "Knox", "Luna", "Leo", "Magnus",
    "Mira", "Neo", "Nina", "Odin", "Orion", "Petra", "Quinn", "Rex", "Rook", "Sage", "Sable",
    "Tal", "Titan", "Uma", "Vex", "Wren", "Xena", "Yuki", "Zara", "Ash", "Bishop", "Cleo",
    "Drake", "Eve", "Fang", "Grit", "Hawk", "Ion", "Jinx", "Koda", "Lynx", "Mars", "Nyx",
];

const LAST_NAMES: &[&str] = &[
    "Alpha", "Bitboard", "Castle", "Deepblue", "Endgame", "Fischer", "Gambit", "Hydra",
    "Inverse", "Junior", "Kasparov", "Lambda", "Magnus", "Node", "Omega", "Pawn", "Quasar",
    "Rybka", "Stockfish", "Turbo", "Ultra", "Vector", "Warp", "Xray", "Yankee", "Zenith",
    "Blitz", "Capture", "Diagonal", "Engine", "Fork", "Granite", "Hash", "Iron", "Joker",
    "Knight", "Laser", "Matrix", "Neutron", "Oxide", "Prism", "Quantum", "Razor", "Silicon",
    "Thunder", "Uranium", "Viper", "Wolfram", "Xerxes", "Yggdrasil", "Zephyr", "Anvil",
    "Bronze", "Chrome", "Delta", "Ember", "Flux", "Grid", "Hex", "Ivory", "Jet", "Krypton",
    "Lux", "Mako", "Neon",
];

fn generate_name(rng: &mut impl Rng, id: u32) -> String {
    let first = FIRST_NAMES[rng.gen_range(0..FIRST_NAMES.len())];
    let last = LAST_NAMES[rng.gen_range(0..LAST_NAMES.len())];
    format!("{} {} #{}", first, last, id)
}

// =============================================================================
// PERSONA GENERATOR
// =============================================================================

fn generate_personas(count: u32, seed: u64) -> Vec<AiPersona> {
    let mut rng = StdRng::seed_from_u64(seed);

    let opening_styles = [
        OpeningStyle::KingPawn,
        OpeningStyle::QueenPawn,
        OpeningStyle::English,
        OpeningStyle::Nf3,
        OpeningStyle::Random,
    ];
    let opening_weights = WeightedIndex::new([35, 30, 15, 10, 10]).unwrap();

    (0..count)
        .map(|id| {
            let search_depth = match rng.gen_range(0..100u32) {
                0..=30 => 1,
                31..=65 => 2,
                66..=90 => 3,
                _ => 4,
            };

            let aggression = rng.gen_range(0.1..=1.0_f64);
            let blunder_rate = match search_depth {
                1 => rng.gen_range(0.10..=0.30),
                2 => rng.gen_range(0.05..=0.15),
                3 => rng.gen_range(0.01..=0.08),
                _ => rng.gen_range(0.00..=0.03),
            };

            let group = if id < count / 2 {
                Group::Control
            } else {
                Group::Rewards
            };

            let base_elo = match search_depth {
                1 => 600.0,
                2 => 1000.0,
                3 => 1400.0,
                _ => 1800.0,
            };
            let elo = base_elo + rng.gen_range(-200.0..200.0);

            AiPersona {
                id,
                name: generate_name(&mut rng, id),
                elo,
                search_depth,
                aggression,
                opening_style: opening_styles[opening_weights.sample(&mut rng)],
                blunder_rate,
                group,
                wins: 0,
                losses: 0,
                draws: 0,
                total_moves_played: 0,
                total_game_length: 0,
                games_as_white: 0,
                games_as_black: 0,
                blunders_made: 0,
                points: 0.0,
            }
        })
        .collect()
}

// =============================================================================
// ELO CALCULATION
// =============================================================================

const K_FACTOR: f64 = 32.0;

fn elo_expected(player_elo: f64, opponent_elo: f64) -> f64 {
    1.0 / (1.0 + 10.0_f64.powf((opponent_elo - player_elo) / 400.0))
}

fn elo_update(player_elo: f64, opponent_elo: f64, score: f64) -> f64 {
    let expected = elo_expected(player_elo, opponent_elo);
    player_elo + K_FACTOR * (score - expected)
}

// =============================================================================
// GAME RESULT
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
enum GameResult {
    WhiteWins,
    BlackWins,
    Draw,
}

#[derive(Debug, Clone)]
struct GameRecord {
    round: u32,
    white_id: u32,
    black_id: u32,
    result: GameResult,
    moves: u32,
    opening_uci: String,
    termination: String,
    white_blunders: u32,
    black_blunders: u32,
}

// =============================================================================
// GAME RUNNER
// =============================================================================

fn find_move_by_uci(moves: &MoveList, uci: &str) -> Option<Move> {
    for m in moves.iter() {
        if m.to_uci() == uci {
            return Some(*m);
        }
    }
    None
}

fn choose_move(
    pos: &mut Position,
    legal_moves: &MoveList,
    persona: &AiPersona,
    move_count: u32,
    rng: &mut impl Rng,
) -> Move {
    // Opening book: persona's preferred first move
    if move_count < 2 {
        let pref = persona.opening_style.preferred_first_move();
        if !pref.is_empty() {
            if let Some(m) = find_move_by_uci(legal_moves, pref) {
                return m;
            }
        }
    }

    // Blunder: sometimes pick a random move instead of the best
    if rng.gen::<f64>() < persona.blunder_rate {
        let idx = rng.gen_range(0..legal_moves.len());
        return legal_moves.get(idx);
    }

    // Search for best move
    let (best_move, _score, _stats) = search(pos, persona.search_depth);
    best_move.unwrap_or_else(|| legal_moves.get(0))
}

fn play_game(
    white: &AiPersona,
    black: &AiPersona,
    round: u32,
    max_moves: u32,
    game_seed: u64,
) -> GameRecord {
    let mut rng = StdRng::seed_from_u64(game_seed);
    let mut pos = Position::starting_position();
    let mut move_count = 0u32;
    let mut opening_moves: Vec<String> = Vec::with_capacity(4);
    let mut white_blunders = 0u32;
    let mut black_blunders = 0u32;

    loop {
        if pos.is_checkmate() {
            let result = if move_count % 2 == 0 {
                GameResult::BlackWins
            } else {
                GameResult::WhiteWins
            };
            return GameRecord {
                round,
                white_id: white.id,
                black_id: black.id,
                result,
                moves: move_count,
                opening_uci: opening_moves.join(" "),
                termination: "checkmate".into(),
                white_blunders,
                black_blunders,
            };
        }

        if pos.is_draw() {
            let term = if pos.is_stalemate() {
                "stalemate"
            } else if pos.is_fifty_move_draw() {
                "50-move"
            } else {
                "insufficient"
            };
            return GameRecord {
                round,
                white_id: white.id,
                black_id: black.id,
                result: GameResult::Draw,
                moves: move_count,
                opening_uci: opening_moves.join(" "),
                termination: term.into(),
                white_blunders,
                black_blunders,
            };
        }

        if move_count >= max_moves * 2 {
            return GameRecord {
                round,
                white_id: white.id,
                black_id: black.id,
                result: GameResult::Draw,
                moves: move_count,
                opening_uci: opening_moves.join(" "),
                termination: "max-moves".into(),
                white_blunders,
                black_blunders,
            };
        }

        let current = if move_count % 2 == 0 { white } else { black };

        let legal_moves = generate_legal_moves(&mut pos);
        if legal_moves.is_empty() {
            break;
        }

        let chosen_move = choose_move(&mut pos, &legal_moves, current, move_count, &mut rng);

        if rng.gen::<f64>() < current.blunder_rate && legal_moves.len() > 1 {
            if move_count % 2 == 0 {
                white_blunders += 1;
            } else {
                black_blunders += 1;
            }
        }

        if move_count < 4 {
            opening_moves.push(chosen_move.to_uci());
        }

        pos.make_move(chosen_move);
        move_count += 1;
    }

    GameRecord {
        round,
        white_id: white.id,
        black_id: black.id,
        result: GameResult::Draw,
        moves: move_count,
        opening_uci: opening_moves.join(" "),
        termination: "unknown".into(),
        white_blunders,
        black_blunders,
    }
}

// =============================================================================
// SWISS PAIRING
// =============================================================================

fn swiss_pair(players: &[AiPersona]) -> Vec<(u32, u32)> {
    let mut sorted_indices: Vec<usize> = (0..players.len()).collect();
    sorted_indices.sort_by(|&a, &b| {
        players[b]
            .points
            .partial_cmp(&players[a].points)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                players[b]
                    .elo
                    .partial_cmp(&players[a].elo)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    let mut paired = vec![false; players.len()];
    let mut pairs = Vec::with_capacity(players.len() / 2);

    for i in 0..sorted_indices.len() {
        let idx_a = sorted_indices[i];
        if paired[idx_a] {
            continue;
        }
        for j in (i + 1)..sorted_indices.len() {
            let idx_b = sorted_indices[j];
            if !paired[idx_b] {
                paired[idx_a] = true;
                paired[idx_b] = true;
                pairs.push((players[idx_a].id, players[idx_b].id));
                break;
            }
        }
    }

    pairs
}

// =============================================================================
// DATABASE
// =============================================================================

fn init_database(path: &str) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -64000;

        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            initial_elo REAL NOT NULL,
            final_elo REAL NOT NULL,
            search_depth INTEGER NOT NULL,
            aggression REAL NOT NULL,
            opening_style TEXT NOT NULL,
            blunder_rate REAL NOT NULL,
            test_group TEXT NOT NULL,
            wins INTEGER NOT NULL DEFAULT 0,
            losses INTEGER NOT NULL DEFAULT 0,
            draws INTEGER NOT NULL DEFAULT 0,
            total_moves_played INTEGER NOT NULL DEFAULT 0,
            avg_game_length REAL NOT NULL DEFAULT 0,
            games_as_white INTEGER NOT NULL DEFAULT 0,
            games_as_black INTEGER NOT NULL DEFAULT 0,
            blunders_made INTEGER NOT NULL DEFAULT 0,
            points REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round INTEGER NOT NULL,
            white_id INTEGER NOT NULL,
            black_id INTEGER NOT NULL,
            result TEXT NOT NULL,
            moves INTEGER NOT NULL,
            opening_uci TEXT,
            termination TEXT NOT NULL,
            white_blunders INTEGER NOT NULL DEFAULT 0,
            black_blunders INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (white_id) REFERENCES players(id),
            FOREIGN KEY (black_id) REFERENCES players(id)
        );

        CREATE TABLE IF NOT EXISTS tournament_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_games_round ON games(round);
        CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id);
        CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id);
        CREATE INDEX IF NOT EXISTS idx_players_group ON players(test_group);
        CREATE INDEX IF NOT EXISTS idx_players_elo ON players(final_elo);
    ",
    )?;

    Ok(conn)
}

fn save_players(conn: &Connection, players: &[AiPersona]) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "INSERT OR REPLACE INTO players
        (id, name, initial_elo, final_elo, search_depth, aggression,
         opening_style, blunder_rate, test_group, wins, losses, draws,
         total_moves_played, avg_game_length, games_as_white, games_as_black,
         blunders_made, points)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
    )?;

    for p in players {
        let games_total = p.wins + p.losses + p.draws;
        let avg_len = if games_total > 0 {
            p.total_game_length as f64 / games_total as f64
        } else {
            0.0
        };
        let group_name = match p.group {
            Group::Control => "control",
            Group::Rewards => "rewards",
        };
        stmt.execute(params![
            p.id, p.name, p.elo, p.elo, p.search_depth, p.aggression,
            p.opening_style.name(), p.blunder_rate, group_name,
            p.wins, p.losses, p.draws, p.total_moves_played, avg_len,
            p.games_as_white, p.games_as_black, p.blunders_made, p.points,
        ])?;
    }

    Ok(())
}

fn save_games_batch(conn: &Connection, games: &[GameRecord]) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "INSERT INTO games (round, white_id, black_id, result, moves,
                          opening_uci, termination, white_blunders, black_blunders)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
    )?;

    for g in games {
        let result_str = match g.result {
            GameResult::WhiteWins => "1-0",
            GameResult::BlackWins => "0-1",
            GameResult::Draw => "1/2-1/2",
        };
        stmt.execute(params![
            g.round, g.white_id, g.black_id, result_str, g.moves,
            g.opening_uci, g.termination, g.white_blunders, g.black_blunders,
        ])?;
    }

    Ok(())
}

// =============================================================================
// MAIN
// =============================================================================

fn main() {
    let args = Args::parse();

    println!("======================================================");
    println!("  1-MILLION AI CHESS TOURNAMENT");
    println!("  Swiss System | Parallel Execution | A/B Testing");
    println!("======================================================");
    println!();

    if args.threads > 0 {
        rayon::ThreadPoolBuilder::new()
            .num_threads(args.threads)
            .build_global()
            .unwrap();
    }

    let num_threads = rayon::current_num_threads();
    println!("Configuration:");
    println!("   Players:     {:>10}", format_number(args.players));
    println!("   Rounds:      {:>10}", args.rounds);
    println!("   Threads:     {:>10}", num_threads);
    println!("   Max moves:   {:>10}", args.max_moves);
    println!("   Seed:        {:>10}", args.seed);
    println!("   Output:      {}", args.output);
    println!();

    // Phase 1: Generate personas
    let timer = Instant::now();
    print!("Generating {} AI personas... ", format_number(args.players));
    let mut players = generate_personas(args.players, args.seed);
    println!("done ({:.1}ms)", timer.elapsed().as_secs_f64() * 1000.0);

    let control_count = players.iter().filter(|p| p.group == Group::Control).count();
    let rewards_count = players.iter().filter(|p| p.group == Group::Rewards).count();
    println!("   Group A (Control):  {}", format_number(control_count as u32));
    println!("   Group B (Rewards):  {}", format_number(rewards_count as u32));
    println!();

    // Phase 2: Initialize database
    let conn = init_database(&args.output).expect("Failed to create database");
    conn.execute(
        "INSERT OR REPLACE INTO tournament_meta (key, value) VALUES ('players', ?1)",
        params![args.players.to_string()],
    ).unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO tournament_meta (key, value) VALUES ('rounds', ?1)",
        params![args.rounds.to_string()],
    ).unwrap();

    // Phase 3: Run tournament rounds
    let multi = MultiProgress::new();
    let total_timer = Instant::now();
    let games_played = AtomicU64::new(0);
    let total_moves = AtomicU64::new(0);

    for round in 1..=args.rounds {
        let round_timer = Instant::now();
        let pairs = swiss_pair(&players);
        let num_games = pairs.len();

        let pb = multi.add(ProgressBar::new(num_games as u64));
        pb.set_style(
            ProgressStyle::with_template(
                "   Round {msg} [{bar:40.cyan/blue}] {pos}/{len} ({per_sec} g/s, ETA {eta})",
            )
            .unwrap()
            .progress_chars("##-"),
        );
        pb.set_message(format!("{}/{}", round, args.rounds));

        let results: Vec<GameRecord> = pairs
            .par_iter()
            .map(|&(white_id, black_id)| {
                let white = &players[white_id as usize];
                let black = &players[black_id as usize];
                let game_seed = args.seed
                    .wrapping_mul(round as u64)
                    .wrapping_add(white_id as u64 * 1_000_000 + black_id as u64);
                let record = play_game(white, black, round, args.max_moves, game_seed);
                pb.inc(1);
                games_played.fetch_add(1, Ordering::Relaxed);
                total_moves.fetch_add(record.moves as u64, Ordering::Relaxed);
                record
            })
            .collect();

        pb.finish();

        for record in &results {
            let w = record.white_id as usize;
            let b = record.black_id as usize;

            players[w].games_as_white += 1;
            players[w].total_moves_played += record.moves as u64;
            players[w].total_game_length += record.moves as u64;
            players[w].blunders_made += record.white_blunders;

            players[b].games_as_black += 1;
            players[b].total_moves_played += record.moves as u64;
            players[b].total_game_length += record.moves as u64;
            players[b].blunders_made += record.black_blunders;

            match record.result {
                GameResult::WhiteWins => {
                    let nw = elo_update(players[w].elo, players[b].elo, 1.0);
                    let nb = elo_update(players[b].elo, players[w].elo, 0.0);
                    players[w].elo = nw;
                    players[w].wins += 1;
                    players[w].points += 1.0;
                    players[b].elo = nb;
                    players[b].losses += 1;
                }
                GameResult::BlackWins => {
                    let nw = elo_update(players[w].elo, players[b].elo, 0.0);
                    let nb = elo_update(players[b].elo, players[w].elo, 1.0);
                    players[w].elo = nw;
                    players[w].losses += 1;
                    players[b].elo = nb;
                    players[b].wins += 1;
                    players[b].points += 1.0;
                }
                GameResult::Draw => {
                    let nw = elo_update(players[w].elo, players[b].elo, 0.5);
                    let nb = elo_update(players[b].elo, players[w].elo, 0.5);
                    players[w].elo = nw;
                    players[b].elo = nb;
                    players[w].draws += 1;
                    players[b].draws += 1;
                    players[w].points += 0.5;
                    players[b].points += 0.5;
                }
            }
        }

        save_games_batch(&conn, &results).expect("Failed to save games");

        let round_secs = round_timer.elapsed().as_secs_f64();
        let gps = num_games as f64 / round_secs;
        println!(
            "   Round {}/{}: {} games in {:.1}s ({:.0} games/s)",
            round, args.rounds, format_number(num_games as u32), round_secs, gps,
        );
    }

    // Phase 4: Save final data
    save_players(&conn, &players).expect("Failed to save players");

    let total_secs = total_timer.elapsed().as_secs_f64();
    let total_games_val = games_played.load(Ordering::Relaxed);
    let total_moves_val = total_moves.load(Ordering::Relaxed);

    println!();
    println!("======================================================");
    println!("  TOURNAMENT COMPLETE");
    println!("======================================================");
    println!();
    println!("   Total games:     {:>12}", format_number(total_games_val as u32));
    println!("   Total moves:     {:>12}", format_number(total_moves_val as u32));
    println!("   Total time:      {:>10.1}s", total_secs);
    println!("   Avg games/sec:   {:>10.0}", total_games_val as f64 / total_secs);
    println!("   Avg moves/game:  {:>10.1}", total_moves_val as f64 / total_games_val.max(1) as f64);
    println!();

    // Top 10 leaderboard
    let mut sorted: Vec<&AiPersona> = players.iter().collect();
    sorted.sort_by(|a, b| {
        b.points.partial_cmp(&a.points).unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.elo.partial_cmp(&a.elo).unwrap_or(std::cmp::Ordering::Equal))
    });

    println!("  TOP 10 LEADERBOARD");
    println!("  {:<4} {:<30} {:>7} {:>6} {:>16}", "Rank", "Name", "ELO", "Pts", "W / D / L");
    println!("  {}", "-".repeat(70));
    for (i, p) in sorted.iter().take(10).enumerate() {
        let tag = if p.group == Group::Rewards { "[B]" } else { "[A]" };
        println!(
            "  {:<4} {:<26} {} {:>7.0} {:>6.1} {:>4}/{:>4}/{:>4}",
            i + 1, p.name, tag, p.elo, p.points, p.wins, p.draws, p.losses,
        );
    }
    println!();

    // A/B comparison
    let control: Vec<&AiPersona> = players.iter().filter(|p| p.group == Group::Control).collect();
    let rewards: Vec<&AiPersona> = players.iter().filter(|p| p.group == Group::Rewards).collect();

    let avg = |group: &[&AiPersona], f: fn(&&AiPersona) -> f64| -> f64 {
        if group.is_empty() { return 0.0; }
        group.iter().map(f).sum::<f64>() / group.len() as f64
    };

    let ctrl_elo = avg(&control, |p| p.elo);
    let rwrd_elo = avg(&rewards, |p| p.elo);
    let ctrl_wr = avg(&control, |p| {
        let t = (p.wins + p.losses + p.draws) as f64;
        if t > 0.0 { p.wins as f64 / t } else { 0.0 }
    });
    let rwrd_wr = avg(&rewards, |p| {
        let t = (p.wins + p.losses + p.draws) as f64;
        if t > 0.0 { p.wins as f64 / t } else { 0.0 }
    });
    let ctrl_len = avg(&control, |p| {
        let t = (p.wins + p.losses + p.draws) as f64;
        if t > 0.0 { p.total_game_length as f64 / t } else { 0.0 }
    });
    let rwrd_len = avg(&rewards, |p| {
        let t = (p.wins + p.losses + p.draws) as f64;
        if t > 0.0 { p.total_game_length as f64 / t } else { 0.0 }
    });
    let ctrl_bl = avg(&control, |p| p.blunders_made as f64);
    let rwrd_bl = avg(&rewards, |p| p.blunders_made as f64);

    println!("  A/B TEST RESULTS");
    println!("  {:<22} {:>12} {:>12} {:>8}", "Metric", "Control(A)", "Rewards(B)", "Delta");
    println!("  {}", "-".repeat(58));
    println!("  {:<22} {:>12.1} {:>12.1} {:>+8.1}", "Avg ELO", ctrl_elo, rwrd_elo, rwrd_elo - ctrl_elo);
    println!("  {:<22} {:>11.1}% {:>11.1}% {:>+7.1}%", "Win Rate", ctrl_wr * 100.0, rwrd_wr * 100.0, (rwrd_wr - ctrl_wr) * 100.0);
    println!("  {:<22} {:>12.1} {:>12.1} {:>+8.1}", "Avg Game Length", ctrl_len, rwrd_len, rwrd_len - ctrl_len);
    println!("  {:<22} {:>12.2} {:>12.2} {:>+8.2}", "Avg Blunders", ctrl_bl, rwrd_bl, rwrd_bl - ctrl_bl);
    println!();
    println!("  Results saved to: {}", args.output);
    println!();
}

// =============================================================================
// HELPERS
// =============================================================================

fn format_number(n: u32) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(c);
    }
    result.chars().rev().collect()
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(0), "0");
        assert_eq!(format_number(999), "999");
        assert_eq!(format_number(1000), "1,000");
        assert_eq!(format_number(1000000), "1,000,000");
    }

    #[test]
    fn test_elo_calculation() {
        let e = elo_expected(1200.0, 1200.0);
        assert!((e - 0.5).abs() < 0.001);
        assert!(elo_update(1200.0, 1200.0, 1.0) > 1200.0);
        assert!(elo_update(1200.0, 1200.0, 0.0) < 1200.0);
    }

    #[test]
    fn test_generate_personas() {
        let personas = generate_personas(100, 42);
        assert_eq!(personas.len(), 100);
        let control = personas.iter().filter(|p| p.group == Group::Control).count();
        assert_eq!(control, 50);
        for p in &personas {
            assert!(!p.name.is_empty());
            assert!(p.search_depth >= 1 && p.search_depth <= 4);
        }
    }

    #[test]
    fn test_swiss_pairing() {
        let personas = generate_personas(10, 42);
        let pairs = swiss_pair(&personas);
        assert_eq!(pairs.len(), 5);
    }

    #[test]
    fn test_play_game_completes() {
        let personas = generate_personas(2, 42);
        let record = play_game(&personas[0], &personas[1], 1, 50, 123);
        assert!(record.moves > 0 || record.termination == "max-moves");
    }
}
