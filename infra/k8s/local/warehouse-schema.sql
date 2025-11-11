-- Warehouse schema converted from ClickHouse to Postgres
-- Compatible with both Postgres and Trino

-- Table: daily_token_balances
CREATE TABLE IF NOT EXISTS daily_token_balances (
    slot BIGINT,
    ts TIMESTAMP,
    day VARCHAR(20),
    token_account VARCHAR(100),
    owner VARCHAR(100),
    token_mint VARCHAR(100),
    balance DECIMAL(38, 18),
    decimals SMALLINT,
    balance_calculated DOUBLE PRECISION,
    token_ticker VARCHAR(50),
    token_description TEXT,
    rate_to_usdc DOUBLE PRECISION,
    balance_in_usdc DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_daily_token_balances_ts_account
    ON daily_token_balances(ts, token_account);
CREATE INDEX IF NOT EXISTS idx_daily_token_balances_day
    ON daily_token_balances(day);

-- Sample data for daily_token_balances (10 rows)
INSERT INTO daily_token_balances VALUES
(100001, '2024-01-15 10:00:00', '2024-01-15', 'TokenAcc1', 'Owner1', 'MintSOL', 1000.50, 9, 1000.50, 'SOL', 'Solana', 95.50, 95525.25),
(100002, '2024-01-15 11:00:00', '2024-01-15', 'TokenAcc2', 'Owner2', 'MintUSDC', 5000.00, 6, 5000.00, 'USDC', 'USD Coin', 1.00, 5000.00),
(100003, '2024-01-15 12:00:00', '2024-01-15', 'TokenAcc3', 'Owner1', 'MintMOBILE', 25000.00, 9, 25000.00, 'MOBILE', 'Helium Mobile', 0.0015, 37.50),
(100004, '2024-01-16 09:00:00', '2024-01-16', 'TokenAcc1', 'Owner1', 'MintSOL', 1050.75, 9, 1050.75, 'SOL', 'Solana', 96.20, 101082.15),
(100005, '2024-01-16 10:00:00', '2024-01-16', 'TokenAcc4', 'Owner3', 'MintUSDC', 10000.00, 6, 10000.00, 'USDC', 'USD Coin', 1.00, 10000.00),
(100006, '2024-01-16 11:00:00', '2024-01-16', 'TokenAcc5', 'Owner4', 'MintJUP', 5000.00, 6, 5000.00, 'JUP', 'Jupiter', 0.85, 4250.00),
(100007, '2024-01-17 08:00:00', '2024-01-17', 'TokenAcc2', 'Owner2', 'MintUSDC', 5500.00, 6, 5500.00, 'USDC', 'USD Coin', 1.00, 5500.00),
(100008, '2024-01-17 09:00:00', '2024-01-17', 'TokenAcc6', 'Owner5', 'MintRAY', 2000.00, 6, 2000.00, 'RAY', 'Raydium', 1.25, 2500.00),
(100009, '2024-01-17 10:00:00', '2024-01-17', 'TokenAcc3', 'Owner1', 'MintMOBILE', 30000.00, 9, 30000.00, 'MOBILE', 'Helium Mobile', 0.0016, 48.00),
(100010, '2024-01-17 11:00:00', '2024-01-17', 'TokenAcc7', 'Owner6', 'MintBONK', 1000000.00, 5, 1000000.00, 'BONK', 'Bonk', 0.00002, 20.00);

-- Table: enriched_trades
CREATE TABLE IF NOT EXISTS enriched_trades (
    slot BIGINT NOT NULL,
    ts TIMESTAMP NOT NULL,
    signature VARCHAR(100) NOT NULL,
    index_in_block INTEGER NOT NULL,
    dex_order_in_tx BIGINT NOT NULL,
    side VARCHAR(10),
    signers TEXT[],
    program_id VARCHAR(100),
    dex VARCHAR(100),
    dex_name VARCHAR(100),
    source_mint VARCHAR(100),
    destination_mint VARCHAR(100),
    source_amount DECIMAL(38, 18),
    destination_amount DECIMAL(38, 18),
    source_account VARCHAR(100),
    destination_account VARCHAR(100),
    source_account_owner VARCHAR(100) NOT NULL,
    destination_account_owner VARCHAR(100) NOT NULL,
    source_decimals SMALLINT,
    destination_decimals SMALLINT,
    source_calculated_amount DOUBLE PRECISION,
    destination_calculated_amount DOUBLE PRECISION,
    destination_ticker_verified BOOLEAN,
    destination_ticker VARCHAR(50),
    destination_ticker_description TEXT,
    source_ticker VARCHAR(50),
    source_ticker_verified BOOLEAN,
    source_ticker_description TEXT,
    destination_rate_to_udc DOUBLE PRECISION,
    source_rate_to_udc DOUBLE PRECISION,
    source_calculated_amount_in_usdc DOUBLE PRECISION,
    destination_calculated_amount_in_usdc DOUBLE PRECISION,
    day VARCHAR(20),
    cost_basis_usd DOUBLE PRECISION NOT NULL,
    profit_usd DOUBLE PRECISION NOT NULL,
    profit_pct DOUBLE PRECISION NOT NULL,
    epoch_id BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enriched_trades_slot_sig
    ON enriched_trades(slot, signature, index_in_block);
CREATE INDEX IF NOT EXISTS idx_enriched_trades_ts
    ON enriched_trades(ts);
CREATE INDEX IF NOT EXISTS idx_enriched_trades_owners
    ON enriched_trades(source_account_owner, destination_account_owner);

-- Sample data for enriched_trades (10 rows)
INSERT INTO enriched_trades VALUES
(200001, '2024-01-15 10:05:00', 'Sig1ABC', 1, 1, 'buy', ARRAY['Signer1'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintUSDC', 'MintSOL', 100.00, 1.05, 'SrcAcc1', 'DstAcc1', 'Owner1', 'Owner2', 6, 9, 100.00, 1.05, true, 'SOL', 'Solana', 'USDC', true, 'USD Coin', 95.50, 1.00, 100.00, 100.28, '2024-01-15', 100.00, 0.28, 0.28, 1001),
(200002, '2024-01-15 10:10:00', 'Sig2DEF', 1, 1, 'sell', ARRAY['Signer2'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintSOL', 'MintUSDC', 2.00, 190.00, 'SrcAcc2', 'DstAcc2', 'Owner2', 'Owner3', 9, 6, 2.00, 190.00, true, 'USDC', 'USD Coin', 'SOL', true, 'Solana', 1.00, 95.50, 191.00, 190.00, '2024-01-15', 191.00, -1.00, -0.52, 1002),
(200003, '2024-01-15 11:00:00', 'Sig3GHI', 1, 1, 'buy', ARRAY['Signer3'], 'ProgDEX2', 'OrcaDEX', 'Orca', 'MintUSDC', 'MintMOBILE', 50.00, 33333.33, 'SrcAcc3', 'DstAcc3', 'Owner3', 'Owner4', 6, 9, 50.00, 33333.33, true, 'MOBILE', 'Helium Mobile', 'USDC', true, 'USD Coin', 0.0015, 1.00, 50.00, 50.00, '2024-01-15', 50.00, 0.00, 0.00, 1003),
(200004, '2024-01-16 09:30:00', 'Sig4JKL', 1, 1, 'buy', ARRAY['Signer1'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintUSDC', 'MintJUP', 200.00, 235.29, 'SrcAcc1', 'DstAcc4', 'Owner1', 'Owner5', 6, 6, 200.00, 235.29, true, 'JUP', 'Jupiter', 'USDC', true, 'USD Coin', 0.85, 1.00, 200.00, 200.00, '2024-01-16', 200.00, 0.00, 0.00, 1004),
(200005, '2024-01-16 10:00:00', 'Sig5MNO', 1, 1, 'sell', ARRAY['Signer4'], 'ProgDEX2', 'OrcaDEX', 'Orca', 'MintJUP', 'MintUSDC', 100.00, 85.00, 'SrcAcc5', 'DstAcc5', 'Owner5', 'Owner6', 6, 6, 100.00, 85.00, true, 'USDC', 'USD Coin', 'JUP', true, 'Jupiter', 1.00, 0.85, 85.00, 85.00, '2024-01-16', 85.00, 0.00, 0.00, 1005),
(200006, '2024-01-16 11:30:00', 'Sig6PQR', 1, 1, 'buy', ARRAY['Signer5'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintUSDC', 'MintRAY', 150.00, 120.00, 'SrcAcc6', 'DstAcc6', 'Owner6', 'Owner1', 6, 6, 150.00, 120.00, true, 'RAY', 'Raydium', 'USDC', true, 'USD Coin', 1.25, 1.00, 150.00, 150.00, '2024-01-16', 150.00, 0.00, 0.00, 1006),
(200007, '2024-01-17 08:15:00', 'Sig7STU', 1, 1, 'sell', ARRAY['Signer6'], 'ProgDEX2', 'OrcaDEX', 'Orca', 'MintMOBILE', 'MintUSDC', 10000.00, 15.00, 'SrcAcc7', 'DstAcc7', 'Owner1', 'Owner2', 9, 6, 10000.00, 15.00, true, 'USDC', 'USD Coin', 'MOBILE', true, 'Helium Mobile', 1.00, 0.0015, 15.00, 15.00, '2024-01-17', 15.00, 0.00, 0.00, 1007),
(200008, '2024-01-17 09:00:00', 'Sig8VWX', 1, 1, 'buy', ARRAY['Signer2'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintUSDC', 'MintBONK', 20.00, 1000000.00, 'SrcAcc8', 'DstAcc8', 'Owner2', 'Owner3', 6, 5, 20.00, 1000000.00, true, 'BONK', 'Bonk', 'USDC', true, 'USD Coin', 0.00002, 1.00, 20.00, 20.00, '2024-01-17', 20.00, 0.00, 0.00, 1008),
(200009, '2024-01-17 10:30:00', 'Sig9YZA', 1, 1, 'buy', ARRAY['Signer3'], 'ProgDEX2', 'OrcaDEX', 'Orca', 'MintUSDC', 'MintSOL', 300.00, 3.12, 'SrcAcc9', 'DstAcc9', 'Owner3', 'Owner4', 6, 9, 300.00, 3.12, true, 'SOL', 'Solana', 'USDC', true, 'USD Coin', 96.20, 1.00, 300.00, 300.14, '2024-01-17', 300.00, 0.14, 0.05, 1009),
(200010, '2024-01-17 11:00:00', 'Sig10BCD', 1, 1, 'sell', ARRAY['Signer7'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 'MintRAY', 'MintUSDC', 50.00, 62.50, 'SrcAcc10', 'DstAcc10', 'Owner4', 'Owner5', 6, 6, 50.00, 62.50, true, 'USDC', 'USD Coin', 'RAY', true, 'Raydium', 1.00, 1.25, 62.50, 62.50, '2024-01-17', 62.50, 0.00, 0.00, 1010);

-- Table: token_balance
CREATE TABLE IF NOT EXISTS token_balance (
    slot BIGINT NOT NULL,
    ts TIMESTAMP NOT NULL,
    signature VARCHAR(100),
    index_in_block INTEGER,
    token_account VARCHAR(100),
    owner VARCHAR(100) NOT NULL,
    token_mint VARCHAR(100) NOT NULL,
    program_id VARCHAR(100),
    pre_balance DECIMAL(38, 18),
    post_balance DECIMAL(38, 18),
    decimals SMALLINT,
    pre_balance_calculated DOUBLE PRECISION,
    post_balance_calculated DOUBLE PRECISION,
    change DECIMAL(38, 18),
    change_calculated DOUBLE PRECISION,
    token_ticker VARCHAR(50),
    token_description TEXT,
    ticker_verified BOOLEAN,
    is_snapshot BOOLEAN,
    synthetic_index INTEGER NOT NULL,
    rate_to_usdc DOUBLE PRECISION,
    pre_balance_in_usdc DOUBLE PRECISION,
    post_balance_in_usdc DOUBLE PRECISION,
    change_in_usdc DOUBLE PRECISION,
    day VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_token_balance_mint_ts
    ON token_balance(token_mint, ts, synthetic_index);
CREATE INDEX IF NOT EXISTS idx_token_balance_owner
    ON token_balance(owner);

-- Sample data for token_balance (10 rows)
INSERT INTO token_balance VALUES
(300001, '2024-01-15 10:05:00', 'Sig1ABC', 1, 'TokenAcc1', 'Owner1', 'MintSOL', 'ProgSPL', 1000.00, 1001.05, 9, 1000.00, 1001.05, 1.05, 1.05, 'SOL', 'Solana', true, false, 1, 95.50, 95500.00, 95600.28, 100.28, '2024-01-15'),
(300002, '2024-01-15 10:10:00', 'Sig2DEF', 1, 'TokenAcc2', 'Owner2', 'MintUSDC', 'ProgSPL', 200.00, 100.00, 6, 200.00, 100.00, -100.00, -100.00, 'USDC', 'USD Coin', true, false, 1, 1.00, 200.00, 100.00, -100.00, '2024-01-15'),
(300003, '2024-01-15 11:00:00', 'Sig3GHI', 1, 'TokenAcc3', 'Owner3', 'MintMOBILE', 'ProgSPL', 0.00, 33333.33, 9, 0.00, 33333.33, 33333.33, 33333.33, 'MOBILE', 'Helium Mobile', true, false, 1, 0.0015, 0.00, 50.00, 50.00, '2024-01-15'),
(300004, '2024-01-16 09:30:00', 'Sig4JKL', 1, 'TokenAcc4', 'Owner1', 'MintJUP', 'ProgSPL', 0.00, 235.29, 6, 0.00, 235.29, 235.29, 235.29, 'JUP', 'Jupiter', true, false, 1, 0.85, 0.00, 200.00, 200.00, '2024-01-16'),
(300005, '2024-01-16 10:00:00', 'Sig5MNO', 1, 'TokenAcc5', 'Owner5', 'MintJUP', 'ProgSPL', 200.00, 100.00, 6, 200.00, 100.00, -100.00, -100.00, 'JUP', 'Jupiter', true, false, 1, 0.85, 170.00, 85.00, -85.00, '2024-01-16'),
(300006, '2024-01-16 11:30:00', 'Sig6PQR', 1, 'TokenAcc6', 'Owner6', 'MintRAY', 'ProgSPL', 0.00, 120.00, 6, 0.00, 120.00, 120.00, 120.00, 'RAY', 'Raydium', true, false, 1, 1.25, 0.00, 150.00, 150.00, '2024-01-16'),
(300007, '2024-01-17 08:15:00', 'Sig7STU', 1, 'TokenAcc3', 'Owner1', 'MintMOBILE', 'ProgSPL', 33333.33, 23333.33, 9, 33333.33, 23333.33, -10000.00, -10000.00, 'MOBILE', 'Helium Mobile', true, false, 1, 0.0016, 53.33, 37.33, -16.00, '2024-01-17'),
(300008, '2024-01-17 09:00:00', 'Sig8VWX', 1, 'TokenAcc7', 'Owner2', 'MintBONK', 'ProgSPL', 0.00, 1000000.00, 5, 0.00, 1000000.00, 1000000.00, 1000000.00, 'BONK', 'Bonk', true, false, 1, 0.00002, 0.00, 20.00, 20.00, '2024-01-17'),
(300009, '2024-01-17 10:30:00', 'Sig9YZA', 1, 'TokenAcc1', 'Owner3', 'MintSOL', 'ProgSPL', 0.00, 3.12, 9, 0.00, 3.12, 3.12, 3.12, 'SOL', 'Solana', true, false, 1, 96.20, 0.00, 300.14, 300.14, '2024-01-17'),
(300010, '2024-01-17 11:00:00', 'Sig10BCD', 1, 'TokenAcc6', 'Owner4', 'MintRAY', 'ProgSPL', 120.00, 70.00, 6, 120.00, 70.00, -50.00, -50.00, 'RAY', 'Raydium', true, false, 1, 1.25, 150.00, 87.50, -62.50, '2024-01-17');

-- Table: trades
CREATE TABLE IF NOT EXISTS trades (
    slot BIGINT NOT NULL,
    ts TIMESTAMP NOT NULL,
    signature VARCHAR(100),
    index_in_block INTEGER,
    signers TEXT[],
    program_id VARCHAR(100),
    dex VARCHAR(100),
    dex_name VARCHAR(100),
    dex_order_in_tx BIGINT,
    source_mint VARCHAR(100),
    destination_mint VARCHAR(100),
    source_amount DECIMAL(38, 18),
    destination_amount DECIMAL(38, 18),
    source_account VARCHAR(100),
    destination_account VARCHAR(100),
    source_account_owner VARCHAR(100) NOT NULL,
    destination_account_owner VARCHAR(100) NOT NULL,
    source_decimals SMALLINT,
    destination_decimals SMALLINT,
    source_calculated_amount DOUBLE PRECISION,
    destination_calculated_amount DOUBLE PRECISION,
    destination_ticker_verified BOOLEAN,
    destination_ticker VARCHAR(50),
    destination_ticker_description TEXT,
    source_ticker VARCHAR(50),
    source_ticker_verified BOOLEAN,
    source_ticker_description TEXT,
    destination_rate_to_udc DOUBLE PRECISION,
    source_rate_to_udc DOUBLE PRECISION,
    source_calculated_amount_in_usdc DOUBLE PRECISION,
    destination_calculated_amount_in_usdc DOUBLE PRECISION,
    day VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_trades_owners_ts
    ON trades(source_account_owner, destination_account_owner, ts);
CREATE INDEX IF NOT EXISTS idx_trades_ts
    ON trades(ts);

-- Sample data for trades (10 rows) - mirrors enriched_trades
INSERT INTO trades VALUES
(200001, '2024-01-15 10:05:00', 'Sig1ABC', 1, ARRAY['Signer1'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintUSDC', 'MintSOL', 100.00, 1.05, 'SrcAcc1', 'DstAcc1', 'Owner1', 'Owner2', 6, 9, 100.00, 1.05, true, 'SOL', 'Solana', 'USDC', true, 'USD Coin', 95.50, 1.00, 100.00, 100.28, '2024-01-15'),
(200002, '2024-01-15 10:10:00', 'Sig2DEF', 1, ARRAY['Signer2'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintSOL', 'MintUSDC', 2.00, 190.00, 'SrcAcc2', 'DstAcc2', 'Owner2', 'Owner3', 9, 6, 2.00, 190.00, true, 'USDC', 'USD Coin', 'SOL', true, 'Solana', 1.00, 95.50, 191.00, 190.00, '2024-01-15'),
(200003, '2024-01-15 11:00:00', 'Sig3GHI', 1, ARRAY['Signer3'], 'ProgDEX2', 'OrcaDEX', 'Orca', 1, 'MintUSDC', 'MintMOBILE', 50.00, 33333.33, 'SrcAcc3', 'DstAcc3', 'Owner3', 'Owner4', 6, 9, 50.00, 33333.33, true, 'MOBILE', 'Helium Mobile', 'USDC', true, 'USD Coin', 0.0015, 1.00, 50.00, 50.00, '2024-01-15'),
(200004, '2024-01-16 09:30:00', 'Sig4JKL', 1, ARRAY['Signer1'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintUSDC', 'MintJUP', 200.00, 235.29, 'SrcAcc1', 'DstAcc4', 'Owner1', 'Owner5', 6, 6, 200.00, 235.29, true, 'JUP', 'Jupiter', 'USDC', true, 'USD Coin', 0.85, 1.00, 200.00, 200.00, '2024-01-16'),
(200005, '2024-01-16 10:00:00', 'Sig5MNO', 1, ARRAY['Signer4'], 'ProgDEX2', 'OrcaDEX', 'Orca', 1, 'MintJUP', 'MintUSDC', 100.00, 85.00, 'SrcAcc5', 'DstAcc5', 'Owner5', 'Owner6', 6, 6, 100.00, 85.00, true, 'USDC', 'USD Coin', 'JUP', true, 'Jupiter', 1.00, 0.85, 85.00, 85.00, '2024-01-16'),
(200006, '2024-01-16 11:30:00', 'Sig6PQR', 1, ARRAY['Signer5'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintUSDC', 'MintRAY', 150.00, 120.00, 'SrcAcc6', 'DstAcc6', 'Owner6', 'Owner1', 6, 6, 150.00, 120.00, true, 'RAY', 'Raydium', 'USDC', true, 'USD Coin', 1.25, 1.00, 150.00, 150.00, '2024-01-16'),
(200007, '2024-01-17 08:15:00', 'Sig7STU', 1, ARRAY['Signer6'], 'ProgDEX2', 'OrcaDEX', 'Orca', 1, 'MintMOBILE', 'MintUSDC', 10000.00, 15.00, 'SrcAcc7', 'DstAcc7', 'Owner1', 'Owner2', 9, 6, 10000.00, 15.00, true, 'USDC', 'USD Coin', 'MOBILE', true, 'Helium Mobile', 1.00, 0.0015, 15.00, 15.00, '2024-01-17'),
(200008, '2024-01-17 09:00:00', 'Sig8VWX', 1, ARRAY['Signer2'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintUSDC', 'MintBONK', 20.00, 1000000.00, 'SrcAcc8', 'DstAcc8', 'Owner2', 'Owner3', 6, 5, 20.00, 1000000.00, true, 'BONK', 'Bonk', 'USDC', true, 'USD Coin', 0.00002, 1.00, 20.00, 20.00, '2024-01-17'),
(200009, '2024-01-17 10:30:00', 'Sig9YZA', 1, ARRAY['Signer3'], 'ProgDEX2', 'OrcaDEX', 'Orca', 1, 'MintUSDC', 'MintSOL', 300.00, 3.12, 'SrcAcc9', 'DstAcc9', 'Owner3', 'Owner4', 6, 9, 300.00, 3.12, true, 'SOL', 'Solana', 'USDC', true, 'USD Coin', 96.20, 1.00, 300.00, 300.14, '2024-01-17'),
(200010, '2024-01-17 11:00:00', 'Sig10BCD', 1, ARRAY['Signer7'], 'ProgDEX1', 'RaydiumDEX', 'Raydium', 1, 'MintRAY', 'MintUSDC', 50.00, 62.50, 'SrcAcc10', 'DstAcc10', 'Owner4', 'Owner5', 6, 6, 50.00, 62.50, true, 'USDC', 'USD Coin', 'RAY', true, 'Raydium', 1.00, 1.25, 62.50, 62.50, '2024-01-17');

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC;
