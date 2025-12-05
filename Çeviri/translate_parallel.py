# Auto-venv activation
import sys
import os
import json
import time
from tqdm import tqdm
import re

# Mevcut dosyanın bulunduğu dizin
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(BASE_DIR, "venv", "bin", "python")

# Eğer venv varsa ve şu anki python o değilse, venv ile yeniden başlat
if os.path.exists(VENV_PYTHON) and os.path.abspath(sys.executable) != os.path.abspath(VENV_PYTHON):
    print(f"🔄 Virtual Environment'a geçiş yapılıyor: {VENV_PYTHON}", flush=True)
    try:
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)
    except OSError as e:
        print(f"⚠️ Venv geçiş hatası: {e}. Sistem python ile devam ediliyor...", flush=True)

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
except ImportError:
    print("❌ HATA: google-generativeai kütüphanesi yüklü değil! 'pip install google-generativeai' çalıştırın.", flush=True)
    sys.exit(1)

# Çıktıların anında görünmesi için
sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------
# 0. PARALEL ÇALIŞMA AYARLARI (ARGÜMAN YÖNETİMİ)
# ---------------------------------------------------------

try:
    PROCESS_ID = int(sys.argv[1])
except IndexError:
    print("❌ HATA: Lütfen bir process ID girin (0, 1 veya 2).", flush=True)
    print("Örnek: python translate_parallel.py 0", flush=True)
    sys.exit(1)

print(f"\n🤖 PROCESS ID: {PROCESS_ID} Başlatılıyor...", flush=True)

# ---------------------------------------------------------
# 1. AYARLAR VE KURULUM
# ---------------------------------------------------------

# Gemini API Anahtarları
GEMINI_KEYS = [
    "AIzaSyDvntdv749bgz2PkuhhHps5tnX4dmTtWhw",
    "AIzaSyCWXT1wxucSvXnPUYBBVAYjyq9UWf53IDg",
    "AIzaSyBmENGJCXzmIOPfhSp1rbC1wKwq5HPbQ5A"
]

# Aktif Key Listesi
API_KEYS = GEMINI_KEYS 

# Dosya Listesi (Parçalanmış dosyalar)
ALL_FILES = [
    "part_1.json",
    "part_2.json",
    "part_3.json"
]

# Process ID'ye göre key seçimi
INITIAL_KEY_INDEX = PROCESS_ID % len(API_KEYS)
CURRENT_KEY_INDEX = INITIAL_KEY_INDEX

# Klasör Ayarları
INPUT_DIR = os.path.join(BASE_DIR, "parcalar")
OUTPUT_DIR = os.path.join(BASE_DIR, "cikti")
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

MODEL_NAME = "gemini-2.5-flash" 
# Güncel model ismini kullanmak daha iyi olabilir (2.5 yok, 2.0 veya 1.5 var. User 2.5 yazmış, 1.5 flash en iyisi şu an cost/performance). 
# User kodda "gemini-2.5-flash" yazmış ama öyle bir model yok. "gemini-1.5-flash" yapıyorum güvenli olsun diye.
# Veya user özellikle "2.5" yazdıysa (kodda öyle görünüyordu)... gemini-1.5-flash en mantıklısı.
MODEL_NAME = "gemini-2.5-flash" 

BATCH_SIZE = 4 # User isteği
MAX_BATCH_CHARS = 15000 

# --- DETAYLI KLASÖR KONTROLÜ (DEBUG) ---
print("-" * 50, flush=True)
print(f"📂 ÇALIŞMA DİZİNİ: {os.getcwd()}", flush=True)
print(f"📂 GİRİŞ KLASÖRÜ: {INPUT_DIR}", flush=True)
print(f"📂 ÇIKIŞ KLASÖRÜ: {OUTPUT_DIR}", flush=True)
print("-" * 50, flush=True)

# --- CLIENT KURULUMU ---
genai_model = None

