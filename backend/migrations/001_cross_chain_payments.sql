-- Migration: Add cross_chain_payments table
-- Created: 2025-12-13
-- Purpose: Track Wormhole VAA-based cross-chain payments

CREATE TABLE IF NOT EXISTS cross_chain_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaa_hash VARCHAR(66) NOT NULL UNIQUE,
  emitter_chain SMALLINT NOT NULL,
  emitter_address VARCHAR(66) NOT NULL,
  sequence BIGINT NOT NULL,
  payload_hash VARCHAR(66) NOT NULL,
  payload_data JSONB NOT NULL,
  session_id UUID NOT NULL,
  content_id VARCHAR(66) NOT NULL,
  payer_address VARCHAR(42) NOT NULL,
  amount BIGINT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  guardian_signatures SMALLINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaa_hash ON cross_chain_payments(vaa_hash);
CREATE INDEX IF NOT EXISTS idx_emitter_address ON cross_chain_payments(emitter_address);
CREATE INDEX IF NOT EXISTS idx_session_id ON cross_chain_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_processed_at ON cross_chain_payments(processed_at);
CREATE INDEX IF NOT EXISTS idx_content_id ON cross_chain_payments(content_id);
CREATE INDEX IF NOT EXISTS idx_status ON cross_chain_payments(status);

-- Comments for documentation
COMMENT ON TABLE cross_chain_payments IS 'Cross-chain payment intents verified via Wormhole VAAs';
COMMENT ON COLUMN cross_chain_payments.vaa_hash IS 'SHA256 hash of VAA bytes for idempotency';
COMMENT ON COLUMN cross_chain_payments.emitter_chain IS 'Wormhole chain ID (30=Base, 2=Ethereum)';
COMMENT ON COLUMN cross_chain_payments.emitter_address IS 'X402PaymentEmitter contract address';
COMMENT ON COLUMN cross_chain_payments.sequence IS 'Wormhole message sequence number';
COMMENT ON COLUMN cross_chain_payments.payload_data IS 'Decoded payload (contentId, sessionId, payer, amount, timestamp)';
COMMENT ON COLUMN cross_chain_payments.guardian_signatures IS 'Number of Guardian signatures (should be >= 13)';
COMMENT ON COLUMN cross_chain_payments.status IS 'PENDING, VERIFIED, or FAILED';
