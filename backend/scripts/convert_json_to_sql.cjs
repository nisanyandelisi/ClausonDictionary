const fs = require('fs');
const path = require('path');

// Kaynak ve Hedef Yollar
const SOURCE_DIR = path.join(__dirname, '../../../All Datas');
const OUTPUT_FILE = path.join(__dirname, '../import.sql');

// Normalizasyon Fonksiyonu (Clauson Özel Karakterleri)
function normalizeClausonWord(word) {
    if (!word) return '';

    // Türkçe büyük/küçük harf dönüşümünü doğru yap: 'I' -> 'ı', 'İ' -> 'i'
    let normalized = word.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

    // Sadece Clauson'a özgü diğer dillerin karakterlerini basitleştir, Türkçe olanları koru
    const replacements = [
        { regex: /[ñŋ]/g, replacement: 'n' },
        { regex: /[ḏḍ]/g, replacement: 'd' },
        { regex: /ṭ/g, replacement: 't' },
        { regex: /ẓ/g, replacement: 'z' },
        { regex: /[āáă]/g, replacement: 'a' },
        { regex: /ī/g, replacement: 'i' },
        { regex: /ū/g, replacement: 'u' },
        { regex: /š/g, replacement: 's' },
        { regex: /γ/g, replacement: 'g' },
        { regex: /[éä]/g, replacement: 'e' },
        { regex: /č/g, replacement: 'c' }
    ];

    replacements.forEach(rule => {
        normalized = normalized.replace(rule.regex, rule.replacement);
    });

    return normalized;
}

// SQL String Escape (Tek tırnakları kaçır)
function escapeSql(str) {
    if (!str) return 'NULL';
    // Tek tırnağı iki tek tırnak yap
    return "'" + str.replace(/'/g, "''") + "'";
}

async function main() {
    console.log('🔄 Veri dönüştürme işlemi başlıyor...');
    console.log(`📂 Kaynak: ${SOURCE_DIR}`);

    try {
        const files = fs.readdirSync(SOURCE_DIR).filter(file => file.endsWith('.json'));
        let sqlContent = '-- Clauson Sözlük Veri İçe Aktarma\n';
        sqlContent += 'BEGIN TRANSACTION;\n';
        sqlContent += 'DELETE FROM words;\n'; // Önce temizle

        let totalWords = 0;

        for (const file of files) {
            const filePath = path.join(SOURCE_DIR, file);
            console.log(`📄 İşleniyor: ${file}`);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);

            // JSON bir array mi yoksa tek obje mi kontrol et (Genelde array olur ama Clauson verisi bazen farklı olabilir)
            // Varsayım: JSON dosyasının kendisi bir array veya içinde kelimeler var.
            // Mevcut yapıya göre her dosya bir harf grubu olabilir.

            // Eğer JSON direkt array ise:
            const words = Array.isArray(jsonData) ? jsonData : [jsonData];

            for (const entry of words) {
                if (!entry.word) continue;

                const word = entry.word;
                const normalized = normalizeClausonWord(word);
                const meaning = entry.meaning || '';
                const fullEntry = entry.full_entry_text || '';
                const etymology = entry.etymology_type || '';
                const variants = JSON.stringify(entry.variants || []);
                const page = entry.page || null;
                const skeleton = entry.skeleton || '';

                const sql = `INSERT INTO words (word, normalized_word, meaning, full_entry_text, etymology_type, variants, page, skeleton) VALUES (${escapeSql(word)}, ${escapeSql(normalized)}, ${escapeSql(meaning)}, ${escapeSql(fullEntry)}, ${escapeSql(etymology)}, ${escapeSql(variants)}, ${page}, ${escapeSql(skeleton)});\n`;

                sqlContent += sql;
                totalWords++;
            }
        }

        sqlContent += 'COMMIT;\n';

        fs.writeFileSync(OUTPUT_FILE, sqlContent);
        console.log(`✅ İşlem tamamlandı!`);
        console.log(`📊 Toplam ${totalWords} kelime SQL'e dönüştürüldü.`);
        console.log(`💾 Çıktı: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Hata oluştu:', error);
    }
}

main();
