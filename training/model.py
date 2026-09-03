import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadCausalAttention(nn.Module):
    """
    Multi-Head Causal Self-Attention.
    Ensures predictions at step t only depend on known outputs at steps prior to t.
    """
    def __init__(self, d_model, n_heads):
        super().__init__()
        assert d_model % n_heads == 0, "d_model must be divisible by n_heads"
        
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

        self.qkv_proj = nn.Linear(d_model, 3 * d_model)
        self.out_proj = nn.Linear(d_model, d_model)

    def forward(self, x):
        batch_size, seq_len, d_model = x.size()

        # Project Q, K, V
        qkv = self.qkv_proj(x)  # (batch_size, seq_len, 3 * d_model)
        qkv = qkv.reshape(batch_size, seq_len, 3, self.n_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)  # (3, batch_size, n_heads, seq_len, head_dim)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # Compute Scaled Dot-Product Attention
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        
        # Causal mask (lower triangular) to prevent looking ahead
        causal_mask = torch.tril(torch.ones(seq_len, seq_len, device=x.device)).bool()
        scores = scores.masked_fill(~causal_mask, float('-inf'))

        attn_weights = F.softmax(scores, dim=-1)
        context = torch.matmul(attn_weights, v)  # (batch_size, n_heads, seq_len, head_dim)

        # Concatenate heads
        context = context.permute(0, 2, 1, 3).reshape(batch_size, seq_len, d_model)
        return self.out_proj(context)


class FeedForward(nn.Module):
    """Simple Position-wise Feed-Forward Network."""
    def __init__(self, d_model, d_ff):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model)
        )

    def forward(self, x):
        return self.net(x)


class TransformerBlock(nn.Module):
    """Standard Decoder Block with Pre-LayerNorm architecture."""
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = MultiHeadCausalAttention(d_model, n_heads)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff)

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x


class VoltageTransformer(nn.Module):
    """
    Voltage V1 Core Language Model.
    Decoder-Only Causal Transformer for next-token prediction.
    """
    def __init__(self, vocab_size, d_model=128, n_heads=4, n_layers=4, d_ff=512, max_seq_len=128):
        super().__init__()
        self.vocab_size = vocab_size
        self.max_seq_len = max_seq_len

        # Token & Positional Embeddings
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.position_embedding = nn.Embedding(max_seq_len, d_model)

        # Transformer Decoder Layers
        self.layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff) for _ in range(n_layers)
        ])

        self.ln_final = nn.LayerNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

        # Tie weights between token embeddings and language model head
        self.lm_head.weight = self.token_embedding.weight

    def forward(self, idx):
        batch_size, seq_len = idx.size()
        assert seq_len <= self.max_seq_len, f"Cannot process sequence of length {seq_len}, max is {self.max_seq_len}"

        pos = torch.arange(0, seq_len, dtype=torch.long, device=idx.device)
        
        # Combine token and position embeddings
        tok_emb = self.token_embedding(idx)
        pos_emb = self.position_embedding(pos)
        x = tok_emb + pos_emb

        # Pass through Decoder Blocks
        for layer in self.layers:
            x = layer(x)

        x = self.ln_final(x)
        logits = self.lm_head(x)  # (batch_size, seq_len, vocab_size)
        return logits


if __name__ == "__main__":
    # Self-test Architecture
    VOCAB_SIZE = 214
    MAX_SEQ_LEN = 128
    
    model = VoltageTransformer(
        vocab_size=VOCAB_SIZE,
        d_model=128,
        n_heads=4,
        n_layers=4,
        d_ff=512,
        max_seq_len=MAX_SEQ_LEN
    )

    # Dummy batch: 2 sequences of length 10
    dummy_input = torch.randint(0, VOCAB_SIZE, (2, 10))
    logits = model(dummy_input)

    total_params = sum(p.numel() for p in model.parameters())

    print("--- VOLTAGE TRANSFORMER MODEL TEST ---")
    print(f"Input Shape:  {dummy_input.shape}")
    print(f"Output Shape: {logits.shape} (batch, seq_len, vocab_size)")
    print(f"Total Parameters: {total_params:,}")
    print("--------------------------------------")
