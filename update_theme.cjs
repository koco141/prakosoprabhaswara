const fs = require('fs');
const path = require('path');

function replaceFileContent(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
        if (content.indexOf('\0') !== -1) {
            content = fs.readFileSync(filePath, 'utf16le');
        }
    } catch (e) {
        console.error('Error reading ' + filePath + ': ' + e);
        return;
    }

    let isCss = filePath.endsWith('.css');
    let isHtml = filePath.endsWith('.html');

    if (isCss) {
        // Replace CSS root variables
        content = content.replace(/:root\s*\{[\s\S]*?\}/, `:root {
  --bg-color: #f8fafc;
  --text-color: #0f172a;
  --accent-color: #2563eb;
  --secondary-color: #7c3aed;
  --glass-bg: rgba(0, 0, 0, 0.03);
  --glass-border: rgba(0, 0, 0, 0.08);
  --font-main: 'Outfit', sans-serif;
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}`);

        // Replace white text colors with text-color variable
        content = content.replace(/color:\s*#fff(?:fff)?;/gi, 'color: var(--text-color);');
        
        // Replace white text with rgba to dark slate with rgba
        content = content.replace(/color:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\);/g, 'color: rgba(15, 23, 42, $1);');
        
        // Backgrounds dark to light
        content = content.replace(/rgba\(\s*5\s*,\s*5\s*,\s*5\s*,\s*([0-9.]+)\s*\)/g, 'rgba(255, 255, 255, $1)');
        content = content.replace(/background:\s*#050505;/g, 'background: var(--bg-color);');
        content = content.replace(/background-color:\s*#050505;/g, 'background-color: var(--bg-color);');

        // Glass effects / borders white to dark
        content = content.replace(/background:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, 'background: rgba(0, 0, 0, $1)');
        content = content.replace(/border(-color|):\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, 'border$1: rgba(0, 0, 0, $2)');
        content = content.replace(/box-shadow:\s*0\s+0\s+([0-9]+px)\s+rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, 'box-shadow: 0 0 $1 rgba(0, 0, 0, $2)');
        content = content.replace(/box-shadow:\s*(.*?)\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, 'box-shadow: $1 rgba(0, 0, 0, $2)');

        // Specific overrides
        // .btn-primary should have white text
        content = content.replace(/\.btn-primary\s*\{[^}]*\}/g, match => match.replace(/color:\s*var\(--text-color\);/, 'color: #ffffff;'));
        // .upload-icon should have white text
        content = content.replace(/\.upload-icon\s*\{[^}]*\}/g, match => match.replace(/color:\s*var\(--text-color\);/, 'color: #ffffff;'));
        
        // Avatar overlay should be visible
        content = content.replace(/\.avatar-overlay\s*\{[^}]*\}/g, match => match.replace(/background:\s*rgba\(0, 0, 0, 0.6\);/, 'background: rgba(0, 0, 0, 0.4);'));
    }

    if (isHtml) {
        // Replace inline white colors and transparent whites with dark variants
        content = content.replace(/rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/g, 'rgba(15, 23, 42, $1)');
        content = content.replace(/#ffffff/gi, '#0f172a');
        content = content.replace(/color:\s*#fff/gi, 'color: #0f172a');
        content = content.replace(/color:\s*#fff/gi, 'color: #0f172a');

        // the specific gradient for "Perjalanan saya" needs white -> dark slate
        // already caught by #ffffff -> #0f172a
        
        // specifically for admin messages modal text colors:
        content = content.replace(/color:\s*#fff;/g, 'color: #0f172a;');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + filePath);
}

replaceFileContent(path.join(__dirname, 'src', 'style.css'));
replaceFileContent(path.join(__dirname, 'index.html'));
