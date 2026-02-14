-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "white_id" TEXT NOT NULL,
    "black_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "pgn" TEXT,
    "fen" TEXT,
    "moves" INTEGER NOT NULL DEFAULT 0,
    "time_control" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "games_white_id_fkey" FOREIGN KEY ("white_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "games_black_id_fkey" FOREIGN KEY ("black_id") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");

-- CreateIndex
CREATE INDEX "games_white_id_idx" ON "games"("white_id");

-- CreateIndex
CREATE INDEX "games_black_id_idx" ON "games"("black_id");

-- CreateIndex
CREATE INDEX "games_created_at_idx" ON "games"("created_at");
