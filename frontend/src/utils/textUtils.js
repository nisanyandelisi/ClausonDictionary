export function normalizeClausonWord(text) {
    if (!text) return "";
    
    // Turkish uppercase to lowercase conversion
    text = text.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
    
    // Remove unwanted characters (numbers, *, :, /, spaces, etc.)
    text = text.replace(/[\d\*\:\/\s\-\.\(\)\[\]]/g, '');
    
    // Clauson special character replacements
    text = text.replace(/[ñŋ]/g, 'n')
              .replace(/[ḏḍ]/g, 'd')
              .replace(/ṭ/g, 't')
              .replace(/ẓ/g, 'z')
              .replace(/[āáă]/g, 'a')
              .replace(/ī/g, 'i')
              .replace(/ū/g, 'u')
              .replace(/š/g, 's')
              .replace(/γ/g, 'g')
              .replace(/[éä]/g, 'e')
              .replace(/č/g, 'c');
    
    return text;
}
