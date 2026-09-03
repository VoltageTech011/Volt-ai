import os
import torch
import config
from model import VoltageTransformer

def export_to_onnx():
    print("--- EXPORTING VOLTAGE MODEL TO ONNX FOR NODE.JS ---")

    checkpoint_path = config.CHECKPOINT_PATH
    onnx_output_path = os.path.join(config.MODEL_OUTPUT_DIR, "voltage_v1.onnx")

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}. Train the model first.")

    # 1. Load trained PyTorch model
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    model_config = checkpoint['config']
    vocab_size = checkpoint['vocab_size']

    model = VoltageTransformer(
        vocab_size=vocab_size,
        d_model=model_config['d_model'],
        n_heads=model_config['n_heads'],
        n_layers=model_config['n_layers'],
        d_ff=model_config['d_ff'],
        max_seq_len=model_config['max_seq_len']
    )
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    # 2. Define dummy input with dynamic sequence axes
    dummy_input = torch.randint(0, vocab_size, (1, 10), dtype=torch.long)

    # 3. Export model graph
    torch.onnx.export(
        model,
        dummy_input,
        onnx_output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input_ids'],
        output_names=['logits'],
        dynamic_axes={
            'input_ids': {0: 'batch_size', 1: 'sequence_length'},
            'logits': {0: 'batch_size', 1: 'sequence_length'}
        }
    )

    size_mb = os.path.getsize(onnx_output_path) / (1024 * 1024)
    print(f"[Export] Model successfully exported to ONNX format!")
    print(f"[Export] Path: {onnx_output_path}")
    print(f"[Export] File Size: {size_mb:.2f} MB")
    print("--------------------------------------------------")

if __name__ == "__main__":
    export_to_onnx()
