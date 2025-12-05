import json
import os
import glob
import requests
import time

DATA_DIR = '../frontend/public/data'
API_URL = 'https://clauson-sozluk-backend.clausondictionary.workers.dev/api/seed'
CLEAR_URL = 'https://clauson-sozluk-backend.clausondictionary.workers.dev/api/seed/clear'
SECRET = 'parola'

def normalize_clauson_word(word):
    if not word: return ''
    normalized = word.replace('I', 'ı').replace('İ', 'i').lower()
    import re
    normalized = re.sub(r'[\d\*\:\/\s\-\.\(\)\[\]]', '', normalized)
    
    replacements = [
        (r'[ñŋ]', 'n'), (r'[ḏḍ]', 'd'), (r'ṭ', 't'), (r'ẓ', 'z'),
        (r'[āáă]', 'a'), (r'ī', 'i'), (r'ū', 'u'), (r'š', 's'),
        (r'γ', 'g'), (r'[éä]', 'e'), (r'č', 'c')
    ]
    for pattern, repl in replacements:
        normalized = re.sub(pattern, repl, normalized)
        
    return normalized

def main():
    headers = {'X-Admin-Secret': SECRET}
    
    # 1. Clear Database
    print("Clearing database...")
    try:
        resp = requests.post(CLEAR_URL, headers=headers)
        print(resp.json())
    except Exception as e:
        print(f"Clear failed: {e}")

    # 2. Load and Send Data
    json_files = sorted(glob.glob(os.path.join(DATA_DIR, '*.json')))
    total_sent = 0
    
    batch = []
    BATCH_SIZE = 50 
    
    for json_file in json_files:
        if 'copy' in json_file: continue # Skip copies
        
        print(f"Processing {json_file}...")
        try:
            with open(json_file, 'r', encoding='utf-8') as jf:
                data = json.load(jf)
                
            for entry in data:
                word = entry.get('word', '')
                normalized = normalize_clauson_word(word)
                
                item = {
                    'word': word,
                    'normalized_word': normalized,
                    'meaning': entry.get('meaning', ''),
                    'meaning_tr': entry.get('meaning_tr', ''),
                    'full_entry_text': entry.get('full_entry_text', ''),
                    'full_entry_text_tr': entry.get('full_entry_text_tr', ''),
                    'etymology_type': entry.get('etymology_type', ''),
                    'variants': entry.get('variants', []),
                    'page': str(entry.get('page', ''))
                }
                
                batch.append(item)
                
                if len(batch) >= BATCH_SIZE:
                    try:
                        resp = requests.post(API_URL, json=batch, headers=headers)
                        if resp.status_code != 200:
                            print(f"Error sending batch: {resp.text}")
                        else:
                            total_sent += len(batch)
                            print(f"Sent {len(batch)} items. Total: {total_sent}")
                    except Exception as e:
                        print(f"Request failed: {e}")
                        
                    batch = []
                    
        except Exception as e:
            print(f"Error processing file {json_file}: {e}")

    # Send remaining
    if batch:
        try:
            resp = requests.post(API_URL, json=batch, headers=headers)
            total_sent += len(batch)
            print(f"Sent remaining {len(batch)} items. Total: {total_sent}")
        except Exception as e:
            print(f"Request failed: {e}")

    print("Done!")

if __name__ == "__main__":
    main()
