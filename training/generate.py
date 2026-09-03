import os
import torch
import torch.nn.functional as F

from tokenizer import VoltageTokenizer
from model import VoltageTransformer
import config

class VoltageGenerator:
    """Handles text generation using the trained Voltage PyTorch model."""
    def __init__(self, checkpoint_path=config.CHECKPOINT_PATH, vocab_path=config.VOCAB_PATH):
        self.device = torch.device("cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu"))
        
        # Load Tokenizer
        self.tokenizer = VoltageTokenizer()
        self.tokenizer.load_vocab(vocab_path)
        
        # Load Checkpoint
        if not os.path.exists(checkpoint_path):
            raise FileNotFoundError(f"Model checkpoint not found at: {checkpoint_path}. Run train.py first.")
        
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        model_config = checkpoint['config']
        
        # Initialize Model with saved architecture config
        self.model = VoltageTransformer(
            vocab_size=checkpoint['vocab_size'],
            d_model=model_config['d_model'],
            n_heads=model_config['n_heads'],
            n_layers=model_config['n_layers'],
            d_ff=model_config['d_ff'],
            max_seq_len=model_config['max_seq_len']
        ).to(self.device)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()

    def generate(self, prompt, max_new_tokens=40, temperature=0.7, top_k=5, repetition_penalty=1.2):
        """
        Generates text continuation given an input prompt.
        
        :param prompt: Raw input string (e.g. "User: Who created you?\nVoltage:")
        :param max_new_tokens: Maximum tokens to generate
        :param temperature: Higher = more creative/random, lower = more predictable
        :param top_k: Truncate probabilities to top k candidates
        :param repetition_penalty: Penalty for repeating tokens
        :return: Generated response string
        """
        encoded_input = self.tokenizer.encode(prompt, add_special_tokens=False)
        input_ids = torch.tensor([encoded_input], dtype=torch.long, device=self.device)

        generated_ids = list(encoded_input)
        eos_id = self.tokenizer.word2idx[self.tokenizer.eos_token]

        with torch.no_grad():
            for _ in range(max_new_tokens):
                # Truncate input if longer than max sequence length
                cond_ids = input_ids[:, -config.MAX_SEQ_LEN:]
                
                logits = self.model(cond_ids)  # (1, seq_len, vocab_size)
                next_token_logits = logits[0, -1, :]  # Take logits of last position

                # Apply Repetition Penalty
                for id_gen in set(generated_ids):
                    if next_token_logits[id_gen] < 0:
                        next_token_logits[id_gen] *= repetition_penalty
                    else:
                        next_token_logits[id_gen] /= repetition_penalty

                # Apply Temperature
                if temperature > 0:
                    next_token_logits = next_token_logits / temperature

                # Apply Top-K Filtering
                if top_k > 0:
                    v, _ = torch.topk(next_token_logits, min(top_k, next_token_logits.size(-1)))
                    next_token_logits[next_token_logits < v[-1]] = -float('Inf')

                # Softmax to probabilities
                probs = F.softmax(next_token_logits, dim=-1)

                # Sample next token
                next_token = torch.multinomial(probs, num_samples=1).item()

                if next_token == eos_id:
                    break

                generated_ids.append(next_token)
                input_ids = torch.cat([input_ids, torch.tensor([[next_token]], device=self.device)], dim=1)

        # Extract only the newly generated part (after prompt)
        new_tokens = generated_ids[len(encoded_input):]
        return self.tokenizer.decode(new_tokens)


if __name__ == "__main__":
    generator = VoltageGenerator()

    test_prompts = [
        "User: Who created you?\nVoltage:",
        "User: Tell me a joke.\nVoltage:",
        "User: What is your name?\nVoltage:"
    ]

    print("--- VOLTAGE INFERENCE GENERATION TEST ---\n")
    for prompt in test_prompts:
        response = generator.generate(prompt, temperature=0.7, top_k=5)
        print(f"Prompt:\n{prompt}")
        print(f"Generated Output: {response}\n" + "-"*40)