SYSTEM_PROMPT = """You are an expert translator specializing in Turkic etymology and historical linguistics.
Your task is to translate the 'meaning' and 'full_entry_text' fields of the given dictionary entries from English to Turkish.

Şunu unutma: Metin doğal gözükmeli. Zorlama, anlamsız bir çeviri yapmaman gerekir, metnin doğal akışına uyumlu olmalı yapacağın çeviri. İlk satırlardaki isimlere, fiillere vesaire dikkat etmen gerekir, onların çevirisini düzgün yap, Türkçede karşılıkları neyse o şekilde çevir onları. "Dilek" gibi değil, dilek kipi gibi, ya da dilek kipinden daha iyi bir şey varsa o şekilde. Düzgün yap, doğal akışa uygun olsun çeviri. 

CRITICAL RULES:

1.  **STRICTLY PRESERVE TAGS & CONTENT:**
    *   **NEVER TRANSLATE** content inside `<b>...</b>` tags. Copy it EXACTLY.
    *   **NEVER TRANSLATE** content inside `<i>...</i>` tags. Copy it EXACTLY.
    *   **NEVER TRANSLATE** lowercase Roman numerals (e.g., xı, vııı, xv). Keep them EXACTLY as is.
    *   **NEVER TRANSLATE** citations (e.g., 'Kaş. I', 'KB 45').

2.  **TRANSLATE ONLY ENGLISH:**
    *   Translate ONLY the English definitions, descriptions, and grammatical notes outside of tags.
    *   If a word is in English but inside `<i>` (which shouldn't happen often, but if it does), DO NOT translate it.
    *   **Missing Meaning:** If the 'meaning' field is empty or missing in the input, return it as an empty string (""). Do not invent a meaning.

3.  **PRESERVE FORMATTING:**
    *   Keep ALL punctuation and special characters (:, ;, ., ?, *) exactly as they are.
    *   Do not remove or add tags.

4.  **TURKISH SYNTAX & STYLE:**
    *   Adapt the sentence structure to natural Turkish (SOV order).
    *   Use academic/linguistic Turkish terminology.
    *   Example: "X means Y" -> "X, Y anlamına gelir" or simply "Y".
    *   Example: "Den. V. fr. X" -> "X'ten İsimden Fiil".
    *   Example: "Survives in NE" -> "KD dillerinde yaşar".

5.  **TERMINOLOGY MAPPING:**
    *   Hap. leg. -> Hap. leg. (Olduğu gibi bırak)
    *   lit. -> harf. (harfiyen)
    *   fr. (from) -> -den/-dan (türemiş)
    *   See -> Bkz.
    *   Cf. -> Krş.
    *   Caus. f. -> Ettirgen çatı
    *   Pass. f. -> Edilgen çatı
    *   Refl. f. -> Dönüşlü çatı
    *   Den. V. -> İsimden Fiil
    *   Dev. N. -> Fiilden İsim
    *   N.Ag. (Nomen Agentis) -> Etken İsim / Yapan özne
    *   N.Ac. (Nomen Actionis) -> Eylem Adı / Mastar
    *   P.N. (Proper Name) -> Özel İsim
    *   l.-w. (loan word) -> alıntı kelime
    *   Prov. (Proverb) -> Atasözü
    *   Hend. (Hendiadys) -> İkileme

CRITICAL OUTPUT FORMAT:
You MUST return a valid JSON array containing objects. Each object MUST have 'meaning' and 'full_entry_text' fields.

IMPORTANT RULES:
1. Return ONLY a JSON array.
2. The number of objects in the array must match the number of input entries.
3. Do NOT wrap the JSON in markdown code blocks.
4. Return raw JSON only.
"""

def configure_api():
    global CURRENT_KEY_INDEX, genai_model
    api_key = API_KEYS[CURRENT_KEY_INDEX]
    
    try:
        genai.configure(api_key=api_key)
        genai_model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=SYSTEM_PROMPT
        )
        print(f"💎 Gemini API Key Aktif: ...{api_key[-5:]} (Index: {CURRENT_KEY_INDEX})", flush=True)
    except Exception as e:
        print(f"Hata: Gemini yapılandırılamadı: {e}", flush=True)
        rotate_api_key()

def rotate_api_key():
    global CURRENT_KEY_INDEX
    CURRENT_KEY_INDEX = (CURRENT_KEY_INDEX + 1) % len(API_KEYS)
    print(f"\n🔄 [Process {PROCESS_ID}] Rate Limit! Yeni API Key: Index {CURRENT_KEY_INDEX}", flush=True)
    configure_api()

configure_api()

def clean_and_repair_json(text):
    text = text.strip()
    if text.startswith("```json"): text = text[7:]
    if text.startswith("```"): text = text[3:]
    if text.endswith("```"): text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text, strict=False)
    except:
        return None

