const fs = require('fs');

let layout = fs.readFileSync('src/routes/layout.tsx', 'utf8');
layout = layout.replace(/\/\/ eslint-disable-next-line qwik\/no-use-visible-task\n\s*useVisibleTask\$\(\(\) => \{\n\s*if \(typeof localStorage/g, 'useVisibleTask$(() => {\n    if (typeof localStorage');
fs.writeFileSync('src/routes/layout.tsx', layout);

let headerModern = fs.readFileSync('src/components/header/header-modern.tsx', 'utf8');
headerModern = headerModern.replace(/\/\* eslint-disable-next-line qwik\/jsx-img \*\//g, '{/* eslint-disable-next-line qwik/jsx-img */}');
fs.writeFileSync('src/components/header/header-modern.tsx', headerModern);
