"""
Training and Architecture Configuration for Voltage V1
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# File Paths
DATASET_PATH = os.path.join(BASE_DIR, "training", "dataset", "conversations.txt")
VOCAB_PATH = os.path.join(BASE_DIR, "models", "voltage-model", "vocab.json")
MODEL_OUTPUT_DIR = os.path.join(BASE_DIR, "models", "voltage-model")
CHECKPOINT_PATH = os.path.join(MODEL_OUTPUT_DIR, "voltage_v1.pt")

# Model Architecture Hyperparameters
D_MODEL = 128
N_HEADS = 4
N_LAYERS = 4
D_FF = 512
MAX_SEQ_LEN = 128

# Training Hyperparameters
EPOCHS = 150
BATCH_SIZE = 8
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 0.01
DEVICE = "cpu"  # Guaranteed to run on standard hardware; uses "cuda" or "mps" if available