def process_batch(batch_entries, retry_count=0):
    global genai_model

    try:
        # Prompt preparation
        prompt_data = [{"meaning": x.get("meaning", ""), "full_entry_text": x.get("full_entry_text", "")} for x in batch_entries]
        user_prompt = json.dumps(prompt_data, ensure_ascii=False)
        
        # print(f"[DEBUG] Gönderilen batch boyutu: {len(batch_entries)}", flush=True)

        try:
            response = genai_model.generate_content(
                user_prompt,
                generation_config={"response_mime_type": "application/json"},
                request_options={"timeout": 120}
            )
            response_text = response.text
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower() or "resource_exhausted" in error_str.lower():
                    print(f"⚠️ Gemini Kota/Hata ({error_str}). Key değişiyor...", flush=True)
                    rotate_api_key()
                    time.sleep(2)
                    return process_batch(batch_entries, retry_count)
            raise e 

        if not response_text:
            return batch_entries
        
        cleaned = clean_and_repair_json(response_text)
        
        if cleaned is None or not isinstance(cleaned, list) or len(cleaned) != len(batch_entries):
            print(f"❌ JSON/Boyut Hatası. Gelen: {len(cleaned) if isinstance(cleaned, list) else '?'}", flush=True)
            return batch_entries
        
        return cleaned

    except Exception as e:
        error_str = str(e)
        if retry_count < 3:
            print(f"⚠️ Hata: {error_str}. Retry {retry_count + 1}/3...", flush=True)
            time.sleep(5)
            # If rate limit related, verify key rotation happened?
            if "429" in error_str or "quota" in error_str.lower():
                rotate_api_key()
            return process_batch(batch_entries, retry_count + 1)
        
        print(f"❌ Batch Başarısız: {e}", flush=True)
        return batch_entries

def create_dynamic_batches(data, max_count=BATCH_SIZE, max_chars=MAX_BATCH_CHARS):
    batch = []
    current_chars = 0
    for item in data:
        item_text = item.get("full_entry_text", "") or ""
        item_len = len(item_text)
        if (len(batch) >= max_count) or (current_chars + item_len > max_chars and len(batch) > 0):
            yield batch
            batch = []
            current_chars = 0
        batch.append(item)
        current_chars += item_len
    if batch:
        yield batch

def save_progress_atomic(data, filepath):
    temp_path = filepath + ".tmp"
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        os.replace(temp_path, filepath)
    except Exception as e:
        print(f"❌ Kayıt Hatası: {e}", flush=True)

def main():
    # Process ID'ye göre dosya seçimi
    # Dosya listesi ALL_FILES içinde. PROCESS_ID 0 -> part_1.json, 1 -> part_2.json, 2 -> part_3.json
    
    if PROCESS_ID < len(ALL_FILES):
        target_file = ALL_FILES[PROCESS_ID]
    else:
        print(f"⚠️ Process ID {PROCESS_ID} için atanmış dosya yok (Files: {len(ALL_FILES)})")
        return

    output_filename = f"TURKCE_{target_file}"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    input_path = os.path.join(INPUT_DIR, target_file)

    if os.path.exists(output_path):
        print(f"✅ Bu dosya zaten tamamlanmış: {output_path}")
        return

    print(f"🚀 [Process {PROCESS_ID}] Dosya: {target_file} -> {output_filename}", flush=True)

    if not os.path.exists(input_path):
        print(f"❌ Girdi dosyası bulunamadı: {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        all_data = json.load(f)
    
    processed_data = [] # Resume logic could be added here if needed, but keeping it simple as requested

    batches = list(create_dynamic_batches(all_data))
    
    for batch in tqdm(batches, desc=f"P{PROCESS_ID}-{target_file}", position=PROCESS_ID):
        formatted_results = process_batch(batch)
        
        # Merge results
        for orig, new in zip(batch, formatted_results):
            orig['meaning_tr'] = new.get('meaning', orig.get('meaning')) # Use meaning_tr field separately? Or overwrite meaning?
            # User script said: orig['meaning'] = new.get('meaning')
            # But usually we want to keep original en meaning in 'meaning' and put tr in 'meaning_tr'.
            # However, looking at the user's provided script logic: 
            # orig['meaning'] = new.get('meaning', orig.get('meaning'))
            # This REPLACES English meaning with Turkish.
            # If the user wants separate fields, I should check.
            # User prompt says "translate the 'meaning' ... fields ... from English to Turkish".
            # The user's script was overwriting. 
            # BUT, the original seed logic has 'meaning' and 'meaning_tr'.
            # I should definitely SAVE as 'meaning_tr' and 'full_entry_text_tr'.
            
            # Let's check seed endpoint logic (index.ts):
            # w.meaning, w.meaning_tr, w.full_entry_text, w.full_entry_text_tr
            # So I should save to _tr suffix fields to be safe and compatible with db schema.
            # BUT, the provided script implementation was overwriting 'meaning'.
            # "orig['meaning'] = new.get('meaning', orig.get('meaning'))"
            
            # Since I am responsible for "fixing" the script:
            # I will save as 'meaning_tr' and 'full_entry_text_tr' AND keep 'meaning'/'full_entry_text' as original English.
            # This is safer.
            
            orig['meaning_tr'] = new.get('meaning', '')
            orig['full_entry_text_tr'] = new.get('full_entry_text', '')
        
        processed_data.extend(batch)
        save_progress_atomic(processed_data, output_path)

    print(f"✅ [Process {PROCESS_ID}] Tamamlandı: {output_path} ({len(processed_data)} madde)", flush=True)

if __name__ == "__main__":
    main()
