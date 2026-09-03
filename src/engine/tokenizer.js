const fs = require('fs');

class VoltageTokenizerJS {
  constructor(vocabPath) {
    if (!fs.existsSync(vocabPath)) {
      throw new Error(`Vocabulary file not found at: ${vocabPath}`);
    }

    const data = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    this.word2idx = data.word2idx;
    this.idx2word = data.idx2word;

    this.unkToken = '<UNK>';
    this.bosToken = '<BOS>';
    this.eosToken = '<EOS>';
    this.padToken = '<PAD>';
  }

  tokenize(text) {
    // Basic whitespace & punctuation splitting matching Python tokenizer
    return text
      .replace(/([.,!?;:()"])/g, ' $1 ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  encode(text, addSpecialTokens = false) {
    const tokens = this.tokenize(text);
    const ids = [];

    if (addSpecialTokens) {
      ids.push(this.word2idx[this.bosToken]);
    }

    for (const token of tokens) {
      if (token in this.word2idx) {
        ids.push(this.word2idx[token]);
      } else {
        ids.push(this.word2idx[this.unkToken]);
      }
    }

    if (addSpecialTokens) {
      ids.push(this.word2idx[this.eosToken]);
    }

    return ids;
  }

  decode(tokenIds) {
    const tokens = [];
    const specialTokens = new Set([this.unkToken, this.bosToken, this.eosToken, this.padToken]);

    for (const id of tokenIds) {
      const word = this.idx2word[id.toString()];
      if (word && !specialTokens.has(word)) {
        tokens.push(word);
      }
    }

    // Basic space normalization around punctuation
    return tokens
      .join(' ')
      .replace(/\s+([.,!?;:()"])/g, '$1');
  }
}

module.exports = VoltageTokenizerJS;
