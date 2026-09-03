import json
import os
import re

class VoltageTokenizer:
    """
    Custom Word/Punctuation Tokenizer for Voltage.
    Handles special tokens: <PAD>, <UNK>, <BOS>, <EOS>.
    """
    def __init__(self):
        self.pad_token = "<PAD>"
        self.unk_token = "<UNK>"
        self.bos_token = "<BOS>"
        self.eos_token = "<EOS>"
        
        self.special_tokens = [self.pad_token, self.unk_token, self.bos_token, self.eos_token]
        
        self.word2idx = {}
        self.idx2word = {}
        
        # Initialize special tokens
        for token in self.special_tokens:
            self._add_token(token)

    def _add_token(self, token):
        if token not in self.word2idx:
            idx = len(self.word2idx)
            self.word2idx[token] = idx
            self.idx2word[idx] = token
            return idx
        return self.word2idx[token]

    def clean_text(self, text):
        """Normalizes spaces and standardizes line breaks."""
        text = re.sub(r'\r\n', '\n', text)
        return text.strip()

    def tokenize_raw(self, text):
        """Splits text into words, punctuation marks, and special control tokens."""
        text = self.clean_text(text)
        # Separate words, punctuation, and preserves system keywords like User: or Voltage:
        tokens = re.findall(r"\w+|[^\w\s]", text)
        return tokens

    def build_vocab(self, corpus_text):
        """Builds vocabulary from a string corpus."""
        tokens = self.tokenize_raw(corpus_text)
        for token in tokens:
            self._add_token(token)
        print(f"[Tokenizer] Vocabulary built. Total unique tokens: {len(self.word2idx)}")

    def encode(self, text, add_special_tokens=True):
        """Converts raw text into a sequence of integer token IDs."""
        tokens = self.tokenize_raw(text)
        ids = []
        if add_special_tokens:
            ids.append(self.word2idx[self.bos_token])
            
        for token in tokens:
            ids.append(self.word2idx.get(token, self.word2idx[self.unk_token]))
            
        if add_special_tokens:
            ids.append(self.word2idx[self.eos_token])
            
        return ids

    def decode(self, token_ids):
        """Converts integer token IDs back into human-readable text."""
        tokens = []
        for idx in token_ids:
            word = self.idx2word.get(idx, self.unk_token)
            if word not in [self.pad_token, self.bos_token, self.eos_token]:
                tokens.append(word)
        
        # Reconstruct sentence with basic spacing heuristics
        text = " ".join(tokens)
        text = re.sub(r'\s+([^\w\s])', r'\1', text) # remove spaces before punctuation
        return text

    def save_vocab(self, file_path):
        """Saves vocabulary mapping to JSON for Node.js engine compatibility."""
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        vocab_data = {
            "special_tokens": {
                "pad": self.pad_token,
                "unk": self.unk_token,
                "bos": self.bos_token,
                "eos": self.eos_token
            },
            "word2idx": self.word2idx,
            "idx2word": {str(k): v for k, v in self.idx2word.items()}
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(vocab_data, f, indent=2)
        print(f"[Tokenizer] Saved vocabulary to: {file_path}")

    def load_vocab(self, file_path):
        """Loads vocabulary mapping from JSON."""
        with open(file_path, "r", encoding="utf-8") as f:
            vocab_data = json.load(f)
        self.word2idx = vocab_data["word2idx"]
        self.idx2word = {int(k): v for k, v in vocab_data["idx2word"].items()}


if __name__ == "__main__":
    # Test & Export
    dataset_path = os.path.join(os.path.dirname(__file__), "dataset", "conversations.txt")
    vocab_output_path = os.path.join(os.path.dirname(__file__), "..", "models", "voltage-model", "vocab.json")

    tokenizer = VoltageTokenizer()

    if os.path.exists(dataset_path):
        with open(dataset_path, "r", encoding="utf-8") as f:
            corpus = f.read()
        
        tokenizer.build_vocab(corpus)
        tokenizer.save_vocab(vocab_output_path)

        # Test Encoding / Decoding
        sample_sentence = "User: Who created you?\nVoltage: I was built and trained by my creator."
        encoded = tokenizer.encode(sample_sentence)
        decoded = tokenizer.decode(encoded)

        print("\n--- TOKENIZER SELF-TEST ---")
        print(f"Sample Input:\n{sample_sentence}\n")
        print(f"Encoded Token IDs:\n{encoded}\n")
        print(f"Decoded Output:\n{decoded}")
        print("----------------------------")
    else:
        print(f"[ERROR] Could not find dataset at {dataset_path}")
