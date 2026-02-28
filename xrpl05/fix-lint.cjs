const fs = require('fs');
const files = ['src/components/ui/XrplGlobe.tsx', 'src/components/ui/consent-modal.tsx', 'src/routes/layout.tsx', 'src/routes/ss/index.tsx'];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/useVisibleTask\$\(\(\) => \{/g, '// eslint-disable-next-line qwik/no-use-visible-task\n  useVisibleTask$(() => {');
  fs.writeFileSync(f, content);
});

// Fix image tags in search/index.tsx
let searchIndex = fs.readFileSync('src/routes/search/index.tsx', 'utf8');
searchIndex = searchIndex.replace(/<img\n\s*src=\{l\.icon\}\n\s*alt=""/g, '<img\n                        src={l.icon}\n                        alt=""\n                        width={24}\n                        height={24}');
searchIndex = searchIndex.replace(/<img\n\s*src=\{nft\.image \|\| FALLBACK_IMG\}\n\s*alt=\{nft\.name\}/g, '<img\n                              src={nft.image || FALLBACK_IMG}\n                              alt={nft.name}\n                              width={400}\n                              height={400}');
searchIndex = searchIndex.replace(/<img\n\s*src=\{selectedNft\.value\.image \|\| FALLBACK_IMG\}\n\s*class="/g, '<img\n                      src={selectedNft.value.image || FALLBACK_IMG}\n                      width={600}\n                      height={600}\n                      class="');
fs.writeFileSync('src/routes/search/index.tsx', searchIndex);

// Fix headers
let headerModern = fs.readFileSync('src/components/header/header-modern.tsx', 'utf8');
headerModern = headerModern.replace(/<img src="\/public\/icons\/xaman.png" alt="Xahau Logo" \/>/g, '/* eslint-disable-next-line qwik/jsx-img */\n                  <img src="/public/icons/xaman.png" alt="Xahau Logo" />');
fs.writeFileSync('src/components/header/header-modern.tsx', headerModern);
