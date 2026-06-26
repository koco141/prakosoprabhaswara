import fs from 'fs';

let content = fs.readFileSync('src/main.js', 'utf8');

// 1. Remove firebase import
content = content.replace(/import \{ auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, adminWhitelist \} from '\.\/firebase\.js';\n*/g, '');

// 2. Remove syncToFirebase function
content = content.replace(/let syncTimeout = null;[\s\S]*?const syncToFirebase = \([\s\S]*?\}\);\n\};\n/g, '');

// 3. Remove syncToFirebase calls from appStore
content = content.replace(/syncToFirebase\(\);/g, '');

// 4. Remove Firebase logic from DOMContentLoaded
content = content.replace(/try \{\n\s*const docSnap = await getDoc\(doc\(db, 'portfolio', 'data'\)\);[\s\S]*?\} catch\(e\) \{ console\.error\('Error loading firebase', e\); \}\n/g, '');

// 5. Remove ADMIN SYSTEM DOM selections
content = content.replace(/\/\/ --- ADMIN SYSTEM & ROLE MANAGEMENT ---[\s\S]*?let currentAvatarTarget = 'hero'; \/\/ 'hero' or 'about'\n/g, '');

// 6. Look for onAuthStateChanged and remove the block
// We'll write a regex to remove all authentication / admin interaction logic
// Often this starts with onAuthStateChanged or similar. Let's just remove everything after the initialization of i18n or portfolio items, if we can find it.
// Actually, it might be safer to output the locations of these blocks so I can construct precise regexes or substring removals.

console.log('Firebase imports and appStore sync removed.');
console.log('Searching for login triggers:', content.indexOf('adminTrigger.addEventListener'));
console.log('Searching for auth state:', content.indexOf('onAuthStateChanged('));

fs.writeFileSync('src/main_cleaned.js', content);
