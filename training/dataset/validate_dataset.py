import os
import re

DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset", "conversations.txt")

def validate_dataset(file_path):
    print("--- VALIDATING VOLTAGE TRAINING DATASET ---\n")
    
    if not os.path.exists(file_path):
        print(f"[ERROR] Dataset file not found at: {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    total_lines = len(lines)
    user_turns = 0
    voltage_turns = 0
    blank_lines = 0
    invalid_lines = []

    for idx, line in enumerate(lines, start=1):
        clean_line = line.strip()
        if not clean_line:
            blank_lines += 1
            continue
        
        if clean_line.startswith("User:"):
            user_turns += 1
        elif clean_line.startswith("Voltage:"):
            voltage_turns += 1
        else:
            invalid_lines.append((idx, clean_line[:40]))

    print(f"Total Lines Processed: {total_lines}")
    print(f"User Inputs: {user_turns}")
    print(f"Voltage Responses: {voltage_turns}")
    print(f"Empty Line Spacers: {blank_lines}")
    print(f"Total Conversation Turns: {min(user_turns, voltage_turns)}")

    if invalid_lines:
        print(f"\n[WARNING] Found {len(invalid_lines)} malformed lines:")
        for line_num, snippet in invalid_lines[:5]:
            print(f"  Line {line_num}: {snippet}...")
    else:
        print("\n[SUCCESS] Dataset structure is completely valid!")
        print("-----------------------------------------")

if __name__ == "__main__":
    validate_dataset(DATASET_PATH)
