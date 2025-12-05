
import json
import os
import math

base_dir = "/home/logos/0-Clauson/ClausonReady/ClausonDeneme/Çeviri"
input_file = os.path.join(base_dir, "eksik_kelimeler.json")
output_dir = os.path.join(base_dir, "parcalar")

os.makedirs(output_dir, exist_ok=True)

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    chunk_size = math.ceil(total / 3)
    
    print(f"Toplam kelime: {total}. Parça başı: ~{chunk_size}")

    for i in range(3):
        start = i * chunk_size
        end = min((i + 1) * chunk_size, total)
        chunk = data[start:end]
        
        filename = f"part_{i+1}.json"
        output_path = os.path.join(output_dir, filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=4)
        print(f"Oluşturuldu: {filename} ({len(chunk)} kayıt)")
        
except Exception as e:
    print(f"Hata: {e}")
