const ort = require('onnxruntime-node');
const path = require('path');
const VoltageTokenizerJS = require('./tokenizer');

class VoltageAIEngine {
  constructor() {
    this.session = null;
    this.tokenizer = null;
    this.maxSeqLen = 128;
  }

  async initialize() {
    const modelPath = path.join(__dirname, '../../models/voltage-model/voltage_v1.onnx');
    const vocabPath = path.join(__dirname, '../../models/voltage-model/vocab.json');

    console.log('[AI Engine] Loading ONNX model session...');
    this.session = await ort.InferenceSession.create(modelPath);

    console.log('[AI Engine] Loading Tokenizer...');
    this.tokenizer = new VoltageTokenizerJS(vocabPath);

    console.log('[AI Engine] Initialization complete.');
  }

  softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sumExps);
  }

  sampleTopK(probs, k = 5, temperature = 0.7) {
    // Apply temperature adjustment
    const adjustedProbs = probs.map((p) => Math.pow(p, 1 / temperature));
    const totalProb = adjustedProbs.reduce((a, b) => a + b, 0);
    const normProbs = adjustedProbs.map((p) => p / totalProb);

    // Get top-k indices
    const indexed = normProbs.map((p, i) => ({ prob: p, index: i }));
    indexed.sort((a, b) => b.prob - a.prob);
    const topK = indexed.slice(0, Math.min(k, indexed.length));

    // Re-normalize top-k probabilities
    const topKSum = topK.reduce((sum, item) => sum + item.prob, 0);
    let rand = Math.random() * topKSum;

    for (const item of topK) {
      rand -= item.prob;
      if (rand <= 0) return item.index;
    }

    return topK[0].index;
  }

  async generate(prompt, maxNewTokens = 35) {
    if (!this.session || !this.tokenizer) {
      throw new Error('AI Engine is not initialized. Call initialize() first.');
    }

    const encodedInput = this.tokenizer.encode(prompt, false);
    let inputIds = [...encodedInput];
    const generatedIds = [...encodedInput];
    const eosId = this.tokenizer.word2idx[this.tokenizer.eosToken];

    for (let i = 0; i < maxNewTokens; i++) {
      // Truncate to maximum sequence length
      const condIds = inputIds.slice(-this.maxSeqLen);

      // Create BigInt64 tensor for ONNX Runtime input
      const tensorData = BigInt64Array.from(condIds.map((id) => BigInt(id)));
      const tensor = new ort.Tensor('int64', tensorData, [1, condIds.length]);

      // Run inference
      const results = await this.session.run({ input_ids: tensor });
      const logitsTensor = results.logits; // shape: [1, seq_len, vocab_size]

      const vocabSize = logitsTensor.dims[2];
      const seqLen = logitsTensor.dims[1];

      // Extract logits for last sequence position
      const lastTokenOffset = (seqLen - 1) * vocabSize;
      const lastTokenLogits = Array.from(
        logitsTensor.data.slice(lastTokenOffset, lastTokenOffset + vocabSize)
      );

      // Convert logits to probabilities and sample
      const probs = this.softmax(lastTokenLogits);
      const nextTokenId = this.sampleTopK(probs, 5, 0.7);

      if (nextTokenId === eosId) break;

      generatedIds.push(nextTokenId);
      inputIds.push(nextTokenId);
    }

    // Return decoded newly generated text
    const newTokens = generatedIds.slice(encodedInput.length);
    return this.tokenizer.decode(newTokens);
  }
}

module.exports = VoltageAIEngine;
